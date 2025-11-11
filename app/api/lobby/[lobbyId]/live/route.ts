import { NextRequest, NextResponse } from "next/server";
import { getLobbyById } from "@/lib/lobbies";
import { getTokensForPlayer } from "@/lib/stravaStore";
import { fetchRecentActivities, refreshAccessToken, toActivitySummary } from "@/lib/strava";
import { calculateAverageWorkoutsPerWeek, calculateLongestStreak, calculateStreakFromActivities, calculateTotalWorkouts } from "@/lib/streaks";
import type { LiveLobbyResponse } from "@/types/api";
import { setTokensForPlayer } from "@/lib/stravaStore";
import { upsertStravaTokens } from "@/lib/persistence";
import { computeLivesAndEvents } from "@/lib/rules";
import { getServerSupabase } from "@/lib/supabaseClient";
import type { Lobby, Player } from "@/types/game";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ lobbyId: string }> }) {
	const { lobbyId } = await params;
	let lobby = getLobbyById(lobbyId);
	// Hydrate lobby config from Supabase if available (and also support lobbies that don't exist in mock)
	try {
		const supabase = getServerSupabase();
		if (supabase) {
			const { data: lrow } = await supabase.from("lobby").select("*").eq("id", lobbyId).single();
			if (lrow) {
				if (lobby) {
					// Merge config onto mock lobby
					lobby = {
						...lobby,
						seasonNumber: lrow.season_number ?? lobby.seasonNumber,
						seasonStart: lrow.season_start ?? lobby.seasonStart,
						seasonEnd: lrow.season_end ?? lobby.seasonEnd,
						cashPool: lrow.cash_pool ?? lobby.cashPool,
						weeklyTarget: lrow.weekly_target ?? lobby.weeklyTarget,
						initialLives: lrow.initial_lives ?? lobby.initialLives,
						ownerId: lrow.owner_id ?? lobby.ownerId
					};
					// Overlay player fields (e.g., avatar) from DB if present
					const { data: prows } = await supabase.from("player").select("*").eq("lobby_id", lobbyId);
					if (prows && prows.length) {
						const byId = new Map<string, any>();
						for (const pr of prows) byId.set(pr.id, pr);
						lobby.players = lobby.players.map((p) => {
							const dbp = byId.get(p.id);
							if (!dbp) return p;
							return {
								...p,
								avatarUrl: dbp.avatar_url ?? p.avatarUrl,
								location: dbp.location ?? p.location,
								quip: dbp.quip ?? p.quip
							};
						});
					}
				} else {
					// Create lobby from DB rows
					const { data: prows } = await supabase.from("player").select("*").eq("lobby_id", lobbyId);
					const players: Player[] = (prows ?? []).map((p: any) => ({
						id: p.id,
						name: p.name,
						avatarUrl: p.avatar_url ?? "",
						location: p.location ?? "",
						currentStreak: 0,
						longestStreak: 0,
						livesRemaining: (lrow.initial_lives as number) ?? 3,
						totalWorkouts: 0,
						averageWorkoutsPerWeek: 0,
						quip: p.quip ?? "",
						isStravaConnected: false
					}));
					lobby = {
						id: lobbyId,
						name: lrow.name,
						players,
						seasonNumber: lrow.season_number ?? 1,
						seasonStart: lrow.season_start ?? new Date().toISOString(),
						seasonEnd: lrow.season_end ?? new Date().toISOString(),
						cashPool: lrow.cash_pool ?? 0,
						weeklyTarget: lrow.weekly_target ?? 3,
						initialLives: lrow.initial_lives ?? 3,
						ownerId: lrow.owner_id ?? undefined
					} as Lobby;
				}
			}
		}
	} catch { /* ignore */ }
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
				const recentActivities = (activities as any[]).slice(0, 5).map(toActivitySummary);
				return {
					...p,
					isStravaConnected: true,
					totalWorkouts: total,
					currentStreak,
					longestStreak,
					averageWorkoutsPerWeek: Number.isFinite(avg) ? Number(avg.toFixed(2)) : 0,
					livesRemaining,
					events,
					recentActivities
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
						const recentActivities = (activities as any[]).slice(0, 5).map(toActivitySummary);
						return {
							...p,
							isStravaConnected: true,
							totalWorkouts: total,
							currentStreak,
							longestStreak,
							averageWorkoutsPerWeek: Number.isFinite(avg) ? Number(avg.toFixed(2)) : 0,
							livesRemaining,
							events,
							recentActivities
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


