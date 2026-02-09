import { NextRequest, NextResponse } from "next/server";
import { getTokensForPlayer } from "@/lib/stravaStore";
import { fetchRecentActivities, refreshAccessToken, toActivitySummary } from "@/lib/strava";
import { calculateAverageWorkoutsPerWeek, calculateLongestStreak, calculateStreakFromActivities, calculateTotalWorkouts } from "@/lib/streaks";
import type { LiveLobbyResponse } from "@/types/api";
import { setTokensForPlayer } from "@/lib/stravaStore";
import { computeWeeklyHearts } from "@/lib/rules";
import { getServerSupabase } from "@/lib/supabaseClient";
import type { Lobby, Player, SeasonSummary, GameMode, LobbyStage } from "@/types/game";
import { getUserStravaTokens, upsertStravaTokens } from "@/lib/persistence";
import { getDailyTaunts } from "@/lib/funFacts";
import type { ManualActivityRow } from "@/types/db";
import { computeEffectiveWeeklyAnte, weeksSince } from "@/lib/pot";
import { logError } from "@/lib/logger";

// Generate season summary when season completes
function generateSeasonSummary(
	players: Player[],
	mode: GameMode,
	finalPot: number,
	seasonNumber: number
): SeasonSummary {
	// Determine winners and losers based on mode
	let winners: SeasonSummary["winners"] = [];
	let losers: SeasonSummary["losers"] = [];
	
	if (mode === "MONEY_SURVIVAL") {
		// Winners: all players with hearts > 0
		// Losers: players with 0 hearts
		winners = players
			.filter(p => p.livesRemaining > 0)
			.map(p => ({
				id: p.id,
				name: p.name,
				avatarUrl: p.avatarUrl,
				hearts: p.livesRemaining,
				totalWorkouts: p.totalWorkouts
			}));
		losers = players
			.filter(p => p.livesRemaining === 0)
			.map(p => ({
				id: p.id,
				name: p.name,
				avatarUrl: p.avatarUrl,
				hearts: p.livesRemaining,
				totalWorkouts: p.totalWorkouts
			}));
	} else if (mode === "MONEY_LAST_MAN") {
		// Winner: player with most hearts (or highest totalWorkouts if tie)
		const sorted = [...players].sort((a, b) => {
			if (b.livesRemaining !== a.livesRemaining) return b.livesRemaining - a.livesRemaining;
			return b.totalWorkouts - a.totalWorkouts;
		});
		const winner = sorted[0];
		if (winner && winner.livesRemaining > 0) {
			winners = [{
				id: winner.id,
				name: winner.name,
				avatarUrl: winner.avatarUrl,
				hearts: winner.livesRemaining,
				totalWorkouts: winner.totalWorkouts
			}];
		}
		losers = players
			.filter(p => p.id !== winner?.id || p.livesRemaining === 0)
			.map(p => ({
				id: p.id,
				name: p.name,
				avatarUrl: p.avatarUrl,
				hearts: p.livesRemaining,
				totalWorkouts: p.totalWorkouts
			}));
	} else {
		// Challenge modes: winners = most hearts, losers = least hearts
		const sorted = [...players].sort((a, b) => {
			if (b.livesRemaining !== a.livesRemaining) return b.livesRemaining - a.livesRemaining;
			return b.totalWorkouts - a.totalWorkouts;
		});
		const maxHearts = sorted[0]?.livesRemaining ?? 0;
		winners = sorted
			.filter(p => p.livesRemaining === maxHearts)
			.map(p => ({
				id: p.id,
				name: p.name,
				avatarUrl: p.avatarUrl,
				hearts: p.livesRemaining,
				totalWorkouts: p.totalWorkouts
			}));
		losers = sorted
			.filter(p => p.livesRemaining < maxHearts)
			.map(p => ({
				id: p.id,
				name: p.name,
				avatarUrl: p.avatarUrl,
				hearts: p.livesRemaining,
				totalWorkouts: p.totalWorkouts
			}));
	}
	
	// Calculate highlights (only if we have players with valid stats)
	const highlights: SeasonSummary["highlights"] = {};
	
	if (players.length > 0) {
		// Longest streak
		const longestStreakPlayer = [...players]
			.filter(p => typeof p.longestStreak === "number" && !isNaN(p.longestStreak) && p.longestStreak > 0)
			.sort((a, b) => b.longestStreak - a.longestStreak)[0];
		if (longestStreakPlayer) {
			highlights.longestStreak = {
				playerId: longestStreakPlayer.id,
				playerName: longestStreakPlayer.name,
				streak: longestStreakPlayer.longestStreak
			};
		}
		
		// Most workouts
		const mostWorkoutsPlayer = [...players]
			.filter(p => typeof p.totalWorkouts === "number" && !isNaN(p.totalWorkouts) && p.totalWorkouts > 0)
			.sort((a, b) => b.totalWorkouts - a.totalWorkouts)[0];
		if (mostWorkoutsPlayer) {
			highlights.mostWorkouts = {
				playerId: mostWorkoutsPlayer.id,
				playerName: mostWorkoutsPlayer.name,
				count: mostWorkoutsPlayer.totalWorkouts
			};
		}
		
		// Most consistent (highest average workouts per week)
		const mostConsistentPlayer = [...players]
			.filter(p => typeof p.averageWorkoutsPerWeek === "number" && !isNaN(p.averageWorkoutsPerWeek) && p.averageWorkoutsPerWeek > 0)
			.sort((a, b) => b.averageWorkoutsPerWeek - a.averageWorkoutsPerWeek)[0];
		if (mostConsistentPlayer) {
			highlights.mostConsistent = {
				playerId: mostConsistentPlayer.id,
				playerName: mostConsistentPlayer.name,
				avgPerWeek: mostConsistentPlayer.averageWorkoutsPerWeek
			};
		}
	}
	
	return {
		seasonNumber,
		winners,
		losers,
		finalPot,
		highlights
	};
}

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
	let rawStatus: "pending" | "scheduled" | "transition_spin" | "active" | "completed" | undefined;
	let rawStage: LobbyStage | null = null;
	let rawSeasonNumber = 1;
	let potConfig = { initialPot: 0, weeklyAnte: 10, scalingEnabled: false, perPlayerBoost: 0 };
	// Initialize userIdByPlayer outside try block to ensure it's always available
	const userIdByPlayer: Record<string, string | null> = {};
	const debugRecords: any[] = [];
	try {
		const supabase = getServerSupabase();
		if (supabase) {
			const { data: lrow } = await supabase.from("lobby").select("*").eq("id", lobbyId).single();
			if (lrow) {
				rawStatus = lrow.status ?? "active";
				rawStage = (lrow.stage as LobbyStage) || null;
				rawSeasonNumber = lrow.season_number ?? 1;
				potConfig = {
					initialPot: (lrow.initial_pot as number) ?? 0,
					weeklyAnte: (lrow.weekly_ante as number) ?? 10,
					scalingEnabled: !!lrow.scaling_enabled,
					perPlayerBoost: (lrow.per_player_boost as number) ?? 0
				};
				// Create lobby from DB rows
				const { data: prows } = await supabase.from("player").select("*").eq("lobby_id", lobbyId);
				// Ready states by user
				const readyByUser: Record<string, boolean> = {};
				try {
					const { data: rrows } = await supabase.from("user_ready_states").select("user_id,ready").eq("lobby_id", lobbyId);
					for (const r of (rrows ?? []) as any[]) {
						readyByUser[r.user_id as string] = !!r.ready;
					}
				} catch { /* ignore */ }
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
					isStravaConnected: false,
					inSuddenDeath: !!p.sudden_death,
					ready: p.user_id ? !!readyByUser[p.user_id] : false
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
					seasonEnd: (() => {
						// Sensible fallback if not configured: two weeks after season start or now+14d
						if (lrow.season_end) return lrow.season_end as string;
						const start = lrow.season_start ? new Date(lrow.season_start as string).getTime() : Date.now();
						return new Date(start + 14 * 24 * 60 * 60 * 1000).toISOString();
					})(),
					cashPool: lrow.cash_pool ?? 0,
					initialPot: potConfig.initialPot,
					weeklyAnte: potConfig.weeklyAnte,
					scalingEnabled: potConfig.scalingEnabled,
					perPlayerBoost: potConfig.perPlayerBoost,
					weeklyTarget: lrow.weekly_target ?? 3,
					initialLives: lrow.initial_lives ?? 3,
					ownerId: lrow.owner_id ?? undefined,
					mode: (lrow.mode as any) || "MONEY_SURVIVAL",
					suddenDeathEnabled: !!lrow.sudden_death_enabled,
					stage: rawStage || (rawStatus === "completed" ? "COMPLETED" : rawStatus === "active" || rawStatus === "transition_spin" ? "ACTIVE" : "PRE_STAGE"),
					seasonSummary: lrow.season_summary ? (lrow.season_summary as any) : null
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
				// Auto-transition when scheduled time arrives
				try {
					if ((lrow.status === "scheduled") && lrow.scheduled_start) {
						const now = Date.now();
						const sched = new Date(lrow.scheduled_start as string).getTime();
						if (sched <= now) {
							const mode = (lrow.mode as string) || "MONEY_SURVIVAL";
							if (String(mode).startsWith("CHALLENGE_ROULETTE")) {
								await supabase.from("lobby").update({ 
									status: "transition_spin", 
									scheduled_start: null,
									stage: "ACTIVE" // Set stage when transitioning from scheduled
								}).eq("id", lobbyId);
								rawStatus = "transition_spin";
							} else {
								await supabase.from("lobby").update({ 
									status: "active", 
									scheduled_start: null, 
									season_start: new Date().toISOString(),
									stage: "ACTIVE" // Set stage when transitioning from scheduled
								}).eq("id", lobbyId);
								rawStatus = "active";
							}
						}
					}
				} catch { /* ignore */ }
			}
		}
	} catch (e) {
		logError({ route: "GET /api/lobby/[id]/live", code: "LOBBY_LOAD_FAILED", err: e, lobbyId });
	}
	if (!lobby) {
		return NextResponse.json({ error: "Lobby not found" }, { status: 404 });
	}

	const errors: NonNullable<LiveLobbyResponse["errors"]> = [];
	const seasonStart = lobby.seasonStart;
	const seasonEnd = lobby.seasonEnd;
	const weeklyTarget = lobby.weeklyTarget ?? 3;
	const initialLives = lobby.initialLives ?? 3;

	// Initialize currentStage once at the top level, before Promise.all
	// This ensures it's available throughout the function and avoids TDZ issues
	let currentStage: LobbyStage = rawStage || (rawStatus === "completed" ? "COMPLETED" : rawStatus === "active" || rawStatus === "transition_spin" ? "ACTIVE" : "PRE_STAGE");

	// If season end has passed and stage is ACTIVE, mark as COMPLETED (but we'll generate summary later after player stats)
	let seasonSummary: SeasonSummary | null = null;
	try {
		const now = Date.now();
		const seasonEndTime = new Date(seasonEnd).getTime();
		
		if (currentStage === "ACTIVE" && seasonEndTime <= now) {
			const supabase = getServerSupabase();
			if (supabase) {
				// Generate season summary before updating (we need current player stats)
				// We'll generate it after player stats are computed, so we'll handle this later
				// For now, just mark the stage
				await supabase.from("lobby").update({ 
					status: "completed",
					stage: "COMPLETED"
				}).eq("id", lobby.id);
				rawStatus = "completed";
				rawStage = "COMPLETED";
				currentStage = "COMPLETED"; // Update the variable so rest of code sees the new value
			}
		}
	} catch { /* ignore */ }

	// Prefetch approved and pending manual activities for the whole lobby and index by player_id
	// Pending activities still count toward streaks (they're being challenged but not rejected yet)
	let manualByPlayer: Record<string, ManualActivityRow[]> = {};
	try {
		const supabase = getServerSupabase();
		if (supabase) {
			const { data } = await supabase
				.from("manual_activities")
				.select("*")
				.eq("lobby_id", lobby.id)
				.in("status", ["approved", "pending"])
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
				// In PRE_STAGE, seasonStart is null - use initial hearts and don't calculate from activities
				// Only calculate hearts when season has actually started
				let weekly: any;
				let total = 0;
				let currentStreak = 0;
				let longestStreak = 0;
				let avg = 0;
				
				if (!seasonStart || currentStage === "PRE_STAGE") {
					// PRE_STAGE: Use initial hearts, no activity-based calculation
					weekly = {
						heartsRemaining: lobby.initialLives ?? 3,
						weeksEvaluated: 0,
						events: []
					};
					total = (combined as any[]).length;
					currentStreak = calculateStreakFromActivities(combined as any[]);
					longestStreak = calculateLongestStreak(combined as any[]);
					avg = 0; // No average until season starts
				} else {
					// ACTIVE or COMPLETED: Calculate hearts from activities
					// Prevent day-1 KO: if no activity yet and seasonStart is far in past, soft-clamp calculation start to "now"
					const hasAny = (combined as any[]).length > 0;
					const seasonStartDate = new Date(seasonStart);
					const twoDaysMs = 2 * 24 * 60 * 60 * 1000;
					const startForCalc = (!hasAny && (Date.now() - seasonStartDate.getTime() > twoDaysMs))
						? new Date()
						: seasonStartDate;

					// Be robust: count all combined entries as total workouts (season bounds rarely matter for "now" views)
					total = (combined as any[]).length;
					// For streaks, be forgiving and consider all combined activities (season-bound streaks are often confusing around start/end)
					currentStreak = calculateStreakFromActivities(combined as any[]);
					longestStreak = calculateLongestStreak(combined as any[]);
					avg = calculateAverageWorkoutsPerWeek(combined as any[], startForCalc.toISOString(), seasonEnd);
					// Evaluate hearts up to "now" (not full season) so players aren't penalized for future weeks
					weekly = computeWeeklyHearts(combined as any[], startForCalc, { weeklyTarget, maxHearts: 3, seasonEnd: new Date() });
				}
				// Back-compat feed events (met/count) derived from weekly events
				const nowTs = Date.now();
				const events = (weekly.events || [])
					// Only include fully completed weeks (avoid premature "missed" on current week)
					.filter((e: any) => new Date(e.weekStart).getTime() + 7 * 24 * 60 * 60 * 1000 <= nowTs)
					.map((e: any) => ({
						weekStart: e.weekStart,
						met: e.workouts >= weeklyTarget,
						count: e.workouts
					}))
					.slice(-4); // keep recent few weeks to avoid noisy long histories
				// Challenge: cumulative punishments — log missing weeks
				try {
					const mode = (lobby as any).mode || "MONEY_SURVIVAL";
					if (mode === "CHALLENGE_CUMULATIVE" && userId) {
						const supabase = getServerSupabase();
						if (supabase) {
							for (const ev of weekly.events) {
								const weekEnd = new Date(new Date(ev.weekStart).getTime() + 7 * 24 * 60 * 60 * 1000);
								if (weekEnd.getTime() > nowTs) continue; // only completed weeks
								if (ev.workouts >= weeklyTarget) continue; // only failed weeks
								// week index since season start
								const start = new Date(seasonStart).getTime();
								const wi = Math.max(1, Math.floor((new Date(ev.weekStart).getTime() - start) / (7 * 24 * 60 * 60 * 1000)) + 1);
								// fetch active punishment for that week
								const { data: pun } = await supabase.from("lobby_punishments").select("id,text").eq("lobby_id", lobby.id).eq("week", wi).eq("active", true).maybeSingle();
								const text = (pun?.text as string) || "Arena punishment";
								// insert if not exists
								const { data: exists } = await supabase
									.from("user_punishments")
									.select("id")
									.eq("user_id", userId)
									.eq("lobby_id", lobby.id)
									.eq("week", wi)
									.limit(1);
								if (!exists || exists.length === 0) {
									await supabase.from("user_punishments").insert({ user_id: userId, lobby_id: lobby.id, week: wi, text, resolved: false });
								}
							}
						}
					}
				} catch { /* ignore */ }
				// Skip logging weekly target met/missed into history to avoid feed spam
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
					taunt,
					inSuddenDeath: p.inSuddenDeath
				};
					// Sudden death revive: if enabled and player opted-in, show them at 1 heart but mark inSuddenDeath
					if ((lobby as any).suddenDeathEnabled && (result as any).livesRemaining === 0 && p.inSuddenDeath) {
						(result as any).livesRemaining = 1;
						(result as any).inSuddenDeath = true;
					}
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
						// In PRE_STAGE, use initial hearts (same logic as above)
						let weekly: any;
						let total = 0;
						let currentStreak = 0;
						let longestStreak = 0;
						let avg = 0;
						
						if (!seasonStart || currentStage === "PRE_STAGE") {
							weekly = {
								heartsRemaining: lobby.initialLives ?? 3,
								weeksEvaluated: 0,
								events: []
							};
							total = (combined as any[]).length;
							currentStreak = calculateStreakFromActivities(combined as any[]);
							longestStreak = calculateLongestStreak(combined as any[]);
							avg = 0;
						} else {
							const seasonStartDate2 = new Date(seasonStart);
							const twoDaysMs = 2 * 24 * 60 * 60 * 1000;
							const startForCalc2 = ((combined as any[]).length === 0 && (Date.now() - seasonStartDate2.getTime() > twoDaysMs))
								? new Date()
								: seasonStartDate2;
							total = (combined as any[]).length;
							currentStreak = calculateStreakFromActivities(combined as any[]);
							longestStreak = calculateLongestStreak(combined as any[]);
							avg = calculateAverageWorkoutsPerWeek(combined as any[], startForCalc2.toISOString(), seasonEnd);
							weekly = computeWeeklyHearts(combined as any[], startForCalc2, { weeklyTarget, maxHearts: 3, seasonEnd: new Date() });
						}
						const nowTs2 = Date.now();
						const events = (weekly.events || [])
							.filter((e: any) => new Date(e.weekStart).getTime() + 7 * 24 * 60 * 60 * 1000 <= nowTs2)
							.map((e: any) => ({
								weekStart: e.weekStart,
								met: e.workouts >= weeklyTarget,
								count: e.workouts
							}))
							.slice(-4);
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
						logError({ route: "GET /api/lobby/[id]/live", code: "STRAVA_REFRESH_FAILED", err: refreshErr, lobbyId, extra: { playerId: p.id } });
						errors.push({ playerId: p.id, reason: "refresh_failed" });
						return { ...p, isStravaConnected: false };
					}
				}
				logError({ route: "GET /api/lobby/[id]/live", code: "PLAYER_FETCH_FAILED", err: e, lobbyId, extra: { playerId: p.id } });
				errors.push({ playerId: p.id, reason: "fetch_failed" });
				return { ...p, isStravaConnected: false };
			}
		})
	);

	// Compute pot only for Money modes
	const mode = (lobby as any).mode || "MONEY_SURVIVAL";
	let currentPot = 0;
	if (String(mode).startsWith("MONEY_")) {
		const playerCount = updatedPlayers.length;
		const weeks = weeksSince(lobby.seasonStart);
		const effectiveAnte = computeEffectiveWeeklyAnte({
			initialPot: lobby.initialPot ?? 0,
			weeklyAnte: lobby.weeklyAnte ?? 10,
			scalingEnabled: !!lobby.scalingEnabled,
			perPlayerBoost: lobby.perPlayerBoost ?? 0
		}, playerCount);
		const supabase = getServerSupabase();
		const newContributions: number[] = [];
		try {
			if (supabase && weeks > 0) {
				const weekStarts: string[] = [];
				// Normalize season start to midnight (start of day) for consistent week calculations
				// This ensures weeks are calculated from the start of the day, not a specific time
				const startDate = new Date(lobby.seasonStart);
				const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
				for (let i = 0; i < weeks; i++) {
					// Calculate each week start as 7 days from season start (not calendar weeks)
					const d = new Date(start.getTime() + i * 7 * 24 * 60 * 60 * 1000);
					weekStarts.push(d.toISOString());
				}
				const { data: existing } = await supabase.from("weekly_pot_contributions").select("week_start").eq("lobby_id", lobby.id);
				// Compare by date only (YYYY-MM-DD) to handle any time component differences
				const existingSet = new Set((existing ?? []).map((r: any) => {
					const d = new Date(r.week_start);
					return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
				}));
				const survivors = updatedPlayers.filter(p => p.livesRemaining > 0).length;
				for (const ws of weekStarts) {
					const wsDate = new Date(ws);
					const key = `${wsDate.getFullYear()}-${String(wsDate.getMonth() + 1).padStart(2, '0')}-${String(wsDate.getDate()).padStart(2, '0')}`;
					if (!existingSet.has(key)) {
						const amt = effectiveAnte * Math.max(survivors, 0);
						await supabase.from("weekly_pot_contributions").insert({
							lobby_id: lobby.id,
							week_start: ws,
							amount: amt,
							player_count: survivors
						});
						newContributions.push(amt);
					}
				}
			}
		} catch { /* ignore */ }
		let contributionsSum = 0;
		try {
			if (supabase) {
				const { data: sumRows } = await supabase.from("weekly_pot_contributions").select("amount").eq("lobby_id", lobby.id);
				contributionsSum = (sumRows ?? []).reduce((s: number, r: any) => s + (r.amount as number), 0);
			}
		} catch { /* ignore */ }
		currentPot = (lobby.initialPot ?? 0) + contributionsSum;
		if (Number.isFinite((lobby as any).cashPool)) {
			currentPot = (lobby as any).cashPool as number;
		}
		if (supabase && newContributions.length) {
			try { await supabase.from("lobby").update({ cash_pool: currentPot }).eq("id", lobby.id); } catch { /* ignore */ }
		}
	}

	// KO detection depends on mode
	let koEvent: LiveLobbyResponse["koEvent"] | undefined;
	const aliveNonSD = updatedPlayers.filter(p => p.livesRemaining > 0 && !p.inSuddenDeath);
	const anyZero = updatedPlayers.find(p => p.livesRemaining === 0 && !p.inSuddenDeath);
	try {
		if (rawStatus === "active") {
			if (mode === "MONEY_SURVIVAL") {
				const loser = anyZero;
				if (loser) {
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
			} else if (mode === "MONEY_LAST_MAN") {
				// Season ends only when exactly one non-sudden-death player remains alive
				if (aliveNonSD.length === 1) {
					const winner = aliveNonSD[0];
					const supabase = getServerSupabase();
					if (supabase) {
						await supabase.from("lobby").update({ status: "completed", season_end: new Date().toISOString() }).eq("id", lobby.id);
						await supabase.from("history_events").insert({
							lobby_id: lobby.id,
							actor_player_id: null,
							target_player_id: winner.id,
							type: "SEASON_WINNER",
							payload: { winnerPlayerId: winner.id, currentPot, seasonNumber: lobby.seasonNumber }
						});
						rawStatus = "completed";
						koEvent = { loserPlayerId: "", winnerPlayerId: winner.id, potAtKO: currentPot };
					}
				}
			}
		}
	} catch { /* ignore */ }

	// Check if season end has passed and stage is ACTIVE - transition to COMPLETED
	// This must happen AFTER player stats are computed so we can generate accurate summary
	// Note: We already checked this earlier, but we check again here in case the transition didn't happen
	// (e.g., if the earlier check failed or if we're in a different code path)
	const now = Date.now();
	const seasonEndTime = new Date(seasonEnd).getTime();
	
	if (currentStage === "ACTIVE" && seasonEndTime <= now) {
		// Transition to COMPLETED
		try {
			const supabase = getServerSupabase();
			if (supabase) {
				await supabase.from("lobby").update({ 
					status: "completed",
					stage: "COMPLETED"
				}).eq("id", lobby.id);
				rawStatus = "completed";
				rawStage = "COMPLETED";
				currentStage = "COMPLETED"; // Update the variable
			}
		} catch (e) {
			logError({ route: "GET /api/lobby/[id]/live", code: "STAGE_TRANSITION_FAILED", err: e, lobbyId });
		}
	}

	// Generate season summary if stage is COMPLETED and we don't have one yet
	if (currentStage === "COMPLETED" && !lobby.seasonSummary) {
		// Generate summary with current player stats
		seasonSummary = generateSeasonSummary(updatedPlayers, mode as GameMode, currentPot, lobby.seasonNumber);
		// Save to database
		try {
			const supabase = getServerSupabase();
			if (supabase) {
				await supabase.from("lobby").update({ 
					season_summary: seasonSummary as any
				}).eq("id", lobby.id);
			}
		} catch (e) {
			logError({ route: "GET /api/lobby/[id]/live", code: "SEASON_SUMMARY_SAVE_FAILED", err: e, lobbyId });
		}
	} else if (lobby.seasonSummary) {
		// Use existing summary from DB
		seasonSummary = lobby.seasonSummary;
	}

	const live: LiveLobbyResponse = {
		lobby: { ...lobby, players: updatedPlayers, cashPool: currentPot, stage: currentStage, seasonSummary },
		fetchedAt: new Date().toISOString(),
		errors: errors.length ? errors : undefined,
		seasonStatus: rawStatus,
		stage: currentStage,
		seasonSummary,
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
