import { getServerSupabase } from "@/lib/supabaseClient";

export type CommentaryEventType =
	| "ACTIVITY_LOGGED"
	| "DAILY_REMINDER_DUE"
	| "VOTE_RESOLVED"
	| "POT_CHANGED"
	| "SPIN_RESOLVED"
	| "READY_CHANGED"
	| "ALL_READY"
	| "PUNISHMENT_RESOLVED"
	| "WEEKLY_MISSED_TARGET_GROUP"
	| "WEEKLY_HIT_TARGET_GROUP"
	| "WEEKLY_GHOST_GROUP"
	| "WEEKLY_HYPE_GROUP"
	| "WEEKLY_PERFECT_GROUP"
	| "WEEKLY_RESET"
	| "WEEKLY_TIGHT_RACE";

type ActivityLoggedPayload = {
	activityId: string;
	playerId: string;
	type: string;
	durationMinutes: number | null;
	distanceKm: number | null;
	notes: string | null;
	createdAt: string;
};

type DailyReminderPayload = {
	playerId: string;
	playerName: string;
	dayKey: string;
};

type VoteResolvedPayload = {
	activityId: string;
	playerId: string;
	result: "approved" | "rejected";
	reason?: string | null;
	legit?: number | null;
	sus?: number | null;
};

type PotChangedPayload = {
	delta: number;
	pot: number;
};

type SpinResolvedPayload = {
	week: number;
	spinId: string;
	winnerItemId: string;
	text: string;
	startedAt: string;
	auto?: boolean;
};

type ReadyChangedPayload = {
	playerId: string;
	ready: boolean;
};

type AllReadyPayload = {
	readyPlayerIds: string[];
};

type PunishmentResolvedPayload = {
	punishmentId: string;
	playerId?: string | null;
	userId?: string | null;
};

type WeeklyGroupPlayer = { id: string; name?: string | null };
type WeeklyHeartsPlayer = WeeklyGroupPlayer & { heartsLost?: number; heartsGained?: number; workouts: number };

type WeeklyMissedPayload = { weekStart: string; weeklyTarget: number; players: WeeklyHeartsPlayer[] };
type WeeklyHitPayload = { weekStart: string; weeklyTarget: number; players: WeeklyHeartsPlayer[] };
type WeeklyGhostPayload = { weekStart: string; weeklyTarget: number; players: WeeklyGroupPlayer[] };
type WeeklyHypePayload = { weekStart: string; weeklyTarget: number; players: WeeklyGroupPlayer[] };
type WeeklyPerfectPayload = { weekStart: string; weeklyTarget: number; players: WeeklyGroupPlayer[] };
type WeeklyResetPayload = { weekStart: string };
type WeeklyTightRacePayload = { weekStart: string; pot: number; names: string[] };

export type CommentaryEventPayloadByType = {
	ACTIVITY_LOGGED: ActivityLoggedPayload;
	DAILY_REMINDER_DUE: DailyReminderPayload;
	VOTE_RESOLVED: VoteResolvedPayload;
	POT_CHANGED: PotChangedPayload;
	SPIN_RESOLVED: SpinResolvedPayload;
	READY_CHANGED: ReadyChangedPayload;
	ALL_READY: AllReadyPayload;
	PUNISHMENT_RESOLVED: PunishmentResolvedPayload;
	WEEKLY_MISSED_TARGET_GROUP: WeeklyMissedPayload;
	WEEKLY_HIT_TARGET_GROUP: WeeklyHitPayload;
	WEEKLY_GHOST_GROUP: WeeklyGhostPayload;
	WEEKLY_HYPE_GROUP: WeeklyHypePayload;
	WEEKLY_PERFECT_GROUP: WeeklyPerfectPayload;
	WEEKLY_RESET: WeeklyResetPayload;
	WEEKLY_TIGHT_RACE: WeeklyTightRacePayload;
};

export type CommentaryEventRecord<T extends CommentaryEventType = CommentaryEventType> = {
	id: string;
	lobbyId: string;
	type: T;
	key: string;
	payload: CommentaryEventPayloadByType[T];
	status: "queued" | "processing" | "done" | "failed" | "dead";
	attempts: number;
	nextAttemptAt: string;
	lastError: string | null;
	createdAt: string;
	processedAt: string | null;
};

export class CommentaryQueueUnavailableError extends Error {
	constructor(message = "Commentary queue schema not found. Run latest SQL migration.") {
		super(message);
		this.name = "CommentaryQueueUnavailableError";
	}
}

export function isCommentaryQueueUnavailableError(err: unknown): boolean {
	const hasMessage = typeof err === "object" && err !== null && "message" in err;
	const hasCode = typeof err === "object" && err !== null && "code" in err;
	const message = String(hasMessage ? (err as { message?: unknown }).message ?? "" : "").toLowerCase();
	const code = String(hasCode ? (err as { code?: unknown }).code ?? "" : "");
	if (err instanceof CommentaryQueueUnavailableError) return true;
	return (
		code === "42P01" ||
		message.includes("commentary_events") ||
		message.includes("commentary_rule_runs") ||
		message.includes("commentary_emitted")
	);
}

export async function ensureCommentaryQueueReady(): Promise<void> {
	const supabase = getServerSupabase();
	if (!supabase) throw new CommentaryQueueUnavailableError("No database client available for commentary queue.");
	const { error } = await supabase.from("commentary_events").select("id").limit(1);
	if (error && isCommentaryQueueUnavailableError(error)) {
		throw new CommentaryQueueUnavailableError();
	}
	if (error) throw error;
}

export async function enqueueCommentaryEvent<T extends CommentaryEventType>(input: {
	lobbyId: string;
	type: T;
	key: string;
	payload: CommentaryEventPayloadByType[T];
}): Promise<{ enqueued: boolean; duplicate: boolean; eventId?: string }> {
	const supabase = getServerSupabase();
	if (!supabase) throw new CommentaryQueueUnavailableError("No database client available for commentary queue.");
	const nowIso = new Date().toISOString();
	const { data, error } = await supabase
		.from("commentary_events")
		.upsert(
			{
				lobby_id: input.lobbyId,
				event_type: input.type,
				event_key: input.key,
				payload: input.payload as unknown as Record<string, unknown>,
				status: "queued",
				next_attempt_at: nowIso,
			},
			{ onConflict: "lobby_id,event_type,event_key", ignoreDuplicates: true }
		)
		.select("id");
	if (error) {
		if (isCommentaryQueueUnavailableError(error)) throw new CommentaryQueueUnavailableError();
		throw error;
	}
	if (!data || data.length === 0) {
		return { enqueued: false, duplicate: true };
	}
	return { enqueued: true, duplicate: false, eventId: data[0].id as string };
}
