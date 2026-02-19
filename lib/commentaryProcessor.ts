import { getServerSupabase } from "@/lib/supabaseClient";
import {
	ensureCommentaryQueueReady,
	type CommentaryEventRecord,
	type CommentaryEventType,
	type CommentaryEventPayloadByType,
} from "@/lib/commentaryEvents";
import { checkCommentaryBudget } from "@/lib/commentaryBudgets";
import { dispatchCommentaryOutput } from "@/lib/commentaryDispatch";
import { buildRuleOutputs, type CommentaryRuleContext } from "@/lib/commentaryRules";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;
const DEFAULT_MAX_MS = 1500;
const MAX_MAX_MS = 8000;
const MAX_ATTEMPTS = 5;
type DbClient = NonNullable<ReturnType<typeof getServerSupabase>>;

export type CommentaryProcessStats = {
	ok: true;
	dequeued: number;
	processed: number;
	emitted: number;
	skippedBudget: number;
	failed: number;
	dead: number;
};

type CommentaryEventRow = {
	id: string;
	lobby_id: string;
	event_type: CommentaryEventType;
	event_key: string;
	payload: CommentaryEventPayloadByType[CommentaryEventType];
	status: "queued" | "processing" | "done" | "failed" | "dead";
	attempts: number;
	next_attempt_at: string;
	last_error: string | null;
	created_at: string;
	processed_at: string | null;
};

function getErrorMessage(error: unknown, fallback: string): string {
	if (error instanceof Error && error.message) return error.message;
	return String(error || fallback);
}

function normalizeEventRow(row: CommentaryEventRow): CommentaryEventRecord {
	return {
		id: row.id,
		lobbyId: row.lobby_id,
		type: row.event_type,
		key: row.event_key,
		payload: row.payload,
		status: row.status,
		attempts: Number(row.attempts ?? 0),
		nextAttemptAt: row.next_attempt_at,
		lastError: row.last_error ?? null,
		createdAt: row.created_at,
		processedAt: row.processed_at ?? null,
	};
}

function backoffMs(attempts: number): number {
	const base = 30_000;
	return Math.min(base * 2 ** Math.max(0, attempts - 1), 60 * 60 * 1000);
}

function pickTopOutputsByChannel(outputs: ReturnType<typeof buildRuleOutputs>) {
	const ranked = [...outputs].sort((a, b) => b.score - a.score);
	const chosen: typeof outputs = [];
	const dropped: typeof outputs = [];
	const channels = new Set<string>();
	for (const output of ranked) {
		if (channels.has(output.channel)) {
			dropped.push(output);
			continue;
		}
		channels.add(output.channel);
		chosen.push(output);
	}
	return { chosen, dropped };
}

async function writeRuleRun(input: {
	supabase: DbClient;
	eventId: string;
	ruleId: string;
	channel: "feed" | "history" | "push";
	decision: "emitted" | "skipped_budget" | "skipped_dedupe" | "skipped_condition" | "error";
	score: number;
	meta?: Record<string, unknown>;
}) {
	const { error } = await input.supabase.from("commentary_rule_runs").insert({
		event_id: input.eventId,
		rule_id: input.ruleId,
		channel: input.channel,
		decision: input.decision,
		score: input.score,
		meta: input.meta ?? {},
	});
	if (error) throw error;
}

async function loadRuleContext(supabase: DbClient, lobbyId: string): Promise<CommentaryRuleContext> {
	const { data, error } = await supabase.from("player").select("id,name,user_id").eq("lobby_id", lobbyId);
	if (error) throw error;
	const playerNamesById = new Map<string, string>();
	const playerUserIdsById = new Map<string, string | null>();
	for (const row of data ?? []) {
		playerNamesById.set(String(row.id), String(row.name || "Athlete"));
		playerUserIdsById.set(String(row.id), row.user_id ? String(row.user_id) : null);
	}
	return { playerNamesById, playerUserIdsById };
}

async function claimEventForProcessing(supabase: DbClient, row: CommentaryEventRow): Promise<CommentaryEventRow | null> {
	const attempts = Number(row.attempts ?? 0) + 1;
	const nowIso = new Date().toISOString();
	const { data, error } = await supabase
		.from("commentary_events")
		.update({
			status: "processing",
			attempts,
			last_error: null,
			processed_at: null,
		})
		.eq("id", row.id)
		.in("status", ["queued", "failed"])
		.lte("next_attempt_at", nowIso)
		.select("*")
		.maybeSingle();
	if (error) throw error;
	return (data as CommentaryEventRow | null) ?? null;
}

async function markEventDone(supabase: DbClient, eventId: string) {
	const { error } = await supabase
		.from("commentary_events")
		.update({
			status: "done",
			processed_at: new Date().toISOString(),
			last_error: null,
		})
		.eq("id", eventId);
	if (error) throw error;
}

async function markEventFailedOrDead(supabase: DbClient, row: CommentaryEventRow, err: unknown): Promise<"failed" | "dead"> {
	const attempts = Number(row.attempts ?? 0);
	const message = getErrorMessage(err, "unknown commentary processor error").slice(0, 1000);
	if (attempts >= MAX_ATTEMPTS) {
		const { error } = await supabase
			.from("commentary_events")
			.update({
				status: "dead",
				last_error: message,
				processed_at: new Date().toISOString(),
			})
			.eq("id", row.id);
		if (error) throw error;
		return "dead";
	}

	const nextAttemptAt = new Date(Date.now() + backoffMs(attempts)).toISOString();
	const { error } = await supabase
		.from("commentary_events")
		.update({
			status: "failed",
			last_error: message,
			next_attempt_at: nextAttemptAt,
			processed_at: null,
		})
		.eq("id", row.id);
	if (error) throw error;
	return "failed";
}

async function processOneEvent(input: {
	supabase: DbClient;
	eventRow: CommentaryEventRow;
	contextCache: Map<string, CommentaryRuleContext>;
	stats: CommentaryProcessStats;
}) {
	const { supabase, eventRow, contextCache, stats } = input;
	const event = normalizeEventRow(eventRow);

	let context = contextCache.get(event.lobbyId);
	if (!context) {
		context = await loadRuleContext(supabase, event.lobbyId);
		contextCache.set(event.lobbyId, context);
	}

	const allOutputs = buildRuleOutputs(event, context);
	const { chosen, dropped } = pickTopOutputsByChannel(allOutputs);

	for (const output of dropped) {
		await writeRuleRun({
			supabase,
			eventId: event.id,
			ruleId: output.ruleId,
			channel: output.channel,
			decision: "skipped_condition",
			score: output.score,
			meta: {
				...(output.meta ?? {}),
				reason: "lower_priority_same_channel",
			},
		});
	}

	const dispatchErrors: string[] = [];
	for (const output of chosen) {
		const runMetaBase = {
			...(output.meta ?? {}),
			eventType: output.eventType,
			userId: output.push?.userId ?? null,
		};

		if (output.channel === "push" && !output.push) {
			await writeRuleRun({
				supabase,
				eventId: event.id,
				ruleId: output.ruleId,
				channel: output.channel,
				decision: "skipped_condition",
				score: output.score,
				meta: { ...runMetaBase, reason: "missing_push_payload" },
			});
			continue;
		}
		if ((output.channel === "feed" || output.channel === "history") && !output.comment) {
			await writeRuleRun({
				supabase,
				eventId: event.id,
				ruleId: output.ruleId,
				channel: output.channel,
				decision: "skipped_condition",
				score: output.score,
				meta: { ...runMetaBase, reason: "missing_comment_payload" },
			});
			continue;
		}

		const budget = await checkCommentaryBudget({ supabase, output });
		if (!budget.allowed) {
			stats.skippedBudget += 1;
			await writeRuleRun({
				supabase,
				eventId: event.id,
				ruleId: output.ruleId,
				channel: output.channel,
				decision: "skipped_budget",
				score: output.score,
				meta: { ...runMetaBase, ...(budget.meta ?? {}), reason: budget.reason ?? "budget_blocked" },
			});
			continue;
		}

		try {
			const dispatched = await dispatchCommentaryOutput({
				supabase,
				eventId: event.id,
				output,
			});
			if (dispatched.duplicate) {
				await writeRuleRun({
					supabase,
					eventId: event.id,
					ruleId: output.ruleId,
					channel: output.channel,
					decision: "skipped_dedupe",
					score: output.score,
					meta: runMetaBase,
				});
				continue;
			}

			stats.emitted += dispatched.emitted ? 1 : 0;
			await writeRuleRun({
				supabase,
				eventId: event.id,
				ruleId: output.ruleId,
				channel: output.channel,
				decision: "emitted",
				score: output.score,
				meta: runMetaBase,
			});
		} catch (err) {
			const errMessage = getErrorMessage(err, "dispatch failed").slice(0, 500);
			dispatchErrors.push(`${output.ruleId}:${output.channel}:${errMessage}`);
			await writeRuleRun({
				supabase,
				eventId: event.id,
				ruleId: output.ruleId,
				channel: output.channel,
				decision: "error",
				score: output.score,
				meta: { ...runMetaBase, error: errMessage },
			});
		}
	}

	if (dispatchErrors.length > 0) {
		throw new Error(`dispatch errors: ${dispatchErrors.join(" | ")}`);
	}
}

export async function processCommentaryQueue(opts?: {
	lobbyId?: string;
	limit?: number;
	maxMs?: number;
	newestFirst?: boolean;
}): Promise<CommentaryProcessStats> {
	await ensureCommentaryQueueReady();
	const supabase = getServerSupabase();
	if (!supabase) throw new Error("No database client available for commentary processor.");

	const limit = Math.max(1, Math.min(Number(opts?.limit ?? DEFAULT_LIMIT), MAX_LIMIT));
	const maxMs = Math.max(100, Math.min(Number(opts?.maxMs ?? DEFAULT_MAX_MS), MAX_MAX_MS));
	const deadline = Date.now() + maxMs;

	const stats: CommentaryProcessStats = {
		ok: true,
		dequeued: 0,
		processed: 0,
		emitted: 0,
		skippedBudget: 0,
		failed: 0,
		dead: 0,
	};
	const contextCache = new Map<string, CommentaryRuleContext>();

	while (stats.processed < limit && Date.now() < deadline) {
		const batchLimit = Math.min(25, limit - stats.processed);
		const nowIso = new Date().toISOString();
		const ascending = !opts?.newestFirst;
		let query = supabase
			.from("commentary_events")
			.select("*")
			.in("status", ["queued", "failed"])
			.lte("next_attempt_at", nowIso)
			.order("created_at", { ascending })
			.limit(batchLimit);
		if (opts?.lobbyId) query = query.eq("lobby_id", opts.lobbyId);
		const { data: rows, error } = await query;
		if (error) throw error;
		const events = (rows ?? []) as CommentaryEventRow[];
		if (events.length === 0) break;

		for (const row of events) {
			if (stats.processed >= limit || Date.now() >= deadline) break;
			const claimed = await claimEventForProcessing(supabase, row);
			if (!claimed) continue;

			stats.dequeued += 1;
			stats.processed += 1;
			try {
				await processOneEvent({
					supabase,
					eventRow: claimed,
					contextCache,
					stats,
				});
				await markEventDone(supabase, claimed.id);
			} catch (err) {
				const outcome = await markEventFailedOrDead(supabase, claimed, err);
				if (outcome === "dead") stats.dead += 1;
				else stats.failed += 1;
			}
		}
	}

	return stats;
}
