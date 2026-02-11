import { NextRequest, NextResponse } from "next/server";
import { computeEffectiveWeeklyAnte, weeksSince } from "@/lib/pot";
import { jsonError, logError } from "@/lib/logger";
import { resolveLobbyAccess } from "@/lib/lobbyAccess";
import { runWeeklyRouletteJob } from "@/lib/rouletteJobs";

type PlayerLite = {
	id: string;
	name: string;
	lives_remaining?: number | null;
	sudden_death?: boolean | null;
	total_workouts?: number | null;
	longest_streak?: number | null;
	average_workouts_per_week?: number | null;
};

function buildSeasonSummary(players: PlayerLite[], seasonNumber: number, finalPot: number) {
	const normalized = players.map((p) => ({
		id: p.id,
		name: p.name,
		avatarUrl: "",
		hearts: Number(p.lives_remaining ?? 0),
		totalWorkouts: Number(p.total_workouts ?? 0),
		longestStreak: Number(p.longest_streak ?? 0),
		averageWorkoutsPerWeek: Number(p.average_workouts_per_week ?? 0)
	}));
	const maxHearts = Math.max(...normalized.map((p) => p.hearts), 0);
	const winners = normalized.filter((p) => p.hearts === maxHearts);
	const losers = normalized.filter((p) => p.hearts < maxHearts);
	return {
		seasonNumber,
		winners,
		losers,
		finalPot,
		highlights: {}
	};
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ lobbyId: string }> }) {
	const { lobbyId } = await params;
	const access = await resolveLobbyAccess(req, lobbyId);
	if (!access.ok) return jsonError(access.code, access.message, access.status);
	if (!access.memberPlayerId && !access.isOwner) return jsonError("FORBIDDEN", "Not a lobby member", 403);

	const supabase = access.supabase;
	try {
		const { data: lobby } = await supabase
			.from("lobby")
			.select("id,status,stage,mode,season_start,season_end,scheduled_start,cash_pool,initial_pot,weekly_ante,scaling_enabled,per_player_boost,season_number,season_summary")
			.eq("id", lobbyId)
			.maybeSingle();
		if (!lobby) return jsonError("NOT_FOUND", "Lobby not found", 404);

		const actions: string[] = [];
		let status = String((lobby as any).status || "pending");
		let stage = String((lobby as any).stage || (status === "completed" ? "COMPLETED" : status === "active" || status === "transition_spin" ? "ACTIVE" : "PRE_STAGE"));

		if (status === "scheduled" && (lobby as any).scheduled_start) {
			const sched = new Date((lobby as any).scheduled_start as string).getTime();
			if (Number.isFinite(sched) && sched <= Date.now()) {
				const mode = String((lobby as any).mode || "MONEY_SURVIVAL");
				if (mode.startsWith("CHALLENGE_ROULETTE")) {
					await supabase.from("lobby").update({ status: "transition_spin", scheduled_start: null, stage: "ACTIVE" }).eq("id", lobbyId);
					actions.push("SCHEDULED_TO_TRANSITION_SPIN");
					status = "transition_spin";
					stage = "ACTIVE";
				} else {
					await supabase.from("lobby").update({
						status: "active",
						scheduled_start: null,
						season_start: new Date().toISOString(),
						stage: "ACTIVE"
					}).eq("id", lobbyId);
					actions.push("SCHEDULED_TO_ACTIVE");
					status = "active";
					stage = "ACTIVE";
				}
			}
		}

		// Hobby-safe fallback: run roulette auto-spin checks opportunistically on reconcile.
		// This keeps weekly roulette progression responsive even when cron runs only once/day.
		if (String((lobby as any).mode || "") === "CHALLENGE_ROULETTE" && (status === "active" || status === "transition_spin")) {
			try {
				const roulette = await runWeeklyRouletteJob({ lobbyId });
				if ((roulette?.transitioned ?? 0) > 0 || (roulette?.spun ?? 0) > 0) {
					actions.push(`ROULETTE_AUTO:transitioned=${roulette.transitioned},spun=${roulette.spun}`);
				}
			} catch (e) {
				logError({ route: "POST /api/lobby/[id]/reconcile", code: "ROULETTE_AUTO_RECONCILE_FAILED", err: e, lobbyId });
			}
		}

		const { data: playersRaw } = await supabase.from("player").select("*").eq("lobby_id", lobbyId);
		const players = (playersRaw ?? []) as PlayerLite[];
		const aliveNonSD = players.filter((p) => Number(p.lives_remaining ?? 0) > 0 && !p.sudden_death);
		const anyZero = players.find((p) => Number(p.lives_remaining ?? 0) <= 0 && !p.sudden_death);

		// Reconcile pending activities that have no votes back to approved.
		try {
			const { data: pendingActs } = await supabase
				.from("manual_activities")
				.select("id")
				.eq("lobby_id", lobbyId)
				.eq("status", "pending")
				.limit(200);
			const pendingIds = (pendingActs ?? []).map((a: any) => a.id).filter(Boolean);
			if (pendingIds.length) {
				const { data: voteRows } = await supabase
					.from("activity_votes")
					.select("activity_id")
					.in("activity_id", pendingIds as any);
				const counts: Record<string, number> = {};
				for (const row of (voteRows ?? []) as Array<{ activity_id: string }>) {
					counts[row.activity_id] = (counts[row.activity_id] || 0) + 1;
				}
				const zeroVoteIds = pendingIds.filter((id: string) => !counts[id]);
				if (zeroVoteIds.length) {
					await supabase
						.from("manual_activities")
						.update({ status: "approved", vote_deadline: null, decided_at: null })
						.in("id", zeroVoteIds as any);
					actions.push(`PENDING_WITHOUT_VOTES_REVERTED:${zeroVoteIds.length}`);
				}
			}
		} catch (e) {
			logError({ route: "POST /api/lobby/[id]/reconcile", code: "ACTIVITY_RECONCILE_FAILED", err: e, lobbyId });
		}

		if (status === "active") {
			const mode = String((lobby as any).mode || "MONEY_SURVIVAL");
			if (mode === "MONEY_SURVIVAL" && anyZero) {
				await supabase.from("lobby").update({ status: "completed", stage: "COMPLETED", season_end: new Date().toISOString() }).eq("id", lobbyId);
				await supabase.from("history_events").insert({
					lobby_id: lobbyId,
					actor_player_id: null,
					target_player_id: anyZero.id,
					type: "SEASON_KO",
					payload: {
						loserPlayerId: anyZero.id,
						currentPot: Number((lobby as any).cash_pool ?? 0),
						seasonNumber: Number((lobby as any).season_number ?? 1)
					}
				});
				actions.push("SEASON_KO_COMPLETED");
				status = "completed";
				stage = "COMPLETED";
			} else if (mode === "MONEY_LAST_MAN" && aliveNonSD.length === 1) {
				const winner = aliveNonSD[0];
				await supabase.from("lobby").update({ status: "completed", stage: "COMPLETED", season_end: new Date().toISOString() }).eq("id", lobbyId);
				await supabase.from("history_events").insert({
					lobby_id: lobbyId,
					actor_player_id: null,
					target_player_id: winner.id,
					type: "SEASON_WINNER",
					payload: {
						winnerPlayerId: winner.id,
						currentPot: Number((lobby as any).cash_pool ?? 0),
						seasonNumber: Number((lobby as any).season_number ?? 1)
					}
				});
				actions.push("SEASON_WINNER_COMPLETED");
				status = "completed";
				stage = "COMPLETED";
			}
		}

		if (String((lobby as any).mode || "").startsWith("MONEY_") && (lobby as any).season_start) {
			const seasonStart = String((lobby as any).season_start);
			const weeks = weeksSince(seasonStart);
			if (weeks > 0) {
				const effectiveAnte = computeEffectiveWeeklyAnte({
					initialPot: Number((lobby as any).initial_pot ?? 0),
					weeklyAnte: Number((lobby as any).weekly_ante ?? 10),
					scalingEnabled: !!(lobby as any).scaling_enabled,
					perPlayerBoost: Number((lobby as any).per_player_boost ?? 0)
				}, players.length);
				const { data: existing } = await supabase
					.from("weekly_pot_contributions")
					.select("week_start")
					.eq("lobby_id", lobbyId);
				const existingSet = new Set(
					(existing ?? []).map((r: any) => {
						const d = new Date(r.week_start as string);
						return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
					})
				);
				const startDate = new Date(seasonStart);
				const start = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate(), 0, 0, 0, 0));
				for (let i = 0; i < weeks; i++) {
					const ws = new Date(start.getTime() + i * 7 * 24 * 60 * 60 * 1000).toISOString();
					const d = new Date(ws);
					const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
					if (existingSet.has(key)) continue;
					const survivors = players.filter((p) => Number(p.lives_remaining ?? 0) > 0).length;
					await supabase.from("weekly_pot_contributions").insert({
						lobby_id: lobbyId,
						week_start: ws,
						amount: effectiveAnte * Math.max(survivors, 0),
						player_count: survivors
					});
					actions.push(`POT_CONTRIBUTION_ADDED:${key}`);
				}
			}
			const { data: sumRows } = await supabase.from("weekly_pot_contributions").select("amount").eq("lobby_id", lobbyId);
			const contributionsSum = (sumRows ?? []).reduce((s: number, r: any) => s + Number(r.amount ?? 0), 0);
			const computedPot = Number((lobby as any).initial_pot ?? 0) + contributionsSum;
			if (computedPot !== Number((lobby as any).cash_pool ?? 0)) {
				await supabase.from("lobby").update({ cash_pool: computedPot }).eq("id", lobbyId);
				actions.push("POT_UPDATED");
			}
		}

		if (stage === "ACTIVE" && (lobby as any).season_end) {
			const seasonEndTime = new Date((lobby as any).season_end as string).getTime();
			if (Number.isFinite(seasonEndTime) && seasonEndTime <= Date.now()) {
				await supabase.from("lobby").update({ status: "completed", stage: "COMPLETED" }).eq("id", lobbyId);
				actions.push("SEASON_END_COMPLETED");
				stage = "COMPLETED";
				status = "completed";
			}
		}

		if (stage === "COMPLETED" && !(lobby as any).season_summary) {
			const { data: latestLobby } = await supabase
				.from("lobby")
				.select("cash_pool,season_number")
				.eq("id", lobbyId)
				.maybeSingle();
			const summary = buildSeasonSummary(players, Number((latestLobby as any)?.season_number ?? (lobby as any).season_number ?? 1), Number((latestLobby as any)?.cash_pool ?? (lobby as any).cash_pool ?? 0));
			await supabase.from("lobby").update({ season_summary: summary as any }).eq("id", lobbyId);
			actions.push("SEASON_SUMMARY_WRITTEN");
		}

		return NextResponse.json({ ok: true, actions });
	} catch (e) {
		logError({ route: "POST /api/lobby/[id]/reconcile", code: "RECONCILE_FAILED", err: e, lobbyId });
		return jsonError("RECONCILE_FAILED", "Failed to reconcile lobby", 400);
	}
}
