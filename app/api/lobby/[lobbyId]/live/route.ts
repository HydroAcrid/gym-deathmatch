import { NextRequest, NextResponse } from "next/server";
import { getTokensForPlayer } from "@/lib/stravaStore";
import { fetchRecentActivities, refreshAccessToken, toActivitySummary } from "@/lib/strava";
import { calculateAverageWorkoutsPerWeek, calculateLongestStreak, calculateStreakFromActivities, calculateTotalWorkouts } from "@/lib/streaks";
import type { LiveLobbyResponse } from "@/types/api";
import { setTokensForPlayer } from "@/lib/stravaStore";
import { computeWeeklyHearts } from "@/lib/rules";
import { getServerSupabase } from "@/lib/supabaseClient";
import type { Lobby, Player } from "@/types/game";
import { getUserStravaTokens, upsertStravaTokens } from "@/lib/persistence";
import { getDailyTaunts } from "@/lib/funFacts";
import type { ManualActivityRow } from "@/types/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ lobbyId: string }> }) {
	const { lobbyId } = await params;
	let lobby: Lobby | null = null;
	let userIdByPlayer: Record<string, string | null> = {};
	try {
		const supabase = getServerSupabase();
		if (supabase) {
			const { data: lrow } = await supabase.from("lobby").select("*").eq("id", lobbyId).single();
			if (lrow) {
				// Create lobby from DB rows
				const { data: prows } = await supabase.from("player").select("*").eq("lobby_id", lobbyId);
				const players: Player[] = (prows ?? []).map((p: any) => ({
					id: p.id,
					name: p.name,
					avatarUrl: p.avatar_url ?? "",
					location: p.location ?? "",
					userId: p.user_id ?? undefined,
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
				// Build user map and overlay DB fields on mock lobby players as well
				const { data: prows2 } = await supabase.from("player").select("id,user_id,avatar_url,location,quip").eq("lobby_id", lobbyId);
				if (prows2 && prows2.length) {
					for (const pr of prows2) userIdByPlayer[pr.id as string] = (pr.user_id as string) ?? null;
					const byId = new Map<string, any>();
					for (const pr of prows2) byId.set(pr.id as string, pr);
					lobby.players = lobby.players.map((p) => {
						const dbp = byId.get(p.id);
						if (!dbp) return p;
						return {
							...p,
							avatarUrl: dbp.avatar_url ?? p.avatarUrl,
							location: dbp.location ?? p.location,
							quip: dbp.quip ?? p.quip,
							userId: dbp.user_id ?? p.userId
						};
					});
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
			// Prefer user-scoped tokens
			const userId = userIdByPlayer[p.id] || null;
			let tokens = null as any;
			if (userId) {
				tokens = await getUserStravaTokens(userId);
			}
			// Fallback to in-memory player tokens
			if (!tokens) {
				tokens = getTokensForPlayer(p.id);
			}
			try {
				// Fetch Strava activities if tokens exist
				let activities: any[] = [];
				if (tokens) {
					activities = await fetchRecentActivities(tokens.accessToken) as any[];
				}
				// Fetch manual activities from Supabase
				let manual: ManualActivityRow[] = [];
				try {
					const supabase = getServerSupabase();
					if (supabase) {
						const { data } = await supabase
							.from("manual_activities")
							.select("*")
							.eq("lobby_id", lobby.id)
							.eq("player_id", p.id)
							.order("date", { ascending: false })
							.limit(50);
						manual = (data ?? []) as any;
					}
				} catch { /* ignore */ }

				// Map manual to strava-like objects for metrics and to summaries for feed
				const manualAsStravaLike = (manual || []).map(m => ({
					start_date: m.date,
					start_date_local: m.date,
					moving_time: m.duration_minutes ? m.duration_minutes * 60 : 0,
					distance: (m.distance_km ?? 0) * 1000,
					type: m.type || "Workout",
					__source: "manual"
				}));

				const combined = [...manualAsStravaLike, ...(activities as any[])].sort((a,b) => {
					const ta = new Date(a.start_date || a.start_date_local || 0).getTime();
					const tb = new Date(b.start_date || b.start_date_local || 0).getTime();
					return tb - ta;
				});
				// If unauthorized, refresh once
				if (!combined || (combined as any).error) {
					// noop: fetchRecentActivities returns [] on error; below logic handles via thrown error path
				}
				// Prevent day-1 KO: if no activity yet and seasonStart is far in past, soft-clamp calculation start to "now"
				const hasAny = (combined as any[]).length > 0;
				const seasonStartDate = new Date(seasonStart);
				const twoDaysMs = 2 * 24 * 60 * 60 * 1000;
				const startForCalc = (!hasAny && (Date.now() - seasonStartDate.getTime() > twoDaysMs))
					? new Date()
					: seasonStartDate;

				const total = calculateTotalWorkouts(combined as any[], startForCalc.toISOString(), seasonEnd);
				const currentStreak = calculateStreakFromActivities(combined as any[], startForCalc.toISOString(), seasonEnd);
				const longestStreak = calculateLongestStreak(combined as any[], startForCalc.toISOString(), seasonEnd);
				const avg = calculateAverageWorkoutsPerWeek(combined as any[], startForCalc.toISOString(), seasonEnd);
				const weekly = computeWeeklyHearts(combined as any[], startForCalc, { weeklyTarget, maxHearts: 3, seasonEnd: new Date(seasonEnd) });
				// Back-compat feed events (met/count) derived from weekly events
				const events = weekly.events.map((e) => ({
					weekStart: e.weekStart,
					met: e.workouts >= weeklyTarget,
					count: e.workouts
				})).slice(-4); // keep recent few weeks to avoid noisy long histories
				const recentActivities = (combined as any[]).slice(0, 5).map(a => {
					const s = toActivitySummary(a);
					return { ...s, source: (a.__source === "manual" ? "manual" : "strava") as any };
				});
				const lastStart = (combined as any[])[0]?.start_date || (combined as any[])[0]?.start_date_local || null;
				const taunt = getDailyTaunts(lastStart ? new Date(lastStart) : null, currentStreak);
				return {
					...p,
					isStravaConnected: !!tokens,
					totalWorkouts: total,
					currentStreak,
					longestStreak,
					averageWorkoutsPerWeek: Number.isFinite(avg) ? Number(avg.toFixed(2)) : 0,
					livesRemaining: weekly.heartsRemaining,
					events, // keep for feed consumption
					heartsTimeline: weekly.events,
					weeklyTarget,
					recentActivities,
					activityCounts: {
						total: combined.length,
						strava: (activities as any[]).length,
						manual: manual.length
					},
					taunt
				};
			} catch (e: any) {
				// Attempt token refresh on 401/403
				if (e?.status === 401 || e?.status === 403) {
					try {
						const refreshed = await refreshAccessToken(tokens.refreshToken);
						if (userId) {
							// Keep user-scoped token chain up to date
							await (await import("@/lib/persistence")).upsertUserStravaTokens(userId, refreshed);
						}
						setTokensForPlayer(p.id, refreshed); // in-memory
						await upsertStravaTokens(p.id, refreshed); // legacy player-scoped
						const activities = await fetchRecentActivities(refreshed.accessToken);
						// manual again
						let manual: ManualActivityRow[] = [];
						try {
							const supabase = getServerSupabase();
							if (supabase) {
								const { data } = await supabase
									.from("manual_activities")
									.select("*")
									.eq("lobby_id", lobby.id)
									.eq("player_id", p.id)
									.order("date", { ascending: false })
									.limit(50);
								manual = (data ?? []) as any;
							}
						} catch { /* ignore */ }
						const manualAsStravaLike = (manual || []).map(m => ({
							start_date: m.date,
							start_date_local: m.date,
							moving_time: m.duration_minutes ? m.duration_minutes * 60 : 0,
							distance: (m.distance_km ?? 0) * 1000,
							type: m.type || "Workout",
							__source: "manual"
						}));
						const combined = [...manualAsStravaLike, ...(activities as any[])].sort((a,b) => {
							const ta = new Date(a.start_date || a.start_date_local || 0).getTime();
							const tb = new Date(b.start_date || b.start_date_local || 0).getTime();
							return tb - ta;
						});
						const seasonStartDate2 = new Date(seasonStart);
						const startForCalc2 = ((combined as any[]).length === 0 && (Date.now() - seasonStartDate2.getTime() > twoDaysMs))
							? new Date()
							: seasonStartDate2;
						const total = calculateTotalWorkouts(combined as any[], startForCalc2.toISOString(), seasonEnd);
						const currentStreak = calculateStreakFromActivities(combined as any[], startForCalc2.toISOString(), seasonEnd);
						const longestStreak = calculateLongestStreak(combined as any[], startForCalc2.toISOString(), seasonEnd);
						const avg = calculateAverageWorkoutsPerWeek(combined as any[], startForCalc2.toISOString(), seasonEnd);
						const weekly = computeWeeklyHearts(combined as any[], startForCalc2, { weeklyTarget, maxHearts: 3, seasonEnd: new Date(seasonEnd) });
						const events = weekly.events.map((e) => ({
							weekStart: e.weekStart,
							met: e.workouts >= weeklyTarget,
							count: e.workouts
						})).slice(-4);
						const recentActivities = (combined as any[]).slice(0, 5).map(a => {
							const s = toActivitySummary(a);
							return { ...s, source: (a.__source === "manual" ? "manual" : "strava") as any };
						});
						const lastStart = (combined as any[])[0]?.start_date || (combined as any[])[0]?.start_date_local || null;
						const taunt = getDailyTaunts(lastStart ? new Date(lastStart) : null, currentStreak);
						return {
							...p,
							isStravaConnected: true,
							totalWorkouts: total,
							currentStreak,
							longestStreak,
							averageWorkoutsPerWeek: Number.isFinite(avg) ? Number(avg.toFixed(2)) : 0,
							livesRemaining: weekly.heartsRemaining,
							events,
							heartsTimeline: weekly.events,
							weeklyTarget,
							recentActivities,
							activityCounts: {
								total: combined.length,
								strava: (activities as any[]).length,
								manual: manual.length
							},
							taunt
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


