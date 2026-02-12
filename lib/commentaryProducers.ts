import type { Activity } from "@/lib/types";
import {
	enqueueCommentaryEvent,
	type CommentaryEventPayloadByType,
} from "@/lib/commentaryEvents";

type EnqueueResult = Awaited<ReturnType<typeof enqueueCommentaryEvent>>;

type WeeklyNamedPlayer = { id: string; name?: string | null };
type WeeklyMissedPlayer = WeeklyNamedPlayer & { heartsLost: number; workouts: number };
type WeeklyHitPlayer = WeeklyNamedPlayer & { heartsGained: number; workouts: number };

function sortedIds(players: Array<{ id: string }>): string {
	return players.map((player) => player.id).sort().join(",");
}

export async function emitActivityLoggedEvent(input: {
	lobbyId: string;
	activity: Activity;
}): Promise<EnqueueResult> {
	const { lobbyId, activity } = input;
	return enqueueCommentaryEvent({
		lobbyId,
		type: "ACTIVITY_LOGGED",
		key: `activity:${String(activity.id)}`,
		payload: {
			activityId: String(activity.id),
			playerId: String(activity.playerId),
			type: String(activity.type),
			durationMinutes: activity.durationMinutes ?? null,
			distanceKm: activity.distanceKm ?? null,
			notes: activity.notes ?? null,
			createdAt: String(activity.date),
		},
	});
}

export async function emitVoteResolvedEvent(input: {
	lobbyId: string;
	activityId: string;
	playerId: string;
	result: "approved" | "rejected";
	reason?: string | null;
	legit?: number | null;
	sus?: number | null;
}): Promise<EnqueueResult> {
	return enqueueCommentaryEvent({
		lobbyId: input.lobbyId,
		type: "VOTE_RESOLVED",
		key: `vote-result:${input.activityId}:${input.result}`,
		payload: {
			activityId: input.activityId,
			playerId: input.playerId,
			result: input.result,
			reason: input.reason ?? null,
			legit: input.legit ?? null,
			sus: input.sus ?? null,
		},
	});
}

export async function emitPotChangedEvent(input: {
	lobbyId: string;
	pot: number;
	delta: number;
}): Promise<EnqueueResult> {
	return enqueueCommentaryEvent({
		lobbyId: input.lobbyId,
		type: "POT_CHANGED",
		key: `pot:${input.pot}:${input.delta}`,
		payload: {
			pot: Number(input.pot),
			delta: Number(input.delta),
		},
	});
}

export async function emitSpinResolvedEvent(input: {
	lobbyId: string;
	week: number;
	spinId: string;
	winnerItemId: string;
	text: string;
	startedAt: string;
	auto?: boolean;
}): Promise<EnqueueResult> {
	return enqueueCommentaryEvent({
		lobbyId: input.lobbyId,
		type: "SPIN_RESOLVED",
		key: `spin:${input.spinId}`,
		payload: {
			week: Number(input.week),
			spinId: String(input.spinId),
			winnerItemId: String(input.winnerItemId),
			text: String(input.text || ""),
			startedAt: String(input.startedAt),
			auto: !!input.auto,
		},
	});
}

export async function emitReadyChangedEvent(input: {
	lobbyId: string;
	playerId: string;
	ready: boolean;
}): Promise<EnqueueResult> {
	return enqueueCommentaryEvent({
		lobbyId: input.lobbyId,
		type: "READY_CHANGED",
		key: `ready:${input.playerId}:${input.ready ? "1" : "0"}`,
		payload: {
			playerId: input.playerId,
			ready: !!input.ready,
		},
	});
}

export async function emitAllReadyEvent(input: {
	lobbyId: string;
	readyPlayerIds: string[];
}): Promise<EnqueueResult> {
	const ids = input.readyPlayerIds.map(String).sort();
	return enqueueCommentaryEvent({
		lobbyId: input.lobbyId,
		type: "ALL_READY",
		key: `all-ready:${ids.join(",") || "none"}`,
		payload: {
			readyPlayerIds: ids,
		},
	});
}

export async function emitPunishmentResolvedEvent(input: {
	lobbyId: string;
	punishmentId: string;
	playerId?: string | null;
	userId?: string | null;
}): Promise<EnqueueResult> {
	return enqueueCommentaryEvent({
		lobbyId: input.lobbyId,
		type: "PUNISHMENT_RESOLVED",
		key: `punishment-resolved:${input.punishmentId}`,
		payload: {
			punishmentId: String(input.punishmentId),
			playerId: input.playerId ?? null,
			userId: input.userId ?? null,
		},
	});
}

export async function emitDailyReminderDueEvent(input: {
	lobbyId: string;
	playerId: string;
	playerName: string;
	dayKey: string;
}): Promise<EnqueueResult> {
	return enqueueCommentaryEvent({
		lobbyId: input.lobbyId,
		type: "DAILY_REMINDER_DUE",
		key: `daily-reminder:${input.playerId}:${input.dayKey}`,
		payload: {
			playerId: input.playerId,
			playerName: input.playerName,
			dayKey: input.dayKey,
		},
	});
}

export async function emitWeeklyMissedTargetGroupEvent(input: {
	lobbyId: string;
	weekStart: string;
	weeklyTarget: number;
	players: WeeklyMissedPlayer[];
}): Promise<EnqueueResult> {
	return enqueueCommentaryEvent({
		lobbyId: input.lobbyId,
		type: "WEEKLY_MISSED_TARGET_GROUP",
		key: `weekly-missed:${input.weekStart}:${sortedIds(input.players)}`,
		payload: {
			weekStart: input.weekStart,
			weeklyTarget: input.weeklyTarget,
			players: input.players,
		},
	});
}

export async function emitWeeklyHitTargetGroupEvent(input: {
	lobbyId: string;
	weekStart: string;
	weeklyTarget: number;
	players: WeeklyHitPlayer[];
}): Promise<EnqueueResult> {
	return enqueueCommentaryEvent({
		lobbyId: input.lobbyId,
		type: "WEEKLY_HIT_TARGET_GROUP",
		key: `weekly-hit:${input.weekStart}:${sortedIds(input.players)}`,
		payload: {
			weekStart: input.weekStart,
			weeklyTarget: input.weeklyTarget,
			players: input.players,
		},
	});
}

export async function emitWeeklyGhostGroupEvent(input: {
	lobbyId: string;
	weekStart: string;
	weeklyTarget: number;
	players: WeeklyNamedPlayer[];
}): Promise<EnqueueResult> {
	return enqueueCommentaryEvent({
		lobbyId: input.lobbyId,
		type: "WEEKLY_GHOST_GROUP",
		key: `weekly-ghost:${input.weekStart}:${sortedIds(input.players)}`,
		payload: {
			weekStart: input.weekStart,
			weeklyTarget: input.weeklyTarget,
			players: input.players,
		},
	});
}

export async function emitWeeklyPerfectGroupEvent(input: {
	lobbyId: string;
	weekStart: string;
	weeklyTarget: number;
	players: WeeklyNamedPlayer[];
}): Promise<EnqueueResult> {
	return enqueueCommentaryEvent({
		lobbyId: input.lobbyId,
		type: "WEEKLY_PERFECT_GROUP",
		key: `weekly-perfect:${input.weekStart}:${sortedIds(input.players)}`,
		payload: {
			weekStart: input.weekStart,
			weeklyTarget: input.weeklyTarget,
			players: input.players,
		},
	});
}

export async function emitWeeklyHypeGroupEvent(input: {
	lobbyId: string;
	weekStart: string;
	weeklyTarget: number;
	players: WeeklyNamedPlayer[];
}): Promise<EnqueueResult> {
	return enqueueCommentaryEvent({
		lobbyId: input.lobbyId,
		type: "WEEKLY_HYPE_GROUP",
		key: `weekly-hype:${input.weekStart}:${sortedIds(input.players)}`,
		payload: {
			weekStart: input.weekStart,
			weeklyTarget: input.weeklyTarget,
			players: input.players,
		},
	});
}

export async function emitWeeklyTightRaceEvent(input: {
	lobbyId: string;
	weekStart: string;
	pot: number;
	names: string[];
}): Promise<EnqueueResult> {
	return enqueueCommentaryEvent({
		lobbyId: input.lobbyId,
		type: "WEEKLY_TIGHT_RACE",
		key: `weekly-tight-race:${input.weekStart}:${Number(input.pot)}:${input.names.slice().sort().join(",")}`,
		payload: {
			weekStart: input.weekStart,
			pot: Number(input.pot),
			names: input.names,
		},
	});
}

export async function emitWeeklyResetEvent(input: {
	lobbyId: string;
	weekStart: string;
}): Promise<EnqueueResult> {
	return enqueueCommentaryEvent({
		lobbyId: input.lobbyId,
		type: "WEEKLY_RESET",
		key: `weekly-reset:${input.weekStart}`,
		payload: {
			weekStart: input.weekStart,
		},
	});
}

export type CommentaryProducerPayloads = Pick<
	CommentaryEventPayloadByType,
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
	| "WEEKLY_TIGHT_RACE"
>;
