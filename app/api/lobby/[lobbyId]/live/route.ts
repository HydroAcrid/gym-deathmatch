import { NextRequest, NextResponse } from "next/server";
import { getLobbyById } from "@/lib/lobbies";
import { getTokensForPlayer } from "@/lib/stravaStore";
import { fetchRecentActivities, refreshAccessToken } from "@/lib/strava";
import { calculateAverageWorkoutsPerWeek, calculateLongestStreak, calculateStreakFromActivities, calculateTotalWorkouts } from "@/lib/streaks";
import type { LiveLobbyResponse } from "@/types/api";
import { setTokensForPlayer } from "@/lib/stravaStore";
import { upsertStravaTokens } from "@/lib/persistence";
import { computeLivesAndEvents } from "@/lib/rules";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ lobbyId: string }> }) {
	const { lobbyId } = await params;
	const lobby = getLobbyById(lobbyId);
	if (!lobby) {
		return NextResponse.json({ error: "Lobby not found" }, { status: 404 });
	}

	const errors: NonNullable<LiveLobbyResponse["errors"]> = [];
	const seasonStart = lobby.seasonStart;
	const seasonEnd = lobby.seasonEnd;
	const weeklyTarget = lobby.weeklyTarget ?? 3;
	const initialLives = lobby.initialLives ?? 3;

	const updatedPlayers = await Promise.all(
		lobby.players.map(async (p) => {
			const tokens = getTokensForPlayer(p.id);
			if (!tokens) {
				return { ...p, isStravaConnected: false };
			}
			try {
				let activities = await fetchRecentActivities(tokens.accessToken);
				// If unauthorized, refresh once
				if (!activities || (activities as any).error) {
					// noop: fetchRecentActivities returns [] on error; below logic handles via thrown error path
				}
				const total = calculateTotalWorkouts(activities, seasonStart, seasonEnd);
				const currentStreak = calculateStreakFromActivities(activities, seasonStart, seasonEnd);
				const longestStreak = calculateLongestStreak(activities, seasonStart, seasonEnd);
				const avg = calculateAverageWorkoutsPerWeek(activities, seasonStart, seasonEnd);
				const { livesRemaining, events } = computeLivesAndEvents(activities as any[], { seasonStart, seasonEnd, weeklyTarget, initialLives });
				return {
					...p,
					isStravaConnected: true,
					totalWorkouts: total,
					currentStreak,
					longestStreak,
					averageWorkoutsPerWeek: Number.isFinite(avg) ? Number(avg.toFixed(2)) : 0,
					livesRemaining,
					events
				};
			} catch (e: any) {
				// Attempt token refresh on 401/403
				if (e?.status === 401 || e?.status === 403) {
					try {
						const refreshed = await refreshAccessToken(tokens.refreshToken);
						setTokensForPlayer(p.id, refreshed);
						await upsertStravaTokens(p.id, refreshed);
						const activities = await fetchRecentActivities(refreshed.accessToken);
						const total = calculateTotalWorkouts(activities, seasonStart, seasonEnd);
						const currentStreak = calculateStreakFromActivities(activities, seasonStart, seasonEnd);
						const longestStreak = calculateLongestStreak(activities, seasonStart, seasonEnd);
						const avg = calculateAverageWorkoutsPerWeek(activities, seasonStart, seasonEnd);
						const { livesRemaining, events } = computeLivesAndEvents(activities as any[], { seasonStart, seasonEnd, weeklyTarget, initialLives });
						return {
							...p,
							isStravaConnected: true,
							totalWorkouts: total,
							currentStreak,
							longestStreak,
							averageWorkoutsPerWeek: Number.isFinite(avg) ? Number(avg.toFixed(2)) : 0,
							livesRemaining,
							events
						};
					} catch (refreshErr) {
						console.error("refresh failed for player", p.id, refreshErr);
						errors.push({ playerId: p.id, reason: "refresh_failed" });
						return { ...p, isStravaConnected: false };
					}
				}
				console.error("Live fetch error for player", p.id, e);
				errors.push({ playerId: p.id, reason: "fetch_failed" });
				return { ...p, isStravaConnected: false };
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


