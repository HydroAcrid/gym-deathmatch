import { calculatePoints } from "@/lib/points";

export type ProfileData = {
	displayName: string | null;
	avatarUrl: string | null;
	location: string | null;
	quip: string | null;
};

export type LobbyRow = {
	id: string;
	name: string;
	season_number: number;
	stage: string | null;
	status: string | null;
	season_start: string | null;
	season_end: string | null;
	cash_pool: number;
	created_at: string;
};

export type EnrichedPlayer = {
	id: string;
	name: string;
	userId?: string;
	totalWorkouts: number;
	currentStreak: number;
	longestStreak: number;
	livesRemaining: number;
	weeklyTarget: number;
	heartsTimeline?: Array<{ weekStart: string; workouts: number }>;
	recentActivities: Array<{
		id?: string;
		name?: string;
		caption?: string | null;
		type?: string;
		startDate?: string;
		date?: string;
		durationMinutes?: number;
		duration_minutes?: number;
		distanceKm?: number | null;
		distance_km?: number | null;
		source?: string;
	}>;
};

export type LiveLobby = {
	lobby: {
		id: string;
		name: string;
		seasonNumber: number;
		stage: string;
		initialLives: number;
		players: EnrichedPlayer[];
		seasonSummary?: {
			winners?: Array<{ id: string; name: string; totalWorkouts: number }>;
			losers?: Array<{ id: string; name: string }>;
			highlights?: {
				longestStreak?: { playerName: string; streak: number };
				mostWorkouts?: { playerName: string; count: number };
			};
		} | null;
	};
};

export type AggregatedStats = {
	totalWorkouts: number;
	currentStreak: number;
	longestStreak: number;
	seasonsPlayed: number;
	seasonsWon: number;
	currentHearts: number;
	maxHearts: number;
	lobbies: Array<{
		id: string;
		name: string;
		seasonNumber: number;
		stage: string;
		rank: number;
		workouts: number;
		result: string;
		points: number;
		currentStreak: number;
		longestStreak: number;
		hearts: number;
		weeklyProgress: number;
		weeklyTarget: number;
		seasonStart: string | null;
		seasonEnd: string | null;
	}>;
	recentWorkouts: Array<{
		id: string;
		title: string;
		type: string;
		duration: number;
		distance?: number | null;
		date: Date;
		source: string;
		lobbyName: string;
	}>;
};

export type ArchivedSeasonEntry = {
	lobbyId: string;
	lobbyName: string;
	seasonNumber: number;
	mode?: string | null;
	stage?: string | null;
	status?: string | null;
	seasonStart: string | null;
	seasonEnd: string | null;
	finalPot: number;
	archivedAt: string | null;
	rank: number;
	workouts: number;
	points: number;
	currentStreak: number;
	longestStreak: number;
	hearts: number;
	weeklyProgress: number;
	weeklyTarget: number;
	result: string;
};

export type ProfileSeasonRow = {
	id: string;
	name: string;
	seasonNumber: number;
	stage: string;
	rank: number;
	workouts: number;
	result: string;
	points: number;
	currentStreak: number;
	longestStreak: number;
	hearts: number;
	weeklyProgress: number;
	weeklyTarget: number;
	seasonStart: string | null;
	seasonEnd: string | null;
	source: "live" | "archive";
	finalPot?: number;
};

export function formatDuration(minutes: number): string {
	if (minutes < 60) return `${minutes}min`;
	const hrs = Math.floor(minutes / 60);
	const mins = minutes % 60;
	return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
}

export function formatTimeAgo(date: Date): string {
	if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "recently";
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffHours = Math.floor(diffMs / 3600000);
	const diffDays = Math.floor(diffMs / 86400000);
	if (diffHours < 1) return "just now";
	if (diffHours < 24) return `${diffHours}h ago`;
	if (diffDays < 30) return `${diffDays}d ago`;
	return `${Math.floor(diffDays / 30)}mo ago`;
}

export function getInitials(name: string): string {
	return name
		.split(/\s+/)
		.map((w) => w[0])
		.join("")
		.toUpperCase()
		.slice(0, 2);
}

export function formatDateShort(iso: string | null): string {
	if (!iso) return "—";
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return "—";
	return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function getProfileDisplayName(input: {
	profile: ProfileData | null;
	fullName: string | null | undefined;
}): string {
	return input.profile?.displayName || input.fullName || "ATHLETE";
}

export function buildProfileAggregatedStats(input: {
	userId: string | null | undefined;
	lobbies: LobbyRow[];
	liveData: Map<string, LiveLobby>;
}): AggregatedStats {
	const userId = input.userId;
	if (!userId) {
		return {
			totalWorkouts: 0,
			currentStreak: 0,
			longestStreak: 0,
			seasonsPlayed: 0,
			seasonsWon: 0,
			currentHearts: 0,
			maxHearts: 3,
			lobbies: [],
			recentWorkouts: [],
		};
	}

	let totalWorkouts = 0;
	let bestStreak = 0;
	let currentStreak = 0;
	let seasonsWon = 0;
	let currentHearts = 3;
	let maxHearts = 3;
	const lobbyEntries: AggregatedStats["lobbies"] = [];
	const allWorkouts: AggregatedStats["recentWorkouts"] = [];

	for (const lobby of input.lobbies) {
		const live = input.liveData.get(lobby.id);
		if (!live?.lobby?.players) continue;

		const me = live.lobby.players.find((p: EnrichedPlayer) => p.userId === userId);
		if (!me) continue;

		totalWorkouts += me.totalWorkouts;
		if (me.longestStreak > bestStreak) bestStreak = me.longestStreak;
		if (me.currentStreak > currentStreak) currentStreak = me.currentStreak;

		const summary = live.lobby.seasonSummary;
		const isWinner = summary?.winners?.some((w) => w.id === me.id) ?? false;
		if (isWinner) seasonsWon++;

		const sorted = [...live.lobby.players].sort((a, b) => b.totalWorkouts - a.totalWorkouts);
		const rank = sorted.findIndex((p) => p.userId === userId) + 1;
		const weeklyProgress = (() => {
			const timeline = Array.isArray(me.heartsTimeline) ? me.heartsTimeline : [];
			if (!timeline.length) return 0;
			return timeline[timeline.length - 1]?.workouts ?? 0;
		})();

		let result = "IN PROGRESS";
		if (live.lobby.stage === "COMPLETED") {
			result = isWinner ? "CHAMPION" : "ELIMINATED";
		}

		if (live.lobby.stage === "ACTIVE") {
			currentHearts = me.livesRemaining;
			maxHearts = live.lobby.initialLives || 3;
		}

		lobbyEntries.push({
			id: lobby.id,
			name: lobby.name,
			seasonNumber: live.lobby.seasonNumber,
			stage: live.lobby.stage,
			rank,
			workouts: me.totalWorkouts,
			result,
			points: calculatePoints({ workouts: me.totalWorkouts, streak: me.currentStreak ?? 0 }),
			currentStreak: me.currentStreak ?? 0,
			longestStreak: me.longestStreak ?? 0,
			hearts: me.livesRemaining ?? 0,
			weeklyProgress,
			weeklyTarget: me.weeklyTarget ?? 3,
			seasonStart: lobby.season_start ?? null,
			seasonEnd: lobby.season_end ?? null,
		});

		if (me.recentActivities) {
			for (let idx = 0; idx < me.recentActivities.length; idx++) {
				const act = me.recentActivities[idx];
				const rawDate = act.startDate || act.date;
				if (!rawDate) continue;
				const parsedDate = new Date(rawDate);
				if (Number.isNaN(parsedDate.getTime())) continue;
				const duration = Number(act.durationMinutes ?? act.duration_minutes ?? 0);
				const distanceRaw = act.distanceKm ?? act.distance_km;
				const distance = typeof distanceRaw === "number" ? distanceRaw : null;
				const title = act.caption || act.name || `${act.type || "Workout"} workout`;
				const stableId = act.id || `${lobby.id}:${rawDate}:${act.type || "workout"}:${idx}`;
				allWorkouts.push({
					id: stableId,
					title,
					type: act.type || "workout",
					duration: Number.isFinite(duration) ? duration : 0,
					distance,
					date: parsedDate,
					source: act.source || "manual",
					lobbyName: lobby.name,
				});
			}
		}
	}

	const dedupedWorkouts = Array.from(new Map(allWorkouts.map((w) => [w.id, w])).values());
	dedupedWorkouts.sort((a, b) => b.date.getTime() - a.date.getTime());

	return {
		totalWorkouts,
		currentStreak,
		longestStreak: bestStreak,
		seasonsPlayed: lobbyEntries.length,
		seasonsWon,
		currentHearts,
		maxHearts,
		lobbies: lobbyEntries,
		recentWorkouts: dedupedWorkouts.slice(0, 20),
	};
}

export function mergeProfileSeasonRows(
	liveRowsInput: AggregatedStats["lobbies"],
	archivedSeasons: ArchivedSeasonEntry[]
): ProfileSeasonRow[] {
	const liveRows: ProfileSeasonRow[] = liveRowsInput.map((s) => ({
		...s,
		source: "live",
	}));
	const archiveRows: ProfileSeasonRow[] = archivedSeasons.map((s) => ({
		id: s.lobbyId,
		name: s.lobbyName,
		seasonNumber: s.seasonNumber,
		stage: s.stage || "COMPLETED",
		rank: s.rank,
		workouts: s.workouts,
		result: s.result,
		points: s.points,
		currentStreak: s.currentStreak,
		longestStreak: s.longestStreak,
		hearts: s.hearts,
		weeklyProgress: s.weeklyProgress,
		weeklyTarget: s.weeklyTarget,
		seasonStart: s.seasonStart,
		seasonEnd: s.seasonEnd,
		source: "archive",
		finalPot: s.finalPot,
	}));

	const bySeason = new Map<string, ProfileSeasonRow>();
	for (const row of [...archiveRows, ...liveRows]) {
		bySeason.set(`${row.id}:${row.seasonNumber}`, row);
	}
	return Array.from(bySeason.values());
}

export function groupProfileSeasonRows(rows: ProfileSeasonRow[]) {
	const grouped = new Map<string, { lobbyId: string; lobbyName: string; seasons: ProfileSeasonRow[] }>();
	for (const row of rows) {
		const existing = grouped.get(row.id);
		if (existing) {
			existing.seasons.push(row);
		} else {
			grouped.set(row.id, {
				lobbyId: row.id,
				lobbyName: row.name,
				seasons: [row],
			});
		}
	}
	const groups = Array.from(grouped.values());
	for (const g of groups) {
		g.seasons.sort((a, b) => b.seasonNumber - a.seasonNumber);
	}
	groups.sort((a, b) => {
		const aLatest = a.seasons[0]?.seasonNumber ?? 0;
		const bLatest = b.seasons[0]?.seasonNumber ?? 0;
		return bLatest - aLatest;
	});
	return groups;
}
