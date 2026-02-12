import { sendPushToLobby, sendPushToUser } from "@/lib/push";
import type { CommentaryDispatchOutput } from "@/lib/commentaryRules";

type DedupeClaimResult = "claimed" | "duplicate";

async function claimDispatchDedupe(input: {
	supabase: any;
	lobbyId: string;
	ruleId: string;
	channel: string;
	dedupeKey: string;
	meta?: Record<string, unknown>;
}): Promise<DedupeClaimResult> {
	const { data, error } = await input.supabase
		.from("commentary_emitted")
		.upsert(
			{
				lobby_id: input.lobbyId,
				event_type: `rule:${input.ruleId}:${input.channel}`,
				idempotency_key: input.dedupeKey,
				source_type: "commentary_processor",
				source_id: null,
				metadata: input.meta ?? {},
			},
			{
				onConflict: "lobby_id,event_type,idempotency_key",
				ignoreDuplicates: true,
			}
		)
		.select("id");

	if (error) throw error;
	return data && data.length > 0 ? "claimed" : "duplicate";
}

async function emitComment(supabase: any, output: CommentaryDispatchOutput): Promise<void> {
	const comment = output.comment;
	if (!comment) throw new Error("missing comment payload for comment channel");
	const { error } = await supabase.from("comments").insert({
		lobby_id: comment.lobbyId,
		type: comment.type,
		rendered: comment.rendered,
		payload: comment.payload ?? {},
		visibility: comment.visibility ?? "feed",
		primary_player_id: comment.primaryPlayerId ?? null,
		secondary_player_id: comment.secondaryPlayerId ?? null,
		activity_id: comment.activityId ?? null,
	});
	if (error) throw error;
}

async function emitPush(output: CommentaryDispatchOutput): Promise<void> {
	const push = output.push;
	if (!push) throw new Error("missing push payload for push channel");
	if (push.mode === "user") {
		if (!push.userId) throw new Error("missing userId for user push");
		await sendPushToUser(push.userId, {
			title: push.title,
			body: push.body,
			url: push.url,
		});
		return;
	}

	if (!push.lobbyId) throw new Error("missing lobbyId for lobby push");
	await sendPushToLobby(
		push.lobbyId,
		{
			title: push.title,
			body: push.body,
			url: push.url,
		},
		{ excludeUserId: push.excludeUserId }
	);
}

export async function dispatchCommentaryOutput(input: {
	supabase: any;
	output: CommentaryDispatchOutput;
	eventId: string;
}): Promise<{ emitted: boolean; duplicate: boolean }> {
	const { output, supabase } = input;
	const lobbyId = output.comment?.lobbyId ?? output.push?.lobbyId;
	if (!lobbyId) {
		throw new Error(`missing lobby id for output ${output.ruleId}:${output.channel}`);
	}

	const claim = await claimDispatchDedupe({
		supabase,
		lobbyId,
		ruleId: output.ruleId,
		channel: output.channel,
		dedupeKey: output.dedupeKey,
		meta: {
			eventId: input.eventId,
			ruleId: output.ruleId,
			channel: output.channel,
			...(output.meta ?? {}),
		},
	});

	if (claim === "duplicate") {
		return { emitted: false, duplicate: true };
	}

	if (output.channel === "push") {
		await emitPush(output);
		return { emitted: true, duplicate: false };
	}

	await emitComment(supabase, output);
	return { emitted: true, duplicate: false };
}
