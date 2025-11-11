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
import { computeEffectiveWeeklyAnte, weeksSince } from "@/lib/pot";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ lobbyId: string }> }) {
	// Optional debug mode: /live?debug=1 will include extra details and server logs
	const debugMode = (() => {
		try {
			const url = new URL(_req.url);
			return url.searchParams.get("debug") === "1";
		} catch { return false; }
	})();
	const { lobbyId } = await params;
	let lobby: Lobby | null = null;
	let rawStatus: "pending" | "scheduled" | "active" | "completed" | undefined;
	let rawSeasonNumber = 1;
	let potConfig = { initialPot: 0, weeklyAnte: 10, scalingEnabled: false, perPlayerBoost: 0 };
	let userIdByPlayer: Record<string, string | null> = {};
	const debugRecords: any[] = [];
	try {
		const supabase = getServerSupabase();
		if (supabase) {
			const { data: lrow } = await supabase.from("lobby").select("*").eq("id", lobbyId).single();
			if (lrow) {
				rawStatus = lrow.status ?? "active";
				rawSeasonNumber = lrow.season_number ?? 1;
				potConfig = {
					initialPot: (lrow.initial_pot as number) ?? 0,
					weeklyAnte: (lrow.weekly_ante as number) ?? 10,
					scalingEnabled: !!lrow.scaling_enabled,
					perPlayerBoost: (lrow.per_player_boost as number) ?? 0
				};
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
				// Season start fallback: if missing, assume 14 days ago so fresh manual posts are counted
				const seasonStartFallback = (() => {
					const d = new Date();
					d.setDate(d.getDate() - 14);
					return d.toISOString();
				})();
				lobby = {
					id: lobbyId,
					name: lrow.name,
					players,
					seasonNumber: rawSeasonNumber,
					seasonStart: lrow.season_start ?? seasonStartFallback,
					seasonEnd: lrow.season_end ?? new Date().toISOString(),
					cashPool: lrow.cash_pool ?? 0,
					initialPot: potConfig.initialPot,
					weeklyAnte: potConfig.weeklyAnte,
					scalingEnabled: potConfig.scalingEnabled,
					perPlayerBoost: potConfig.perPlayerBoost,
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

	// Prefetch approved manual activities for the whole lobby and index by player_id
	let manualByPlayer: Record<string, ManualActivityRow[]> = {};
	try {
		const supabase = getServerSupabase();
		if (supabase) {
			const { data } = await supabase
				.from("manual_activities")
				.select("*")
				.eq("lobby_id", lobby.id)
				.eq("status", "approved")
				.order("date", { ascending: false })
				.limit(500);
			for (const m of (data ?? []) as any[]) {
				const pid = m.player_id as string;
				if (!manualByPlayer[pid]) manualByPlayer[pid] = [];
				manualByPlayer[pid].push(m as any);
			}
		}
	} catch { /* ignore */ }

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
				// Manual activities (prefetched for lobby)
				let manual: ManualActivityRow[] = manualByPlayer[p.id] ?? [];

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
				if (debugMode) {
					debugRecords.push({
						playerId: p.id,
						playerName: p.name,
						manualCount: manual.length,
						stravaCount: (activities as any[]).length,
						combinedCount: (combined as any[]).length
					});
				}
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

				// Be robust: count all combined entries as total workouts (season bounds rarely matter for "now" views)
				const total = (combined as any[]).length;
				// For streaks, be forgiving and consider all combined activities (season-bound streaks are often confusing around start/end)
				const currentStreak = calculateStreakFromActivities(combined as any[]);
				const longestStreak = calculateLongestStreak(combined as any[]);
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
				let result = {
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
				// Apply heart adjustments
				try {
					const supabase = getServerSupabase();
					if (supabase) {
						const { data: adjs } = await supabase.from("heart_adjustments").select("target_player_id, delta").eq("lobby_id", lobby.id).eq("target_player_id", p.id);
						const bonus = (adjs ?? []).reduce((s: number, r: any) => s + (r.delta as number), 0);
						(result as any).livesRemaining = Math.max(0, Math.min(3, (result as any).livesRemaining + bonus));
					}
				} catch { /* ignore */ }
				return result;
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
						// manual again (use prefetched index)
						let manual: ManualActivityRow[] = manualByPlayer[p.id] ?? [];
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
						const twoDaysMs = 2 * 24 * 60 * 60 * 1000;
						const startForCalc2 = ((combined as any[]).length === 0 && (Date.now() - seasonStartDate2.getTime() > twoDaysMs))
							? new Date()
							: seasonStartDate2;
						const total = (combined as any[]).length;
						const currentStreak = calculateStreakFromActivities(combined as any[]);
						const longestStreak = calculateLongestStreak(combined as any[]);
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
						let result2 = {
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
						try {
							const supabase = getServerSupabase();
							if (supabase) {
								const { data: adjs } = await supabase.from("heart_adjustments").select("target_player_id, delta").eq("lobby_id", lobby.id).eq("target_player_id", p.id);
								const bonus = (adjs ?? []).reduce((s: number, r: any) => s + (r.delta as number), 0);
								(result2 as any).livesRemaining = Math.max(0, Math.min(3, (result2 as any).livesRemaining + bonus));
							}
						} catch { /* ignore */ }
						return result2;
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

	// Compute pot with simplified model: weeks elapsed * effective ante * playerCount + initial pot
	const playerCount = updatedPlayers.length;
	const weeks = weeksSince(lobby.seasonStart);
	const effectiveAnte = computeEffectiveWeeklyAnte({
		initialPot: lobby.initialPot ?? 0,
		weeklyAnte: lobby.weeklyAnte ?? 10,
		scalingEnabled: !!lobby.scalingEnabled,
		perPlayerBoost: lobby.perPlayerBoost ?? 0
	}, playerCount);
	// Upsert weekly contribution rows for completed weeks (simple model: logs latest week only if missing)
	try {
		const supabase = getServerSupabase();
		if (supabase && weeks > 0) {
			// Insert for each completed week (avoid race with unique index)
			const weekStarts: string[] = [];
			const start = new Date(lobby.seasonStart);
			for (let i = 0; i < weeks; i++) {
				const d = new Date(start.getTime() + i * 7 * 24 * 60 * 60 * 1000);
				weekStarts.push(d.toISOString());
			}
			// Find which are missing
			const { data: existing } = await supabase.from("weekly_pot_contributions").select("week_start").eq("lobby_id", lobby.id);
			const existingSet = new Set((existing ?? []).map((r: any) => new Date(r.week_start).toISOString().slice(0,10)));
			const survivors = updatedPlayers.filter(p => p.livesRemaining > 0).length;
			for (const ws of weekStarts) {
				const key = ws.slice(0,10);
				if (!existingSet.has(key)) {
					const amt = effectiveAnte * Math.max(survivors, 0);
					await supabase.from("weekly_pot_contributions").insert({
						lobby_id: lobby.id,
						week_start: ws,
						amount: amt,
						player_count: survivors
					});
				}
			}
		}
	} catch { /* ignore */ }
	// Sum contributions
	let contributionsSum = 0;
	try {
		const supabase = getServerSupabase();
		if (supabase) {
			const { data: sumRows } = await supabase.from("weekly_pot_contributions").select("amount").eq("lobby_id", lobby.id);
			contributionsSum = (sumRows ?? []).reduce((s: number, r: any) => s + (r.amount as number), 0);
		}
	} catch { /* ignore */ }
	const currentPot = (lobby.initialPot ?? 0) + contributionsSum;

	// KO detection - first KO ends season
	let koEvent: LiveLobbyResponse["koEvent"] | undefined;
	const loser = updatedPlayers.find(p => p.livesRemaining === 0);
	try {
		if (loser && rawStatus === "active") {
			const supabase = getServerSupabase();
			if (supabase) {
				await supabase.from("lobby").update({ status: "completed", season_end: new Date().toISOString() }).eq("id", lobby.id);
				await supabase.from("history_events").insert({
					lobby_id: lobby.id,
					actor_player_id: null,
					target_player_id: loser.id,
					type: "SEASON_KO",
					payload: { loserPlayerId: loser.id, currentPot, seasonNumber: lobby.seasonNumber }
				});
				rawStatus = "completed";
				koEvent = { loserPlayerId: loser.id, potAtKO: currentPot };
			}
		}
	} catch { /* ignore */ }

	const live: LiveLobbyResponse = {
		lobby: { ...lobby, players: updatedPlayers, cashPool: currentPot },
		fetchedAt: new Date().toISOString(),
		errors: errors.length ? errors : undefined,
		seasonStatus: rawStatus,
		koEvent
	};
	if (debugMode) {
		// Attach debug info and also log on the server
		(live as any).debug = {
			seasonStart: lobby.seasonStart,
			players: debugRecords
		};
		try {
			console.log("[/live debug]", JSON.stringify((live as any).debug, null, 2));
		} catch { /* ignore */ }
	}
	return NextResponse.json(live, { status: 200 });
}


