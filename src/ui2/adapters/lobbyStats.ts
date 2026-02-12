import type { ActivitySummary } from "@/types/game";
import { summarizeTypesThisWeek } from "@/lib/messages";

export type LobbyStatsActivity = {
	type: string;
	startDate: string;
	durationMinutes: number;
	distanceKm: number;
};

export type LobbyStatsPlayer = {
	name: string;
	totalWorkouts: number;
	currentStreak: number;
	averageWorkoutsPerWeek: number;
	recentActivities?: LobbyStatsActivity[];
	activityCounts?: {
		total: number;
		strava: number;
		manual: number;
	};
};

export type LobbyStatsPayload = {
	seasonNumber: number;
	players: LobbyStatsPlayer[];
};

export type LobbyTotals = {
	totalWorkouts: number;
	combinedStreaks: number;
	mostConsistent: LobbyStatsPlayer | null;
};

export type LobbyPlayerDerivedStats = {
	totalMinutes: number;
	totalDistance: number;
	avgDuration: number;
	longest: LobbyStatsActivity | null;
	mostFrequentType: string;
	earliest: number | null;
	latest: number | null;
	variety: string;
};

function asNumber(value: unknown, fallback = 0): number {
	const n = Number(value);
	return Number.isFinite(n) ? n : fallback;
}

function toActivitySummary(activity: LobbyStatsActivity): ActivitySummary {
	const parsed = new Date(activity.startDate);
	const hour = Number.isNaN(parsed.getTime()) ? 12 : parsed.getHours();
	return {
		name: activity.type || "Workout",
		type: activity.type || "Other",
		startDate: activity.startDate,
		durationMinutes: asNumber(activity.durationMinutes),
		distanceKm: asNumber(activity.distanceKm),
		isMorning: hour < 12,
		isNight: hour >= 20 || hour < 5,
		source: "manual",
	};
}

export function toLobbyStatsPayload(data: unknown): LobbyStatsPayload {
	const root = typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {};
	const lobby = typeof root.lobby === "object" && root.lobby !== null ? (root.lobby as Record<string, unknown>) : {};
	const rawPlayers = Array.isArray(lobby.players) ? lobby.players : [];
	const players: LobbyStatsPlayer[] = rawPlayers.map((row) => {
		const src = typeof row === "object" && row !== null ? (row as Record<string, unknown>) : {};
		const rawActs = Array.isArray(src.recentActivities) ? src.recentActivities : [];
		const recentActivities: LobbyStatsActivity[] = rawActs
			.map((a) => {
				const act = typeof a === "object" && a !== null ? (a as Record<string, unknown>) : {};
				return {
					type: String(act.type ?? "Other"),
					startDate: String(act.startDate ?? ""),
					durationMinutes: asNumber(act.durationMinutes ?? 0),
					distanceKm: asNumber(act.distanceKm ?? 0),
				};
			})
			.filter((a) => a.startDate.length > 0);

		const activityCounts =
			typeof src.activityCounts === "object" && src.activityCounts !== null
				? {
						total: asNumber((src.activityCounts as Record<string, unknown>).total, 0),
						strava: asNumber((src.activityCounts as Record<string, unknown>).strava, 0),
						manual: asNumber((src.activityCounts as Record<string, unknown>).manual, 0),
					}
				: undefined;

		return {
			name: String(src.name ?? "Athlete"),
			totalWorkouts: asNumber(src.totalWorkouts, 0),
			currentStreak: asNumber(src.currentStreak, 0),
			averageWorkoutsPerWeek: asNumber(src.averageWorkoutsPerWeek, 0),
			recentActivities,
			activityCounts,
		};
	});

	return {
		seasonNumber: asNumber(lobby.seasonNumber, 1),
		players,
	};
}

export function calculateLobbyTotals(players: LobbyStatsPlayer[]): LobbyTotals {
	const totalWorkouts = players.reduce((sum, p) => sum + asNumber(p.totalWorkouts), 0);
	const combinedStreaks = players.reduce((sum, p) => sum + asNumber(p.currentStreak), 0);
	const mostConsistent = players.reduce<LobbyStatsPlayer | null>((best, player) => {
		if (!best) return player;
		return player.averageWorkoutsPerWeek > best.averageWorkoutsPerWeek ? player : best;
	}, null);
	return { totalWorkouts, combinedStreaks, mostConsistent };
}

export function calculateLobbyPlayerDerivedStats(player: LobbyStatsPlayer): LobbyPlayerDerivedStats {
	const activities = player.recentActivities ?? [];
	const totalMinutes = activities.reduce((sum, activity) => sum + asNumber(activity.durationMinutes), 0);
	const totalDistance = activities.reduce((sum, activity) => sum + asNumber(activity.distanceKm), 0);
	const avgDuration = activities.length ? Math.round((totalMinutes / activities.length) * 10) / 10 : 0;
	const longest = activities.reduce<LobbyStatsActivity | null>(
		(current, activity) => (activity.durationMinutes > (current?.durationMinutes ?? 0) ? activity : current),
		null
	);
	const typesCount = activities.reduce<Record<string, number>>((map, activity) => {
		const key = (activity.type || "Other").toLowerCase();
		map[key] = (map[key] ?? 0) + 1;
		return map;
	}, {});
	const mostFrequentType = Object.entries(typesCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "-";
	const earliest = activities.reduce<number | null>((minHour, activity) => {
		const hour = new Date(activity.startDate).getHours();
		if (!Number.isFinite(hour)) return minHour;
		if (minHour === null) return hour;
		return hour < minHour ? hour : minHour;
	}, null);
	const latest = activities.reduce<number | null>((maxHour, activity) => {
		const hour = new Date(activity.startDate).getHours();
		if (!Number.isFinite(hour)) return maxHour;
		if (maxHour === null) return hour;
		return hour > maxHour ? hour : maxHour;
	}, null);
	const variety = summarizeTypesThisWeek(activities.map(toActivitySummary));
	return {
		totalMinutes,
		totalDistance,
		avgDuration,
		longest,
		mostFrequentType,
		earliest,
		latest,
		variety,
	};
}

export function toTitleCase(input: string): string {
	if (!input) return input;
	return input.charAt(0).toUpperCase() + input.slice(1);
}
