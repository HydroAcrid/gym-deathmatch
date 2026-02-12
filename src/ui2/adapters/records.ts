import { calculatePoints } from "@/lib/points";
import { formatLocalDate } from "@/lib/datetime";

export type LobbyRow = {
	id: string;
	name: string;
	season_number: number;
	stage: string | null;
	status: string | null;
	season_start: string | null;
	season_end: string | null;
	cash_pool: number;
	season_summary?: unknown;
};

export type EnrichedPlayer = {
	id: string;
	name: string;
	avatarUrl?: string;
	userId?: string;
	totalWorkouts: number;
	currentStreak: number;
	longestStreak: number;
	livesRemaining: number;
	averageWorkoutsPerWeek: number;
};

export type LiveLobby = {
	lobby: {
		id: string;
		name: string;
		seasonNumber: number;
		stage: string;
		cashPool: number;
		initialLives: number;
		players: EnrichedPlayer[];
		seasonSummary?: {
			seasonNumber?: number;
			winners?: Array<{
				id: string;
				name: string;
				avatarUrl?: string;
				totalWorkouts: number;
				hearts: number;
				currentStreak?: number;
				points?: number;
			}>;
			losers?: Array<{
				id: string;
				name: string;
				totalWorkouts: number;
				hearts?: number;
				currentStreak?: number;
				points?: number;
			}>;
			finalPot?: number;
			highlights?: {
				longestStreak?: { playerName: string; streak: number };
				mostWorkouts?: { playerName: string; count: number };
				mostConsistent?: { playerName: string; avgPerWeek: number };
			};
		} | null;
	};
};

export type Champion = { name: string; titles: number; seasons: string[]; avatarUrl?: string | null };
export type AllTimeRecord = { record: string; holder: string; value: string; lobby: string };
export type PastSeason = {
	lobbyId: string;
	lobbyName: string;
	season: number;
	champion: string;
	startDate: string;
	endDate: string;
	participants: number;
	totalWorkouts: number;
	finalPot: number;
	highlights: string;
};
export type ActiveSeason = {
	lobbyId: string;
	lobbyName: string;
	seasonNumber: number;
	athleteCount: number;
	totalWorkouts: number;
	currentLeader: string;
	currentLeaderPoints: number;
};

export type RecordsViewModel = {
	champions: Champion[];
	records: AllTimeRecord[];
	pastSeasons: PastSeason[];
	activeSeasons: ActiveSeason[];
	hasData: boolean;
};

function formatDate(iso: string | null): string {
	if (!iso) return "—";
	return formatLocalDate(iso, { month: "short", day: "numeric", year: "numeric" }).toUpperCase();
}

export function buildRecordsViewModel(input: {
	lobbies: LobbyRow[];
	liveData: Map<string, LiveLobby>;
}): RecordsViewModel {
	const champMap = new Map<string, { titles: number; seasons: string[]; avatarUrl?: string | null }>();
	const pastList: PastSeason[] = [];
	const activeList: ActiveSeason[] = [];
	const recordCandidates = {
		longestStreak: { holder: "", value: 0, lobby: "" },
		mostWorkouts: { holder: "", value: 0, lobby: "" },
		mostChampionships: { holder: "", value: 0 },
		mostPoints: { holder: "", value: 0, lobby: "" },
		mostConsistent: { holder: "", value: 0, lobby: "" },
	};

	for (const lobby of input.lobbies) {
		const live = input.liveData.get(lobby.id);
		if (!live?.lobby) continue;

		const players = live.lobby.players ?? [];
		const summary = live.lobby.seasonSummary;

		if (live.lobby.stage === "ACTIVE" && players.length > 0) {
			const sorted = [...players].sort(
				(a, b) =>
					calculatePoints({ workouts: b.totalWorkouts, streak: b.currentStreak }) -
					calculatePoints({ workouts: a.totalWorkouts, streak: a.currentStreak })
			);
			const totalW = players.reduce((s, p) => s + p.totalWorkouts, 0);
			const leader = sorted[0];
			const leaderPoints = leader
				? calculatePoints({ workouts: leader.totalWorkouts, streak: leader.currentStreak })
				: 0;
			activeList.push({
				lobbyId: lobby.id,
				lobbyName: lobby.name,
				seasonNumber: live.lobby.seasonNumber,
				athleteCount: players.length,
				totalWorkouts: totalW,
				currentLeader: leader?.name ?? "—",
				currentLeaderPoints: leaderPoints,
			});
		}

		if (live.lobby.stage === "COMPLETED" && summary) {
			const winners = summary.winners ?? [];
			const champion = winners[0]?.name ?? "UNKNOWN";
			const totalW = [...(summary.winners ?? []), ...(summary.losers ?? [])].reduce(
				(s, p) => s + (p.totalWorkouts ?? 0),
				0
			);
			const seasonPlayers = [...(summary.winners ?? []), ...(summary.losers ?? [])];
			const seasonTop = seasonPlayers.reduce(
				(best, player) => {
					const points =
						player.points ??
						calculatePoints({
							workouts: player.totalWorkouts ?? 0,
							streak: player.currentStreak ?? 0,
						});
					return points > best.points ? { name: player.name, points } : best;
				},
				{ name: "", points: 0 }
			);
			if (seasonTop.points > recordCandidates.mostPoints.value) {
				recordCandidates.mostPoints = {
					holder: seasonTop.name,
					value: seasonTop.points,
					lobby: lobby.name,
				};
			}

			pastList.push({
				lobbyId: lobby.id,
				lobbyName: lobby.name,
				season: summary.seasonNumber ?? live.lobby.seasonNumber,
				champion,
				startDate: formatDate(lobby.season_start),
				endDate: formatDate(lobby.season_end),
				participants: players.length,
				totalWorkouts: totalW,
				finalPot: summary.finalPot ?? lobby.cash_pool,
				highlights: summary.highlights?.longestStreak
					? `${summary.highlights.longestStreak.playerName} achieved a ${summary.highlights.longestStreak.streak}-day streak`
					: summary.highlights?.mostWorkouts
						? `${summary.highlights.mostWorkouts.playerName} logged ${summary.highlights.mostWorkouts.count} workouts`
						: "",
			});

			for (const w of winners) {
				const fallbackAvatar = players.find((p) => p.name === w.name && p.avatarUrl)?.avatarUrl ?? null;
				const existing = champMap.get(w.name) ?? {
					titles: 0,
					seasons: [],
					avatarUrl: w.avatarUrl ?? fallbackAvatar,
				};
				existing.titles++;
				existing.seasons.push(`${lobby.name} S${summary.seasonNumber ?? live.lobby.seasonNumber}`);
				if (!existing.avatarUrl) existing.avatarUrl = w.avatarUrl ?? fallbackAvatar;
				champMap.set(w.name, existing);
			}

			if (summary.highlights?.longestStreak) {
				const s = summary.highlights.longestStreak;
				if (s.streak > recordCandidates.longestStreak.value) {
					recordCandidates.longestStreak = { holder: s.playerName, value: s.streak, lobby: lobby.name };
				}
			}
			if (summary.highlights?.mostWorkouts) {
				const m = summary.highlights.mostWorkouts;
				if (m.count > recordCandidates.mostWorkouts.value) {
					recordCandidates.mostWorkouts = { holder: m.playerName, value: m.count, lobby: lobby.name };
				}
			}
			if (summary.highlights?.mostConsistent) {
				const c = summary.highlights.mostConsistent;
				if (c.avgPerWeek > recordCandidates.mostConsistent.value) {
					recordCandidates.mostConsistent = { holder: c.playerName, value: c.avgPerWeek, lobby: lobby.name };
				}
			}
		}

		for (const p of players) {
			const points = calculatePoints({ workouts: p.totalWorkouts, streak: p.currentStreak });
			if (p.longestStreak > recordCandidates.longestStreak.value) {
				recordCandidates.longestStreak = { holder: p.name, value: p.longestStreak, lobby: lobby.name };
			}
			if (p.totalWorkouts > recordCandidates.mostWorkouts.value) {
				recordCandidates.mostWorkouts = { holder: p.name, value: p.totalWorkouts, lobby: lobby.name };
			}
			if (points > recordCandidates.mostPoints.value) {
				recordCandidates.mostPoints = { holder: p.name, value: points, lobby: lobby.name };
			}
		}
	}

	for (const [name, data] of champMap) {
		if (data.titles > recordCandidates.mostChampionships.value) {
			recordCandidates.mostChampionships = { holder: name, value: data.titles };
		}
	}

	const recordsList: AllTimeRecord[] = [];
	if (recordCandidates.longestStreak.value > 0) {
		recordsList.push({
			record: "LONGEST STREAK",
			holder: recordCandidates.longestStreak.holder,
			value: `${recordCandidates.longestStreak.value} DAYS`,
			lobby: recordCandidates.longestStreak.lobby,
		});
	}
	if (recordCandidates.mostWorkouts.value > 0) {
		recordsList.push({
			record: "MOST WORKOUTS",
			holder: recordCandidates.mostWorkouts.holder,
			value: `${recordCandidates.mostWorkouts.value}`,
			lobby: recordCandidates.mostWorkouts.lobby,
		});
	}
	if (recordCandidates.mostPoints.value > 0) {
		recordsList.push({
			record: "MOST POINTS",
			holder: recordCandidates.mostPoints.holder,
			value: `${recordCandidates.mostPoints.value}`,
			lobby: recordCandidates.mostPoints.lobby,
		});
	}
	if (recordCandidates.mostChampionships.value > 0) {
		recordsList.push({
			record: "MOST CHAMPIONSHIPS",
			holder: recordCandidates.mostChampionships.holder,
			value: `${recordCandidates.mostChampionships.value}`,
			lobby: "ALL TIME",
		});
	}
	if (recordCandidates.mostConsistent.value > 0) {
		recordsList.push({
			record: "MOST CONSISTENT",
			holder: recordCandidates.mostConsistent.holder,
			value: `${recordCandidates.mostConsistent.value.toFixed(1)}/WK`,
			lobby: recordCandidates.mostConsistent.lobby,
		});
	}

	const championsList: Champion[] = Array.from(champMap.entries())
		.map(([name, data]) => ({
			name,
			titles: data.titles,
			seasons: data.seasons,
			avatarUrl: data.avatarUrl ?? null,
		}))
		.sort((a, b) => b.titles - a.titles);

	pastList.sort((a, b) => b.season - a.season);

	const hasData =
		championsList.length > 0 ||
		recordsList.length > 0 ||
		pastList.length > 0 ||
		activeList.length > 0;

	return {
		champions: championsList,
		records: recordsList,
		pastSeasons: pastList,
		activeSeasons: activeList,
		hasData,
	};
}
