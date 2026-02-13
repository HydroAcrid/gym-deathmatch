import { getTokensForPlayer } from "@/lib/stravaStore";
import { fetchRecentActivities, toActivitySummary, type RawStravaActivity, type StravaTokens } from "@/lib/strava";
import {
	calculateAverageWorkoutsPerWeek,
	calculateLongestStreak,
	calculateStreakFromActivities,
	calculateTotalWorkouts,
} from "@/lib/streaks";
import { computeWeeklyHearts } from "@/lib/rules";
import { getServerSupabase } from "@/lib/supabaseClient";
import { getUserStravaTokens } from "@/lib/persistence";
import { getDailyTaunts } from "@/lib/funFacts";
import { logError } from "@/lib/logger";
import type { ManualActivityRow } from "@/types/db";
import type { Lobby, LobbyStage, Player } from "@/types/game";

type SeasonStatus = "pending" | "scheduled" | "transition_spin" | "active" | "completed";
type PlayerError = { playerId: string; reason: string };
type PlayerDebugRecord = {
	playerId: string;
	playerName: string;
	manualCount: number;
	stravaCount: number;
	combinedCount: number;
};

type StravaComparableActivity = RawStravaActivity & {
	__source?: "manual" | "strava";
	startDate?: string;
};

type ManualJoinedRow = ManualActivityRow & {
	status?: string | null;
	player?: { user_id?: string | null } | Array<{ user_id?: string | null }> | null;
};

type HeartAdjustmentRow = { delta: number | null };

function activityTimestamp(activity: StravaComparableActivity): number {
	const raw = activity.start_date ?? activity.start_date_local ?? activity.startDate ?? null;
	if (!raw) return 0;
	const ts = new Date(raw).getTime();
	return Number.isFinite(ts) ? ts : 0;
}

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function normalizeStravaActivities(raw: unknown[]): StravaComparableActivity[] {
	return raw
		.filter(isRecord)
		.map((item) => ({
			name: typeof item.name === "string" ? item.name : "Workout",
			type: typeof item.type === "string" ? item.type : "Workout",
			start_date: typeof item.start_date === "string" ? item.start_date : undefined,
			start_date_local: typeof item.start_date_local === "string" ? item.start_date_local : undefined,
			moving_time: typeof item.moving_time === "number" ? item.moving_time : undefined,
			distance: typeof item.distance === "number" ? item.distance : undefined,
			startDate: typeof item.startDate === "string" ? item.startDate : undefined,
			__source: "strava" as const,
		}))
		.filter((activity) => !!(activity.start_date || activity.start_date_local || activity.startDate));
}

function normalizeManualStatus(value: unknown): string {
	return String(value ?? "").trim().toLowerCase();
}

function includeInStatsByStatus(value: unknown): boolean {
	const status = normalizeManualStatus(value);
	if (!status) return true;
	return status === "approved" || status === "pending";
}

function mapManualActivities(rows: ManualActivityRow[]): StravaComparableActivity[] {
	return rows.map((row) => ({
		name: row.type || "Workout",
		type: row.type || "Workout",
		start_date: row.date,
		start_date_local: row.date,
		moving_time: row.duration_minutes ? row.duration_minutes * 60 : 0,
		distance: (row.distance_km ?? 0) * 1000,
		__source: "manual",
	}));
}

function mergeManualActivities(
	player: Player,
	manualByPlayer: Record<string, ManualActivityRow[]>,
	manualByUser: Record<string, ManualActivityRow[]>
): ManualActivityRow[] {
	const byPlayer = manualByPlayer[player.id] ?? [];
	const byUser = player.userId ? (manualByUser[player.userId] ?? []) : [];
	const merged: ManualActivityRow[] = [];
	const seen = new Set<string>();
	for (const item of [...byPlayer, ...byUser]) {
		if (seen.has(item.id)) continue;
		seen.add(item.id);
		merged.push(item);
	}
	return merged;
}

function filterSeasonActivities(
	activities: StravaComparableActivity[],
	seasonStart: string,
	seasonEndIso: string
): StravaComparableActivity[] {
	const start = new Date(seasonStart).getTime();
	const end = new Date(seasonEndIso).getTime();
	if (!Number.isFinite(start) || !Number.isFinite(end)) return [];
	return activities.filter((activity) => {
		const ts = activityTimestamp(activity);
		return ts >= start && ts <= end;
	});
}

function toPlayerFallback(player: Player): Player {
	return {
		...player,
		isStravaConnected: false,
	};
}

async function resolvePlayerTokens(player: Player, userIdByPlayer: Record<string, string | null>): Promise<StravaTokens | null> {
	const userId = userIdByPlayer[player.id] || null;
	if (userId) {
		const byUser = await getUserStravaTokens(userId);
		if (byUser) return byUser;
	}
	return getTokensForPlayer(player.id) ?? null;
}

async function loadHeartAdjustments(lobbyId: string, playerId: string): Promise<number> {
	const supabase = getServerSupabase();
	if (!supabase) return 0;
	try {
		const { data } = await supabase
			.from("heart_adjustments")
			.select("delta")
			.eq("lobby_id", lobbyId)
			.eq("target_player_id", playerId);
		return (data as HeartAdjustmentRow[] | null)?.reduce((sum, row) => {
			const delta = typeof row.delta === "number" ? row.delta : Number(row.delta ?? 0);
			return sum + (Number.isFinite(delta) ? delta : 0);
		}, 0) ?? 0;
	} catch {
		return 0;
	}
}

export async function prefetchManualActivities(lobbyId: string): Promise<{
	manualByPlayer: Record<string, ManualActivityRow[]>;
	manualByUser: Record<string, ManualActivityRow[]>;
}> {
	const supabase = getServerSupabase();
	const manualByPlayer: Record<string, ManualActivityRow[]> = {};
	const manualByUser: Record<string, ManualActivityRow[]> = {};
	if (!supabase) return { manualByPlayer, manualByUser };

	try {
		const { data } = await supabase
			.from("manual_activities")
			.select("*, player:player_id(user_id)")
			.eq("lobby_id", lobbyId)
			.order("date", { ascending: false })
			.limit(500);

		for (const row of (data ?? []) as ManualJoinedRow[]) {
			if (!includeInStatsByStatus(row.status)) continue;
			const playerId = row.player_id;
			if (!manualByPlayer[playerId]) manualByPlayer[playerId] = [];
			manualByPlayer[playerId].push(row);

			const linked =
				Array.isArray(row.player)
					? row.player[0]?.user_id ?? null
					: row.player?.user_id ?? null;
			if (!linked) continue;
			if (!manualByUser[linked]) manualByUser[linked] = [];
			manualByUser[linked].push(row);
		}
	} catch {
		// Ignore manual prefetch failures; per-player stats can still compute from Strava.
	}

	return { manualByPlayer, manualByUser };
}

export async function hydrateLobbyPlayers(input: {
	lobby: Lobby;
	lobbyId: string;
	players: Player[];
	userIdByPlayer: Record<string, string | null>;
	seasonStart?: string;
	seasonEnd: string;
	stage: LobbyStage;
	seasonStatus?: SeasonStatus;
	weeklyTarget: number;
	initialLives: number;
	requestTimezoneOffsetMinutes?: number;
	debugMode?: boolean;
	manualByPlayer: Record<string, ManualActivityRow[]>;
	manualByUser: Record<string, ManualActivityRow[]>;
}): Promise<{ updatedPlayers: Player[]; errors: PlayerError[]; debugRecords: PlayerDebugRecord[] }> {
	const errors: PlayerError[] = [];
	const debugRecords: PlayerDebugRecord[] = [];

	const updatedPlayers = await Promise.all(
		input.players.map(async (player) => {
			try {
				const tokens = await resolvePlayerTokens(player, input.userIdByPlayer);
				const stravaRaw = tokens ? await fetchRecentActivities(tokens.accessToken) : [];
				const stravaActivities = normalizeStravaActivities(stravaRaw);
				const manualActivities = mergeManualActivities(player, input.manualByPlayer, input.manualByUser);
				const manualComparable = mapManualActivities(manualActivities);
				const combined = [...manualComparable, ...stravaActivities].sort((a, b) => activityTimestamp(b) - activityTimestamp(a));

				if (input.debugMode) {
					debugRecords.push({
						playerId: player.id,
						playerName: player.name,
						manualCount: manualActivities.length,
						stravaCount: stravaActivities.length,
						combinedCount: combined.length,
					});
				}

				let totalWorkouts = 0;
				let currentStreak = 0;
				let longestStreak = 0;
				let averageWorkoutsPerWeek = 0;
				let livesRemaining = input.initialLives;
				let heartsTimeline: Player["heartsTimeline"] = [];
				let legacyWeeklyEvents: Array<{ weekStart: string; met: boolean; count: number }> = [];
				let seasonActivities: StravaComparableActivity[] = [];

				if (input.stage !== "PRE_STAGE") {
					const seasonCalcEndIso = input.stage === "COMPLETED" ? input.seasonEnd : new Date().toISOString();
					const seasonEndDate = new Date(seasonCalcEndIso);
					const seasonEndTs = seasonEndDate.getTime();
					const hasSeasonStart = !!input.seasonStart;

					if (hasSeasonStart) {
						seasonActivities = filterSeasonActivities(combined, input.seasonStart as string, seasonCalcEndIso);
					} else {
						seasonActivities = Number.isFinite(seasonEndTs)
							? combined.filter((activity) => activityTimestamp(activity) <= seasonEndTs)
							: combined;
					}

					const fallbackStartDate = (() => {
						const oldest = seasonActivities[seasonActivities.length - 1];
						const oldestTs = oldest ? activityTimestamp(oldest) : Number.NaN;
						return Number.isFinite(oldestTs) && oldestTs > 0 ? new Date(oldestTs) : new Date();
					})();
					const seasonStartDate = hasSeasonStart ? new Date(input.seasonStart as string) : fallbackStartDate;
					const twoDaysMs = 2 * 24 * 60 * 60 * 1000;
					const startForCalc =
						hasSeasonStart && seasonActivities.length === 0 && Date.now() - seasonStartDate.getTime() > twoDaysMs
							? new Date()
							: seasonStartDate;

					totalWorkouts = calculateTotalWorkouts(combined, input.seasonStart, seasonCalcEndIso);
					currentStreak = calculateStreakFromActivities(combined, input.seasonStart, seasonCalcEndIso, {
						timezoneOffsetMinutes: input.requestTimezoneOffsetMinutes,
					});
					longestStreak = calculateLongestStreak(combined, input.seasonStart, seasonCalcEndIso, {
						timezoneOffsetMinutes: input.requestTimezoneOffsetMinutes,
					});
					averageWorkoutsPerWeek = calculateAverageWorkoutsPerWeek(combined, input.seasonStart, seasonCalcEndIso);
					const weekly = computeWeeklyHearts(combined, startForCalc, {
						weeklyTarget: input.weeklyTarget,
						maxHearts: input.initialLives,
						seasonEnd: seasonEndDate,
					});
					livesRemaining = weekly.heartsRemaining;
					heartsTimeline = weekly.events;
					const nowTs = Date.now();
					legacyWeeklyEvents = weekly.events
						.filter((event) => new Date(event.weekStart).getTime() + 7 * 24 * 60 * 60 * 1000 <= nowTs)
						.map((event) => ({
							weekStart: event.weekStart,
							met: event.workouts >= input.weeklyTarget,
							count: event.workouts,
						}))
						.slice(-4);
				}

				const recentActivities = seasonActivities.slice(0, 5).map((activity) => {
					const summary = toActivitySummary(activity);
					return {
						...summary,
						source: (activity.__source === "manual" ? "manual" : "strava") as "manual" | "strava",
					};
				});

				const lastActivityRaw =
					seasonActivities[0]?.start_date ??
					seasonActivities[0]?.start_date_local ??
					seasonActivities[0]?.startDate ??
					null;
				const taunt = getDailyTaunts(lastActivityRaw ? new Date(lastActivityRaw) : null, currentStreak);

				const seasonStravaCount = seasonActivities.filter((activity) => activity.__source !== "manual").length;
				const seasonManualCount = seasonActivities.filter((activity) => activity.__source === "manual").length;

				const heartBonus = await loadHeartAdjustments(input.lobbyId, player.id);
				const clampedLives = clamp(livesRemaining + heartBonus, 0, input.initialLives);

				const result: Player = {
					...player,
					isStravaConnected: !!tokens,
					totalWorkouts,
					currentStreak,
					longestStreak,
					averageWorkoutsPerWeek: Number.isFinite(averageWorkoutsPerWeek)
						? Number(averageWorkoutsPerWeek.toFixed(2))
						: 0,
					livesRemaining: clampedLives,
						weeklyTarget: input.weeklyTarget,
						events: legacyWeeklyEvents,
						heartsTimeline,
						taunt,
					inSuddenDeath: player.inSuddenDeath,
					recentActivities,
					activityCounts: {
						total: seasonActivities.length,
						strava: seasonStravaCount,
						manual: seasonManualCount,
					},
				} as Player;

				if (input.lobby.suddenDeathEnabled && result.livesRemaining === 0 && player.inSuddenDeath) {
					result.livesRemaining = 1;
					result.inSuddenDeath = true;
				}

				return result;
			} catch (err) {
				logError({
					route: "LiveSnapshotService.hydrateLobbyPlayers",
					code: "PLAYER_HYDRATE_FAILED",
					err,
					lobbyId: input.lobbyId,
					extra: { playerId: player.id },
				});
				errors.push({ playerId: player.id, reason: "fetch_failed" });
				return toPlayerFallback(player);
			}
		})
	);

	return { updatedPlayers, errors, debugRecords };
}
