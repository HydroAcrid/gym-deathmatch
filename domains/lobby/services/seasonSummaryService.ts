import type { GameMode, Player, SeasonSummary } from "@/types/game";
import { calculatePoints } from "@/lib/points";

function toSummaryPlayer(player: Player) {
	return {
		id: player.id,
		name: player.name,
		avatarUrl: player.avatarUrl,
		hearts: player.livesRemaining,
		totalWorkouts: player.totalWorkouts,
		currentStreak: player.currentStreak,
		points: calculatePoints({ workouts: player.totalWorkouts, streak: player.currentStreak }),
	};
}

export function generateSeasonSummary(
	players: Player[],
	mode: GameMode,
	finalPot: number,
	seasonNumber: number
): SeasonSummary {
	let winners: SeasonSummary["winners"] = [];
	let losers: SeasonSummary["losers"] = [];

	if (mode === "MONEY_SURVIVAL") {
		winners = players.filter((p) => p.livesRemaining > 0).map(toSummaryPlayer);
		losers = players.filter((p) => p.livesRemaining === 0).map(toSummaryPlayer);
	} else if (mode === "MONEY_LAST_MAN") {
		const sorted = [...players].sort((a, b) => {
			if (b.livesRemaining !== a.livesRemaining) return b.livesRemaining - a.livesRemaining;
			return b.totalWorkouts - a.totalWorkouts;
		});
		const winner = sorted[0];
		if (winner && winner.livesRemaining > 0) {
			winners = [toSummaryPlayer(winner)];
		}
		losers = players.filter((p) => p.id !== winner?.id || p.livesRemaining === 0).map(toSummaryPlayer);
	} else {
		const sorted = [...players].sort((a, b) => {
			if (b.livesRemaining !== a.livesRemaining) return b.livesRemaining - a.livesRemaining;
			return b.totalWorkouts - a.totalWorkouts;
		});
		const maxHearts = sorted[0]?.livesRemaining ?? 0;
		winners = sorted.filter((p) => p.livesRemaining === maxHearts).map(toSummaryPlayer);
		losers = sorted.filter((p) => p.livesRemaining < maxHearts).map(toSummaryPlayer);
	}

	const highlights: SeasonSummary["highlights"] = {};
	if (players.length > 0) {
		const longestStreakPlayer = [...players]
			.filter((p) => Number.isFinite(p.longestStreak) && p.longestStreak > 0)
			.sort((a, b) => b.longestStreak - a.longestStreak)[0];
		if (longestStreakPlayer) {
			highlights.longestStreak = {
				playerId: longestStreakPlayer.id,
				playerName: longestStreakPlayer.name,
				streak: longestStreakPlayer.longestStreak,
			};
		}

		const mostWorkoutsPlayer = [...players]
			.filter((p) => Number.isFinite(p.totalWorkouts) && p.totalWorkouts > 0)
			.sort((a, b) => b.totalWorkouts - a.totalWorkouts)[0];
		if (mostWorkoutsPlayer) {
			highlights.mostWorkouts = {
				playerId: mostWorkoutsPlayer.id,
				playerName: mostWorkoutsPlayer.name,
				count: mostWorkoutsPlayer.totalWorkouts,
			};
		}

		const mostConsistentPlayer = [...players]
			.filter((p) => Number.isFinite(p.averageWorkoutsPerWeek) && p.averageWorkoutsPerWeek > 0)
			.sort((a, b) => b.averageWorkoutsPerWeek - a.averageWorkoutsPerWeek)[0];
		if (mostConsistentPlayer) {
			highlights.mostConsistent = {
				playerId: mostConsistentPlayer.id,
				playerName: mostConsistentPlayer.name,
				avgPerWeek: mostConsistentPlayer.averageWorkoutsPerWeek,
			};
		}
	}

	return {
		seasonNumber,
		winners,
		losers,
		finalPot,
		highlights,
	};
}

