import type { Activity } from "@/lib/types";
import { enqueueCommentaryEvent } from "@/lib/commentaryEvents";
import { processCommentaryQueue } from "@/lib/commentaryProcessor";

export type QuipType = "ACTIVITY" | "VOTE" | "HEARTS" | "POT" | "KO" | "SUMMARY";
export type Quip = {
	type: QuipType;
	rendered: string;
	payload: Record<string, any>;
	visibility?: "feed" | "history" | "both";
	primaryPlayerId?: string;
	secondaryPlayerId?: string;
	activityId?: string;
};

export const copyStyle = { spicy: false };

type LegacyContext = {
	now: Date;
	lobbyId: string;
	activity?: Activity;
	event?: any;
};

export function generateQuips(_ctx: LegacyContext): Quip[] {
	return [];
}

async function enqueueAndTail(input: {
	lobbyId: string;
	type:
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
	key: string;
	payload: any;
}) {
	await enqueueCommentaryEvent({
		lobbyId: input.lobbyId,
		type: input.type,
		key: input.key,
		payload: input.payload,
	});
	void processCommentaryQueue({ lobbyId: input.lobbyId, limit: 80, maxMs: 700 }).catch((err) => {
		console.error("legacy commentary tail process failed", err);
	});
}

export async function onActivityLogged(lobbyId: string, activity: Activity): Promise<void> {
	await enqueueAndTail({
		lobbyId,
		type: "ACTIVITY_LOGGED",
		key: `activity:${activity.id}`,
		payload: {
			activityId: activity.id,
			playerId: activity.playerId,
			type: activity.type,
			durationMinutes: activity.durationMinutes ?? null,
			distanceKm: activity.distanceKm ?? null,
			notes: activity.notes ?? null,
			createdAt: activity.date,
		},
	});
}

export async function onVoteResolved(lobbyId: string, activity: Activity, status: "approved" | "rejected"): Promise<void> {
	await enqueueAndTail({
		lobbyId,
		type: "VOTE_RESOLVED",
		key: `vote-result:${activity.id}:${status}`,
		payload: {
			activityId: activity.id,
			playerId: activity.playerId,
			result: status,
		},
	});
}

export async function onHeartsChanged(_lobbyId: string, _playerId: string, _delta: number, _reason: string): Promise<void> {
	// Deprecated in event-first pipeline. Kept as no-op compatibility surface.
}

export async function onWeeklyRollover(_lobbyId: string): Promise<void> {
	// Deprecated in event-first pipeline. Kept as no-op compatibility surface.
}

export async function onPotChanged(lobbyId: string, delta: number, potOverride?: number): Promise<void> {
	await enqueueAndTail({
		lobbyId,
		type: "POT_CHANGED",
		key: `pot:${Number(potOverride ?? 0)}:${Number(delta ?? 0)}`,
		payload: {
			delta: Number(delta ?? 0),
			pot: Number(potOverride ?? 0),
		},
	});
}

export async function onKO(_lobbyId: string, _loserId: string, _potAtKO: number): Promise<void> {
	// Deprecated in event-first pipeline. Kept as no-op compatibility surface.
}

export async function onSpin(lobbyId: string, text: string): Promise<void> {
	const now = new Date().toISOString();
	await enqueueAndTail({
		lobbyId,
		type: "SPIN_RESOLVED",
		key: `spin:legacy:${now}:${text}`,
		payload: {
			week: 0,
			spinId: `legacy-${now}`,
			winnerItemId: "legacy",
			text,
			startedAt: now,
			auto: false,
		},
	});
}

export async function onReadyChanged(lobbyId: string, playerId: string, ready: boolean): Promise<void> {
	await enqueueAndTail({
		lobbyId,
		type: "READY_CHANGED",
		key: `ready:${playerId}:${ready ? 1 : 0}`,
		payload: {
			playerId,
			ready: !!ready,
		},
	});
}

export async function onPunishmentResolved(lobbyId: string, playerId: string): Promise<void> {
	await enqueueAndTail({
		lobbyId,
		type: "PUNISHMENT_RESOLVED",
		key: `punishment-resolved:legacy:${playerId}:${Date.now()}`,
		payload: {
			punishmentId: `legacy-${Date.now()}`,
			playerId,
		},
	});
}

export async function onAllReady(lobbyId: string): Promise<void> {
	await enqueueAndTail({
		lobbyId,
		type: "ALL_READY",
		key: `all-ready:legacy:${Date.now()}`,
		payload: {
			readyPlayerIds: [],
		},
	});
}

export async function onWeeklyReset(lobbyId: string, weekStartIso: string): Promise<void> {
	await enqueueAndTail({
		lobbyId,
		type: "WEEKLY_RESET",
		key: `weekly-reset:${weekStartIso}`,
		payload: {
			weekStart: weekStartIso,
		},
	});
}

export async function onStreakMilestone(_lobbyId: string, _playerId: string, _streak: number): Promise<void> {
	// Deprecated in event-first pipeline. Kept as no-op compatibility surface.
}

export async function onGhostWeek(lobbyId: string, playerId: string, weekStart: string, weeklyTarget: number) {
	await enqueueAndTail({
		lobbyId,
		type: "WEEKLY_GHOST_GROUP",
		key: `weekly-ghost:${weekStart}:${playerId}`,
		payload: {
			weekStart,
			weeklyTarget,
			players: [{ id: playerId }],
		},
	});
}

function summarizePlayerIds(players: Array<{ id: string }>): string {
	return players.map((player) => player.id).sort().join(",");
}

export async function onGhostWeekGroup(
	lobbyId: string,
	players: Array<{ id: string; name?: string | null }>,
	weekStart: string,
	weeklyTarget: number
): Promise<boolean> {
	await enqueueAndTail({
		lobbyId,
		type: "WEEKLY_GHOST_GROUP",
		key: `weekly-ghost:${weekStart}:${summarizePlayerIds(players)}`,
		payload: { weekStart, weeklyTarget, players },
	});
	return true;
}

export async function onWeeklyMissedTargetGroup(
	lobbyId: string,
	group: {
		weekStart: string;
		weeklyTarget: number;
		players: Array<{ id: string; name?: string | null; heartsLost: number; workouts: number }>;
	}
): Promise<boolean> {
	await enqueueAndTail({
		lobbyId,
		type: "WEEKLY_MISSED_TARGET_GROUP",
		key: `weekly-missed:${group.weekStart}:${summarizePlayerIds(group.players)}`,
		payload: group,
	});
	return true;
}

export async function onWeeklyHitTargetGroup(
	lobbyId: string,
	group: {
		weekStart: string;
		weeklyTarget: number;
		players: Array<{ id: string; name?: string | null; heartsGained: number; workouts: number }>;
	}
): Promise<boolean> {
	await enqueueAndTail({
		lobbyId,
		type: "WEEKLY_HIT_TARGET_GROUP",
		key: `weekly-hit:${group.weekStart}:${summarizePlayerIds(group.players)}`,
		payload: group,
	});
	return true;
}

export async function onPerfectWeek(_lobbyId: string, _playerId: string, _workouts: number, _weekStart?: string) {
	// Deprecated in event-first pipeline. Kept as no-op compatibility surface.
}

export async function onPerfectWeekGroup(
	lobbyId: string,
	group: {
		weekStart: string;
		weeklyTarget: number;
		players: Array<{ id: string; name?: string | null; workouts: number }>;
	}
): Promise<boolean> {
	await enqueueAndTail({
		lobbyId,
		type: "WEEKLY_PERFECT_GROUP",
		key: `weekly-perfect:${group.weekStart}:${summarizePlayerIds(group.players)}`,
		payload: {
			weekStart: group.weekStart,
			weeklyTarget: group.weeklyTarget,
			players: group.players.map((player) => ({ id: player.id, name: player.name ?? null })),
		},
	});
	return true;
}

export async function onWeeklyHype(
	lobbyId: string,
	players: Array<{ id: string; name?: string | null }>,
	weeklyTarget: number
) {
	const weekStart = new Date().toISOString();
	await enqueueAndTail({
		lobbyId,
		type: "WEEKLY_HYPE_GROUP",
		key: `weekly-hype:${weekStart}:${summarizePlayerIds(players)}`,
		payload: {
			weekStart,
			weeklyTarget,
			players,
		},
	});
}

export async function onTightRace(lobbyId: string, playerNames: string[], pot: number) {
	const weekStart = new Date().toISOString();
	await enqueueAndTail({
		lobbyId,
		type: "WEEKLY_TIGHT_RACE",
		key: `weekly-tight-race:${weekStart}:${pot}:${playerNames.slice().sort().join(",")}`,
		payload: {
			weekStart,
			pot,
			names: playerNames,
		},
	});
}

export async function onDailyReminder(lobbyId: string, playerId: string, playerName: string, dayKey?: string): Promise<void> {
	const key = dayKey || new Date().toISOString().slice(0, 10);
	await enqueueAndTail({
		lobbyId,
		type: "DAILY_REMINDER_DUE",
		key: `daily-reminder:${playerId}:${key}`,
		payload: {
			playerId,
			playerName,
			dayKey: key,
		},
	});
}

export async function onStreakPR(_lobbyId: string, _playerId: string, _streak: number): Promise<void> {
	// Deprecated in event-first pipeline. Kept as no-op compatibility surface.
}

export async function onSocialBurst(_lobbyId: string, _playerIdA: string, _playerIdB: string) {
	// Deprecated in event-first pipeline. Kept as no-op compatibility surface.
}

export async function onRivalryPulse(_lobbyId: string, _playerIdA: string, _playerIdB: string) {
	// Deprecated in event-first pipeline. Kept as no-op compatibility surface.
}

export async function onThemeHour(_lobbyId: string, _type: string) {
	// Deprecated in event-first pipeline. Kept as no-op compatibility surface.
}
