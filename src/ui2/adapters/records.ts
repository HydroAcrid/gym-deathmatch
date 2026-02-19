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
					longestStreak?: number;
					points?: number;
				}>;
				losers?: Array<{
					id: string;
					name: string;
					totalWorkouts: number;
					hearts?: number;
					currentStreak?: number;
					longestStreak?: number;
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
export type ArchivedSeasonStanding = {
	playerId: string;
	athleteName: string;
	avatarUrl?: string | null;
	rank: number;
	workouts: number;
	streak: number;
	longestStreak: number;
	hearts: number;
	points: number;
	result: string;
};
export type ArchivedSeasonRecord = {
	lobbyId: string;
	lobbyName: string;
	seasonNumber: number;
	mode?: string | null;
	stage?: string | null;
	status?: string | null;
	seasonStart?: string | null;
	seasonEnd?: string | null;
	finalPot: number;
	archivedAt?: string | null;
	summary?: unknown;
	standings: ArchivedSeasonStanding[];
};
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
	archivedAt?: string | null;
	standings: ArchivedSeasonStanding[];
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
	archivedSeasons?: ArchivedSeasonRecord[];
}): RecordsViewModel {
	const champMap = new Map<string, { titles: number; seasons: string[]; avatarUrl?: string | null }>();
	const pastList: PastSeason[] = [];
	const activeList: ActiveSeason[] = [];
	const archivedSeasonKeys = new Set<string>();
	const recordCandidates = {
		longestStreak: { holder: "", value: 0, lobby: "" },
		mostWorkouts: { holder: "", value: 0, lobby: "" },
		mostChampionships: { holder: "", value: 0 },
		mostPoints: { holder: "", value: 0, lobby: "" },
		mostConsistent: { holder: "", value: 0, lobby: "" },
	};

	for (const archived of input.archivedSeasons ?? []) {
		const seasonKey = `${archived.lobbyId}:${archived.seasonNumber}`;
		archivedSeasonKeys.add(seasonKey);
		const standings = [...(archived.standings ?? [])].sort((a, b) => {
			if (a.rank > 0 && b.rank > 0 && a.rank !== b.rank) return a.rank - b.rank;
			if (b.points !== a.points) return b.points - a.points;
			if (b.hearts !== a.hearts) return b.hearts - a.hearts;
			if (b.workouts !== a.workouts) return b.workouts - a.workouts;
			return a.athleteName.localeCompare(b.athleteName);
		});
		const championEntry = standings.find((row) => row.result === "CHAMPION") ?? standings[0];
		const champion = championEntry?.athleteName ?? "UNKNOWN";
		const totalWorkouts = standings.reduce((sum, row) => sum + row.workouts, 0);
		const summary = (archived.summary ?? null) as
			| {
					highlights?: {
						longestStreak?: { playerName: string; streak: number };
						mostWorkouts?: { playerName: string; count: number };
						mostConsistent?: { playerName: string; avgPerWeek: number };
					};
			  }
			| null;
		pastList.push({
			lobbyId: archived.lobbyId,
			lobbyName: archived.lobbyName,
			season: archived.seasonNumber,
			champion,
			startDate: formatDate(archived.seasonStart ?? null),
			endDate: formatDate(archived.seasonEnd ?? null),
			participants: standings.length,
			totalWorkouts,
			finalPot: archived.finalPot,
			highlights: summary?.highlights?.longestStreak
				? `${summary.highlights.longestStreak.playerName} achieved a ${summary.highlights.longestStreak.streak}-day streak`
				: summary?.highlights?.mostWorkouts
					? `${summary.highlights.mostWorkouts.playerName} logged ${summary.highlights.mostWorkouts.count} workouts`
					: "",
			archivedAt: archived.archivedAt ?? null,
			standings,
		});
		if (championEntry) {
			const existing = champMap.get(champion) ?? { titles: 0, seasons: [], avatarUrl: championEntry.avatarUrl ?? null };
			existing.titles++;
			existing.seasons.push(`${archived.lobbyName} S${archived.seasonNumber}`);
			if (!existing.avatarUrl && championEntry.avatarUrl) existing.avatarUrl = championEntry.avatarUrl;
			champMap.set(champion, existing);
		}
		for (const row of standings) {
			if (row.longestStreak > recordCandidates.longestStreak.value) {
				recordCandidates.longestStreak = { holder: row.athleteName, value: row.longestStreak, lobby: archived.lobbyName };
			}
			if (row.workouts > recordCandidates.mostWorkouts.value) {
				recordCandidates.mostWorkouts = { holder: row.athleteName, value: row.workouts, lobby: archived.lobbyName };
			}
			if (row.points > recordCandidates.mostPoints.value) {
				recordCandidates.mostPoints = { holder: row.athleteName, value: row.points, lobby: archived.lobbyName };
			}
		}
		if ((summary?.highlights?.mostConsistent?.avgPerWeek ?? 0) > recordCandidates.mostConsistent.value) {
			recordCandidates.mostConsistent = {
				holder: summary?.highlights?.mostConsistent?.playerName ?? "",
				value: summary?.highlights?.mostConsistent?.avgPerWeek ?? 0,
				lobby: archived.lobbyName,
			};
		}
	}

	for (const lobby of input.lobbies) {
		const live = input.liveData.get(lobby.id);
		if (!live?.lobby) continue;

		const players = live.lobby.players ?? [];
		const summary = live.lobby.seasonSummary;

			if (live.lobby.stage === "ACTIVE" && players.length > 0) {
				const sorted = [...players].sort(
					(a, b) =>
						calculatePoints({
							workouts: b.totalWorkouts,
							streak: b.currentStreak,
							longestStreak: b.longestStreak,
						}) -
						calculatePoints({
							workouts: a.totalWorkouts,
							streak: a.currentStreak,
							longestStreak: a.longestStreak,
						})
				);
				const totalW = players.reduce((s, p) => s + p.totalWorkouts, 0);
				const leader = sorted[0];
				const leaderPoints = leader
					? calculatePoints({
						workouts: leader.totalWorkouts,
						streak: leader.currentStreak,
						longestStreak: leader.longestStreak,
					})
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
			const seasonNumber = summary.seasonNumber ?? live.lobby.seasonNumber;
			const seasonKey = `${lobby.id}:${seasonNumber}`;
			if (archivedSeasonKeys.has(seasonKey)) {
				continue;
			}
			const winners = summary.winners ?? [];
			const champion = winners[0]?.name ?? "UNKNOWN";
			const seasonPlayers = [...(summary.winners ?? []), ...(summary.losers ?? [])];
			const totalW = seasonPlayers.reduce(
				(s, p) => s + (p.totalWorkouts ?? 0),
				0
			);
			const standings: ArchivedSeasonStanding[] = seasonPlayers
				.map((player) => ({
					playerId: player.id,
					athleteName: player.name,
					avatarUrl:
						(player as { avatarUrl?: string | null }).avatarUrl ??
						players.find((row) => row.name === player.name)?.avatarUrl ??
						null,
					rank: 0,
					workouts: player.totalWorkouts ?? 0,
					streak: player.currentStreak ?? 0,
					longestStreak: player.longestStreak ?? player.currentStreak ?? 0,
					hearts: player.hearts ?? 0,
					points:
						player.points ??
						calculatePoints({
							workouts: player.totalWorkouts ?? 0,
							streak: player.currentStreak ?? 0,
							longestStreak: player.longestStreak ?? player.currentStreak ?? 0,
						}),
					result: (summary.winners ?? []).some((winner) => winner.id === player.id) ? "CHAMPION" : "ELIMINATED",
				}))
				.sort((a, b) => {
					if (b.points !== a.points) return b.points - a.points;
					if (b.hearts !== a.hearts) return b.hearts - a.hearts;
					if (b.workouts !== a.workouts) return b.workouts - a.workouts;
					return a.athleteName.localeCompare(b.athleteName);
				})
				.map((row, idx) => ({ ...row, rank: idx + 1 }));
				const seasonTop = seasonPlayers.reduce(
					(best, player) => {
						const points =
							player.points ??
							calculatePoints({
								workouts: player.totalWorkouts ?? 0,
								streak: player.currentStreak ?? 0,
								longestStreak: player.longestStreak ?? player.currentStreak ?? 0,
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
				season: seasonNumber,
				champion,
				startDate: formatDate(lobby.season_start),
				endDate: formatDate(lobby.season_end),
				participants: standings.length,
				totalWorkouts: totalW,
				finalPot: summary.finalPot ?? lobby.cash_pool,
				highlights: summary.highlights?.longestStreak
					? `${summary.highlights.longestStreak.playerName} achieved a ${summary.highlights.longestStreak.streak}-day streak`
					: summary.highlights?.mostWorkouts
						? `${summary.highlights.mostWorkouts.playerName} logged ${summary.highlights.mostWorkouts.count} workouts`
						: "",
				archivedAt: null,
				standings,
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
				const points = calculatePoints({
					workouts: p.totalWorkouts,
					streak: p.currentStreak,
					longestStreak: p.longestStreak,
				});
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

	pastList.sort((a, b) => {
		const aTime = a.archivedAt ? Date.parse(a.archivedAt) : 0;
		const bTime = b.archivedAt ? Date.parse(b.archivedAt) : 0;
		if (aTime && bTime && aTime !== bTime) return bTime - aTime;
		if (a.season !== b.season) return b.season - a.season;
		return a.lobbyName.localeCompare(b.lobbyName);
	});

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
