import { getTokensForPlayer } from "@/lib/stravaStore";
import { fetchRecentActivities, refreshAccessToken, toActivitySummary } from "@/lib/strava";
import { calculateAverageWorkoutsPerWeek, calculateLongestStreak, calculateStreakFromActivities, calculateTotalWorkouts } from "@/lib/streaks";
import type { LiveLobbyResponse } from "@/types/api";
import { computeWeeklyHearts } from "@/lib/rules";
import { getServerSupabase } from "@/lib/supabaseClient";
import type { Lobby, Player, SeasonSummary, GameMode, LobbyStage } from "@/types/game";
import { getUserStravaTokens } from "@/lib/persistence";
import { getDailyTaunts } from "@/lib/funFacts";
import type { ManualActivityRow } from "@/types/db";
import { computeEffectiveWeeklyAnte, weeksSince } from "@/lib/pot";
import { logError } from "@/lib/logger";
import { calculatePoints } from "@/lib/points";

export function readRequestTimezoneOffsetMinutes(req: Request): number | undefined {
	const raw = req.headers.get("x-timezone-offset-minutes");
	if (!raw) return undefined;
	const parsed = Number(raw);
	if (!Number.isFinite(parsed)) return undefined;
	const rounded = Math.round(parsed);
	if (rounded < -840 || rounded > 840) return undefined;
	return rounded;
}

// Generate season summary when season completes
function generateSeasonSummary(
	players: Player[],
	mode: GameMode,
	finalPot: number,
	seasonNumber: number
): SeasonSummary {
	const toSummaryPlayer = (p: Player) => ({
		id: p.id,
		name: p.name,
		avatarUrl: p.avatarUrl,
		hearts: p.livesRemaining,
		totalWorkouts: p.totalWorkouts,
		currentStreak: p.currentStreak,
		points: calculatePoints({ workouts: p.totalWorkouts, streak: p.currentStreak })
	});

	// Determine winners and losers based on mode
	let winners: SeasonSummary["winners"] = [];
	let losers: SeasonSummary["losers"] = [];
	
	if (mode === "MONEY_SURVIVAL") {
		// Winners: all players with hearts > 0
		// Losers: players with 0 hearts
		winners = players.filter(p => p.livesRemaining > 0).map(toSummaryPlayer);
		losers = players.filter(p => p.livesRemaining === 0).map(toSummaryPlayer);
	} else if (mode === "MONEY_LAST_MAN") {
		// Winner: player with most hearts (or highest totalWorkouts if tie)
		const sorted = [...players].sort((a, b) => {
			if (b.livesRemaining !== a.livesRemaining) return b.livesRemaining - a.livesRemaining;
			return b.totalWorkouts - a.totalWorkouts;
		});
		const winner = sorted[0];
		if (winner && winner.livesRemaining > 0) {
			winners = [toSummaryPlayer(winner)];
		}
		losers = players
			.filter(p => p.id !== winner?.id || p.livesRemaining === 0)
			.map(toSummaryPlayer);
	} else {
		// Challenge modes: winners = most hearts, losers = least hearts
		const sorted = [...players].sort((a, b) => {
			if (b.livesRemaining !== a.livesRemaining) return b.livesRemaining - a.livesRemaining;
			return b.totalWorkouts - a.totalWorkouts;
		});
		const maxHearts = sorted[0]?.livesRemaining ?? 0;
		winners = sorted
			.filter(p => p.livesRemaining === maxHearts)
			.map(toSummaryPlayer);
		losers = sorted
			.filter(p => p.livesRemaining < maxHearts)
			.map(toSummaryPlayer);
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

export async function buildLiveLobbyResponse(opts: {
	lobbyId: string;
	debugMode?: boolean;
	requestTimezoneOffsetMinutes?: number;
}): Promise<LiveLobbyResponse | null> {
	const { lobbyId, debugMode = false, requestTimezoneOffsetMinutes } = opts;
	const supabase = getServerSupabase();
	if (!supabase) return null;
	let lobby: Lobby | null = null;
	let seasonStartRaw: string | null = null;
	let rawStatus: "pending" | "scheduled" | "transition_spin" | "active" | "completed" | undefined;
	let rawStage: LobbyStage | null = null;
	let rawSeasonNumber = 1;
	let potConfig = { initialPot: 0, weeklyAnte: 10, scalingEnabled: false, perPlayerBoost: 0 };
	// Initialize userIdByPlayer outside try block to ensure it's always available
	const userIdByPlayer: Record<string, string | null> = {};
	const debugRecords: any[] = [];
	try {
		if (supabase) {
			const { data: lrow } = await supabase.from("lobby").select("*").eq("id", lobbyId).single();
			if (lrow) {
				seasonStartRaw = (lrow.season_start as string | null) ?? null;
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
				const displaySeasonStart =
					(lrow.season_start as string | null) ??
					(lrow.scheduled_start as string | null) ??
					new Date().toISOString();
					lobby = {
						id: lobbyId,
						name: lrow.name,
					players,
					seasonNumber: rawSeasonNumber,
					seasonStart: displaySeasonStart,
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
					ownerUserId: lrow.owner_user_id ?? undefined,
					mode: (lrow.mode as any) || "MONEY_SURVIVAL",
					suddenDeathEnabled: !!lrow.sudden_death_enabled,
					challengeSettings: (lrow.challenge_settings as any) ?? null,
						inviteEnabled: (lrow as any).invite_enabled !== false,
						inviteExpiresAt: ((lrow as any).invite_expires_at as string | null) ?? null,
						inviteTokenRequired: (lrow as any).invite_token_required === true,
						status: rawStatus ?? "active",
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
									rawStatus = "transition_spin";
									rawStage = "ACTIVE";
								} else {
									rawStatus = "active";
									rawStage = "ACTIVE";
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
		return null;
	}

	const errors: NonNullable<LiveLobbyResponse["errors"]> = [];
	const seasonStart = seasonStartRaw ?? undefined;
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
			rawStatus = "completed";
			rawStage = "COMPLETED";
			currentStage = "COMPLETED"; // Update the variable so rest of code sees the new value
		}
	} catch { /* ignore */ }
	if (rawStatus === "completed" && currentStage !== "COMPLETED") {
		currentStage = "COMPLETED";
	}

	// Prefetch approved and pending manual activities for the whole lobby and index by player_id
	// Pending activities still count toward streaks (they're being challenged but not rejected yet)
	let manualByPlayer: Record<string, ManualActivityRow[]> = {};
	let manualByUser: Record<string, ManualActivityRow[]> = {};
	try {
		const supabase = getServerSupabase();
		if (supabase) {
			const { data } = await supabase
				.from("manual_activities")
				.select("*, player:player_id(user_id)")
				.eq("lobby_id", lobby.id)
				.in("status", ["approved", "pending"])
				.order("date", { ascending: false })
				.limit(500);
			for (const m of (data ?? []) as any[]) {
				const pid = m.player_id as string;
				if (!manualByPlayer[pid]) manualByPlayer[pid] = [];
				manualByPlayer[pid].push(m as any);
				const linkedUserId = (Array.isArray(m.player) ? m.player[0]?.user_id : m.player?.user_id) as string | undefined;
				if (linkedUserId) {
					if (!manualByUser[linkedUserId]) manualByUser[linkedUserId] = [];
					manualByUser[linkedUserId].push(m as any);
				}
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
				let manual: ManualActivityRow[] = (() => {
					const byPlayer = manualByPlayer[p.id] ?? [];
					const byUser = p.userId ? (manualByUser[p.userId] ?? []) : [];
					const seen = new Set<string>();
					const merged: ManualActivityRow[] = [];
					for (const item of [...byPlayer, ...byUser]) {
						const id = (item as any).id as string | undefined;
						if (id && seen.has(id)) continue;
						if (id) seen.add(id);
						merged.push(item);
					}
					return merged;
				})();

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
				let seasonCombined: any[] = [];
				
				if (!seasonStart || currentStage === "PRE_STAGE") {
					// PRE_STAGE: Use initial hearts, no activity-based calculation
					weekly = {
						heartsRemaining: lobby.initialLives ?? 3,
						weeksEvaluated: 0,
						events: []
					};
					total = 0;
					currentStreak = 0;
					longestStreak = 0;
					avg = 0;
				} else {
					// ACTIVE or COMPLETED: Calculate hearts from activities
					const seasonCalcEndIso =
						currentStage === "COMPLETED"
							? seasonEnd
							: new Date().toISOString();
					const seasonCalcEndDate = new Date(seasonCalcEndIso);
					seasonCombined = (combined as any[]).filter((a) => {
						const raw = a.start_date ?? a.start_date_local ?? null;
						if (!raw) return false;
						const date = new Date(raw);
						if (Number.isNaN(date.getTime())) return false;
						return date >= new Date(seasonStart) && date <= seasonCalcEndDate;
					});

					// Prevent day-1 KO: if no activity yet and seasonStart is far in past, soft-clamp calculation start to "now"
					const hasAny = seasonCombined.length > 0;
					const seasonStartDate = new Date(seasonStart);
					const twoDaysMs = 2 * 24 * 60 * 60 * 1000;
					const startForCalc = (!hasAny && (Date.now() - seasonStartDate.getTime() > twoDaysMs))
						? new Date()
						: seasonStartDate;

					total = calculateTotalWorkouts(combined as any[], seasonStart, seasonCalcEndIso);
					currentStreak = calculateStreakFromActivities(combined as any[], seasonStart, seasonCalcEndIso, {
						timezoneOffsetMinutes: requestTimezoneOffsetMinutes
					});
					longestStreak = calculateLongestStreak(combined as any[], seasonStart, seasonCalcEndIso, {
						timezoneOffsetMinutes: requestTimezoneOffsetMinutes
					});
					avg = calculateAverageWorkoutsPerWeek(combined as any[], seasonStart, seasonCalcEndIso);
					weekly = computeWeeklyHearts(combined as any[], startForCalc, {
						weeklyTarget,
						maxHearts: 3,
						seasonEnd: seasonCalcEndDate
					});
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
					// Skip logging weekly target met/missed into history to avoid feed spam
				const seasonActivityList = seasonCombined.length ? seasonCombined : [];
				const recentActivities = seasonActivityList.slice(0, 5).map(a => {
					const s = toActivitySummary(a);
					return { ...s, source: (a.__source === "manual" ? "manual" : "strava") as any };
				});
				const lastStart = seasonActivityList[0]?.start_date || seasonActivityList[0]?.start_date_local || null;
				const seasonStravaCount = seasonActivityList.filter((a) => a.__source !== "manual").length;
				const seasonManualCount = seasonActivityList.filter((a) => a.__source === "manual").length;
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
						total: seasonActivityList.length,
						strava: seasonStravaCount,
						manual: seasonManualCount
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
							const activities = await fetchRecentActivities(refreshed.accessToken);
						// manual again (use prefetched index)
						let manual: ManualActivityRow[] = (() => {
							const byPlayer = manualByPlayer[p.id] ?? [];
							const byUser = p.userId ? (manualByUser[p.userId] ?? []) : [];
							const seen = new Set<string>();
							const merged: ManualActivityRow[] = [];
							for (const item of [...byPlayer, ...byUser]) {
								const id = (item as any).id as string | undefined;
								if (id && seen.has(id)) continue;
								if (id) seen.add(id);
								merged.push(item);
							}
							return merged;
						})();
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
						let seasonCombined: any[] = [];
						
						if (!seasonStart || currentStage === "PRE_STAGE") {
							weekly = {
								heartsRemaining: lobby.initialLives ?? 3,
								weeksEvaluated: 0,
								events: []
							};
							total = 0;
							currentStreak = 0;
							longestStreak = 0;
							avg = 0;
						} else {
							const seasonCalcEndIso =
								currentStage === "COMPLETED"
									? seasonEnd
									: new Date().toISOString();
							const seasonCalcEndDate = new Date(seasonCalcEndIso);
							seasonCombined = (combined as any[]).filter((a) => {
								const raw = a.start_date ?? a.start_date_local ?? null;
								if (!raw) return false;
								const date = new Date(raw);
								if (Number.isNaN(date.getTime())) return false;
								return date >= new Date(seasonStart) && date <= seasonCalcEndDate;
							});
							const seasonStartDate2 = new Date(seasonStart);
							const twoDaysMs = 2 * 24 * 60 * 60 * 1000;
							const startForCalc2 = (seasonCombined.length === 0 && (Date.now() - seasonStartDate2.getTime() > twoDaysMs))
								? new Date()
								: seasonStartDate2;
							total = calculateTotalWorkouts(combined as any[], seasonStart, seasonCalcEndIso);
							currentStreak = calculateStreakFromActivities(combined as any[], seasonStart, seasonCalcEndIso, {
								timezoneOffsetMinutes: requestTimezoneOffsetMinutes
							});
							longestStreak = calculateLongestStreak(combined as any[], seasonStart, seasonCalcEndIso, {
								timezoneOffsetMinutes: requestTimezoneOffsetMinutes
							});
							avg = calculateAverageWorkoutsPerWeek(combined as any[], seasonStart, seasonCalcEndIso);
							weekly = computeWeeklyHearts(combined as any[], startForCalc2, {
								weeklyTarget,
								maxHearts: 3,
								seasonEnd: seasonCalcEndDate
							});
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
						const seasonActivityList = seasonCombined.length ? seasonCombined : [];
						const recentActivities = seasonActivityList.slice(0, 5).map(a => {
							const s = toActivitySummary(a);
							return { ...s, source: (a.__source === "manual" ? "manual" : "strava") as any };
						});
						const lastStart = seasonActivityList[0]?.start_date || seasonActivityList[0]?.start_date_local || null;
						const seasonStravaCount = seasonActivityList.filter((a) => a.__source !== "manual").length;
						const seasonManualCount = seasonActivityList.filter((a) => a.__source === "manual").length;
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
								total: seasonActivityList.length,
								strava: seasonStravaCount,
								manual: seasonManualCount
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
			void weeks;
			void effectiveAnte;
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
					rawStatus = "completed";
					koEvent = { loserPlayerId: loser.id, potAtKO: currentPot };
				}
			} else if (mode === "MONEY_LAST_MAN") {
				// Season ends only when exactly one non-sudden-death player remains alive
				if (aliveNonSD.length === 1) {
					const winner = aliveNonSD[0];
					rawStatus = "completed";
					koEvent = { loserPlayerId: "", winnerPlayerId: winner.id, potAtKO: currentPot };
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
		// Transition to COMPLETED (read-only projection)
		rawStatus = "completed";
		rawStage = "COMPLETED";
		currentStage = "COMPLETED";
	}

	// Generate season summary if stage is COMPLETED and we don't have one yet
	if (currentStage === "COMPLETED" && !lobby.seasonSummary) {
		// Generate summary with current player stats
		seasonSummary = generateSeasonSummary(updatedPlayers, mode as GameMode, currentPot, lobby.seasonNumber);
	} else if (lobby.seasonSummary) {
		// Use existing summary from DB
		seasonSummary = lobby.seasonSummary;
	}

	const live: LiveLobbyResponse = {
		lobby: { ...lobby, status: rawStatus ?? (lobby as any).status ?? "active", players: updatedPlayers, cashPool: currentPot, stage: currentStage, seasonSummary },
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
	return live;
}
