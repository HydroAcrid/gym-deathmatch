import { NextRequest, NextResponse } from "next/server";
import { getLobbyById } from "@/lib/lobbies";
import { getTokensForPlayer } from "@/lib/stravaStore";
import { fetchRecentActivities } from "@/lib/strava";
import { calculateAverageWorkoutsPerWeek, calculateLongestStreak, calculateStreakFromActivities, calculateTotalWorkouts } from "@/lib/streaks";
import type { LiveLobbyResponse } from "@/types/api";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ lobbyId: string }> }) {
	const { lobbyId } = await params;
	const lobby = getLobbyById(lobbyId);
	if (!lobby) {
		return NextResponse.json({ error: "Lobby not found" }, { status: 404 });
	}

	const errors: NonNullable<LiveLobbyResponse["errors"]> = [];
	const seasonStart = lobby.seasonStart;
	const seasonEnd = lobby.seasonEnd;

	const updatedPlayers = await Promise.all(
		lobby.players.map(async (p) => {
			const tokens = getTokensForPlayer(p.id);
			if (!tokens) {
				return { ...p, isStravaConnected: false };
			}
			try {
				const activities = await fetchRecentActivities(tokens.accessToken);
				const total = calculateTotalWorkouts(activities, seasonStart, seasonEnd);
				const currentStreak = calculateStreakFromActivities(activities, seasonStart, seasonEnd);
				const longestStreak = calculateLongestStreak(activities, seasonStart, seasonEnd);
				const avg = calculateAverageWorkoutsPerWeek(activities, seasonStart, seasonEnd);
				return {
					...p,
					isStravaConnected: true,
					totalWorkouts: total,
					currentStreak,
					longestStreak,
					averageWorkoutsPerWeek: Number.isFinite(avg) ? Number(avg.toFixed(2)) : 0
				};
			} catch (e) {
				console.error("Live fetch error for player", p.id, e);
				errors.push({ playerId: p.id, reason: "fetch_failed" });
				return { ...p, isStravaConnected: true };
			}
		})
	);

	const live: LiveLobbyResponse = {
		lobby: { ...lobby, players: updatedPlayers },
		fetchedAt: new Date().toISOString(),
		errors: errors.length ? errors : undefined
	};
	return NextResponse.json(live, { status: 200 });
}


