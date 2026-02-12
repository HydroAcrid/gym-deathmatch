import {
	ensureCommentaryQueueReady,
	isCommentaryQueueUnavailableError,
} from "@/lib/commentaryEvents";
import { processCommentaryQueue } from "@/lib/commentaryProcessor";
import { emitVoteResolvedEvent } from "@/lib/commentaryProducers";
import { getServerSupabase } from "@/lib/supabaseClient";

type VoteChoice = "legit" | "sus" | "remove";
type ManualStatus = "approved" | "pending" | "rejected";
type VoteReason =
	| "approved_timeout"
	| "rejected_threshold"
	| "rejected_unanimous"
	| "approved_majority"
	| "rejected_majority";

type ActivityRow = {
	id: string;
	lobby_id: string;
	player_id: string;
	status: ManualStatus;
	vote_deadline: string | null;
	decided_at: string | null;
};

type VoteRow = {
	choice: "legit" | "sus";
};

type PlayerMembershipRow = {
	id: string;
	lobby_id: string;
	user_id: string | null;
};

type LobbyOwnerRow = {
	owner_id: string | null;
	owner_user_id: string | null;
};

type StartedEventRow = {
	actor_player_id: string | null;
};

class VoteServiceError extends Error {
	code: string;
	status: number;

	constructor(code: string, message: string, status: number) {
		super(message);
		this.code = code;
		this.status = status;
	}
}

function fail(code: string, message: string, status: number): never {
	throw new VoteServiceError(code, message, status);
}

function queueCommentary(lobbyId: string): void {
	void processCommentaryQueue({ lobbyId, limit: 80, maxMs: 600 }).catch((err) => {
		console.error("vote commentary tail-process failed", err);
	});
}

async function emitVoteResultEvent(input: {
	lobbyId: string;
	activityId: string;
	playerId: string;
	result: "approved" | "rejected";
	reason: VoteReason | "owner_override" | string;
	legit?: number;
	sus?: number;
}): Promise<void> {
	try {
		await emitVoteResolvedEvent({
			lobbyId: input.lobbyId,
			activityId: input.activityId,
			playerId: input.playerId,
			result: input.result,
			reason: input.reason,
			legit: input.legit,
			sus: input.sus,
		});
	} catch {
		// Commentary event failures should not block vote workflows.
	}
}

async function resolveActivityVotes(activityId: string): Promise<void> {
	const supabase = getServerSupabase();
	if (!supabase) return;

	const { data: act, error: actErr } = await supabase
		.from("manual_activities")
		.select("id,lobby_id,player_id,status,vote_deadline,decided_at")
		.eq("id", activityId)
		.maybeSingle();
	if (actErr || !act) return;

	const activity = act as ActivityRow;
	const now = new Date();

	const { data: votes } = await supabase.from("activity_votes").select("choice").eq("activity_id", activityId);
	const { data: players } = await supabase.from("player").select("id").eq("lobby_id", activity.lobby_id);

	const totalEligibleVoters = Math.max(0, (players?.length ?? 0) - 1);
	if (totalEligibleVoters === 0) return;

	const typedVotes = (votes ?? []) as VoteRow[];
	const legit = typedVotes.filter((vote) => vote.choice === "legit").length;
	const sus = typedVotes.filter((vote) => vote.choice === "sus").length;
	const totalVotes = legit + sus;

	if (activity.decided_at && activity.status !== "pending") return;

	if (totalVotes === 0 && activity.status === "pending") {
		await supabase
			.from("manual_activities")
			.update({ status: "approved", vote_deadline: null, decided_at: null })
			.eq("id", activityId);
		return;
	}

	if (activity.status === "approved" && totalVotes > 0 && !activity.decided_at) {
		const deadline = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
		await supabase.from("manual_activities").update({ status: "pending", vote_deadline: deadline }).eq("id", activityId);
	}

	if (activity.status === "approved" && totalVotes === 0) return;

	if (activity.vote_deadline && new Date(activity.vote_deadline).getTime() <= now.getTime()) {
		await supabase
			.from("manual_activities")
			.update({ status: "approved", decided_at: now.toISOString() })
			.eq("id", activityId);
		await supabase.from("history_events").insert({
			lobby_id: activity.lobby_id,
			type: "VOTE_RESULT",
			payload: { activityId, result: "approved_timeout", legit, sus, totalEligibleVoters },
		});
		await emitVoteResultEvent({
			lobbyId: activity.lobby_id,
			activityId,
			playerId: activity.player_id,
			result: "approved",
			reason: "approved_timeout",
			legit,
			sus,
		});
		return;
	}

	if (totalEligibleVoters >= 2 && totalVotes > 0 && sus / totalEligibleVoters >= 0.75) {
		await supabase
			.from("manual_activities")
			.update({ status: "rejected", decided_at: now.toISOString() })
			.eq("id", activityId);
		await supabase.from("history_events").insert({
			lobby_id: activity.lobby_id,
			type: "VOTE_RESULT",
			payload: { activityId, result: "rejected_threshold", legit, sus, totalEligibleVoters },
		});
		await emitVoteResultEvent({
			lobbyId: activity.lobby_id,
			activityId,
			playerId: activity.player_id,
			result: "rejected",
			reason: "rejected_threshold",
			legit,
			sus,
		});
		return;
	}

	if (totalEligibleVoters > 0 && sus === totalEligibleVoters && sus > 0) {
		await supabase
			.from("manual_activities")
			.update({ status: "rejected", decided_at: now.toISOString() })
			.eq("id", activityId);
		await supabase.from("history_events").insert({
			lobby_id: activity.lobby_id,
			type: "VOTE_RESULT",
			payload: { activityId, result: "rejected_unanimous", legit, sus, totalEligibleVoters },
		});
		await emitVoteResultEvent({
			lobbyId: activity.lobby_id,
			activityId,
			playerId: activity.player_id,
			result: "rejected",
			reason: "rejected_unanimous",
			legit,
			sus,
		});
		return;
	}

	const hasMajority = totalVotes > totalEligibleVoters / 2;
	if (!hasMajority) return;

	const winner: "approved" | "rejected" = legit >= sus ? "approved" : "rejected";
	const reason: VoteReason = winner === "approved" ? "approved_majority" : "rejected_majority";

	await supabase
		.from("manual_activities")
		.update({ status: winner, decided_at: now.toISOString() })
		.eq("id", activityId);

	await supabase.from("history_events").insert({
		lobby_id: activity.lobby_id,
		type: "VOTE_RESULT",
		payload: { activityId, result: reason, legit, sus, totalEligibleVoters, totalVotes },
	});

	await emitVoteResultEvent({
		lobbyId: activity.lobby_id,
		activityId,
		playerId: activity.player_id,
		result: winner,
		reason,
		legit,
		sus,
	});
}

export type CastVoteInput = {
	activityId: string;
	voterUserId: string;
	choice: VoteChoice;
};

export type CastVoteResult = {
	ok: true;
	removed?: boolean;
	reverted?: boolean;
};

export type OverrideVoteInput = {
	activityId: string;
	ownerUserId: string;
	newStatus: "approved" | "rejected";
	reason?: string | null;
};

export type OverrideVoteResult = {
	ok: true;
};

export const VoteService = {
	async castVote(input: CastVoteInput): Promise<CastVoteResult> {
		const supabase = getServerSupabase();
		if (!supabase) fail("SUPABASE_NOT_CONFIGURED", "Supabase not configured", 501);
		try {
			await ensureCommentaryQueueReady();
		} catch (err) {
			if (isCommentaryQueueUnavailableError(err)) {
				fail("COMMENTARY_QUEUE_UNAVAILABLE", "Run latest SQL schema before voting.", 503);
			}
			throw err;
		}

		const { data: act } = await supabase.from("manual_activities").select("*").eq("id", input.activityId).maybeSingle();
		if (!act) fail("NOT_FOUND", "Not found", 404);
		const activity = act as ActivityRow;

		const { data: voter } = await supabase
			.from("player")
			.select("id,lobby_id,user_id")
			.eq("lobby_id", activity.lobby_id)
			.eq("user_id", input.voterUserId)
			.maybeSingle();
		if (!voter || (voter as PlayerMembershipRow).lobby_id !== activity.lobby_id) {
			fail("NOT_IN_LOBBY", "Not in lobby", 400);
		}
		const voterPlayerId = (voter as PlayerMembershipRow).id;

		if (input.choice === "remove") {
			const { data: lobby } = await supabase
				.from("lobby")
				.select("owner_id,owner_user_id")
				.eq("id", activity.lobby_id)
				.maybeSingle();
			if (!lobby) fail("LOBBY_NOT_FOUND", "Lobby not found", 404);
			const owner = lobby as LobbyOwnerRow;

			const { data: voteStartedEvent } = await supabase
				.from("history_events")
				.select("actor_player_id")
				.eq("lobby_id", activity.lobby_id)
				.eq("type", "VOTE_STARTED")
				.eq("payload->>activityId", input.activityId)
				.order("created_at", { ascending: true })
				.limit(1)
				.maybeSingle();
			const starterPlayerId = (voteStartedEvent as StartedEventRow | null)?.actor_player_id ?? null;

			const isStarter = voterPlayerId === starterPlayerId;
			const isOwner = voterPlayerId === owner.owner_id;
			if ((isStarter || isOwner) && activity.status === "pending" && !activity.decided_at) {
				await supabase.from("activity_votes").delete().eq("activity_id", input.activityId);
				await supabase
					.from("manual_activities")
					.update({ status: "approved", vote_deadline: null, decided_at: null })
					.eq("id", input.activityId);
				await supabase.from("history_events").insert({
					lobby_id: activity.lobby_id,
					actor_player_id: voterPlayerId,
					target_player_id: activity.player_id,
					type: "VOTE_CANCELLED",
					payload: { activityId: input.activityId, reason: isOwner ? "owner_cancel" : "starter_cancel" },
				});
				return { ok: true, removed: true, reverted: true };
			}

			await supabase
				.from("activity_votes")
				.delete()
				.eq("activity_id", input.activityId)
				.eq("voter_player_id", voterPlayerId);
			await resolveActivityVotes(input.activityId);
			queueCommentary(activity.lobby_id);
			return { ok: true, removed: true, reverted: false };
		}

		if (input.choice !== "legit" && input.choice !== "sus") {
			fail("INVALID_CHOICE", "Invalid choice", 400);
		}
		if (voterPlayerId === activity.player_id) {
			fail("NO_SELF_VOTE", "No self-vote", 400);
		}

		const { data: playerList } = await supabase.from("player").select("id").eq("lobby_id", activity.lobby_id);
		if ((playerList?.length ?? 0) <= 2) {
			fail("VOTING_DISABLED_SMALL_LOBBY", "Voting disabled for lobbies with fewer than 3 players", 400);
		}

		if (activity.status === "approved") {
			const deadline = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
			await supabase
				.from("manual_activities")
				.update({ status: "pending", vote_deadline: deadline })
				.eq("id", input.activityId);
			await supabase.from("history_events").insert({
				lobby_id: activity.lobby_id,
				actor_player_id: voterPlayerId,
				target_player_id: activity.player_id,
				type: "VOTE_STARTED",
				payload: { activityId: input.activityId },
			});
		} else {
			if (activity.status === "rejected") fail("VOTING_CLOSED", "Voting closed", 400);
			if (activity.vote_deadline && new Date(activity.vote_deadline).getTime() < Date.now()) {
				fail("VOTING_CLOSED", "Voting closed", 400);
			}
		}

		const { error: voteError } = await supabase.from("activity_votes").upsert(
			{
				activity_id: input.activityId,
				voter_player_id: voterPlayerId,
				choice: input.choice,
			},
			{ onConflict: "activity_id,voter_player_id" }
		);
		if (voteError) throw voteError;

		await resolveActivityVotes(input.activityId);
		queueCommentary(activity.lobby_id);
		return { ok: true };
	},

	async override(input: OverrideVoteInput): Promise<OverrideVoteResult> {
		const supabase = getServerSupabase();
		if (!supabase) fail("SUPABASE_NOT_CONFIGURED", "Supabase not configured", 501);
		try {
			await ensureCommentaryQueueReady();
		} catch (err) {
			if (isCommentaryQueueUnavailableError(err)) {
				fail("COMMENTARY_QUEUE_UNAVAILABLE", "Run latest SQL schema before overriding.", 503);
			}
			throw err;
		}

		if (input.newStatus !== "approved" && input.newStatus !== "rejected") {
			fail("INVALID_STATUS", "Invalid status", 400);
		}

		const { data: act } = await supabase.from("manual_activities").select("*").eq("id", input.activityId).maybeSingle();
		if (!act) fail("NOT_FOUND", "Not found", 404);
		const activity = act as ActivityRow;

		const { data: lobby } = await supabase
			.from("lobby")
			.select("owner_user_id,owner_id")
			.eq("id", activity.lobby_id)
			.maybeSingle();
		if (!lobby) fail("LOBBY_NOT_FOUND", "Lobby not found", 404);
		const owner = lobby as LobbyOwnerRow;

		let ownerUserId = owner.owner_user_id;
		if (!ownerUserId && owner.owner_id) {
			const { data: ownerPlayer } = await supabase
				.from("player")
				.select("user_id")
				.eq("id", owner.owner_id)
				.maybeSingle();
			ownerUserId = ((ownerPlayer as { user_id: string | null } | null)?.user_id ?? null);
		}
		if (ownerUserId !== input.ownerUserId) fail("FORBIDDEN", "Not owner", 403);
		if (!owner.owner_id) fail("OWNER_NOT_FOUND", "Owner not found", 403);

		await supabase
			.from("manual_activities")
			.update({
				status: input.newStatus,
				decided_at: new Date().toISOString(),
				vote_deadline: null,
			})
			.eq("id", input.activityId);

		await supabase.from("history_events").insert({
			lobby_id: activity.lobby_id,
			actor_player_id: owner.owner_id,
			target_player_id: activity.player_id,
			type: "OWNER_OVERRIDE_ACTIVITY",
			payload: {
				activityId: input.activityId,
				previousStatus: activity.status,
				newStatus: input.newStatus,
				reason: input.reason ?? null,
			},
		});

		await emitVoteResultEvent({
			lobbyId: activity.lobby_id,
			activityId: input.activityId,
			playerId: activity.player_id,
			result: input.newStatus,
			reason: input.reason ?? "owner_override",
		});
		queueCommentary(activity.lobby_id);
		return { ok: true };
	},
};

export function isVoteServiceError(err: unknown): err is VoteServiceError {
	return err instanceof VoteServiceError;
}
