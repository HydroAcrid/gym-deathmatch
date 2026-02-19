import { computeEffectiveWeeklyAnte, weeksSince } from "@/lib/pot";
import { runWeeklyRouletteJob } from "@/lib/rouletteJobs";
import { refreshLobbyLiveSnapshot } from "@/lib/liveSnapshotStore";
import { logError } from "@/lib/logger";
import { archiveCurrentLobbySeason } from "@/lib/seasonArchive";
import { getServerSupabase } from "@/lib/supabaseClient";
import type { LobbyStage } from "@/types/game";

type SeasonStatus = "pending" | "scheduled" | "transition_spin" | "active" | "completed";

type ReconcileLobbyRow = {
	id: string;
	status: SeasonStatus | null;
	stage: LobbyStage | null;
	mode: string | null;
	season_start: string | null;
	season_end: string | null;
	scheduled_start: string | null;
	cash_pool: number | null;
	initial_pot: number | null;
	weekly_ante: number | null;
	scaling_enabled: boolean | null;
	per_player_boost: number | null;
	season_number: number | null;
	season_summary: unknown | null;
};

type ReconcilePlayerRow = {
	id: string;
	name: string;
	lives_remaining: number | null;
	sudden_death: boolean | null;
	total_workouts: number | null;
	longest_streak: number | null;
	average_workouts_per_week: number | null;
};

type ContributionRow = { week_start: string; amount: number | null };
type VoteActivityRow = { id: string };
type VoteCountRow = { activity_id: string };

type SupabaseLike = NonNullable<ReturnType<typeof getServerSupabase>>;

class ReconcileServiceError extends Error {
	code: string;
	status: number;

	constructor(code: string, message: string, status: number) {
		super(message);
		this.code = code;
		this.status = status;
	}
}

function fail(code: string, message: string, status: number): never {
	throw new ReconcileServiceError(code, message, status);
}

function toNumber(value: unknown, fallback = 0): number {
	const n = typeof value === "number" ? value : Number(value);
	return Number.isFinite(n) ? n : fallback;
}

function buildSeasonSummary(players: ReconcilePlayerRow[], seasonNumber: number, finalPot: number) {
	const normalized = players.map((player) => ({
		id: player.id,
		name: player.name,
		avatarUrl: "",
		hearts: toNumber(player.lives_remaining, 0),
		totalWorkouts: toNumber(player.total_workouts, 0),
		longestStreak: toNumber(player.longest_streak, 0),
		averageWorkoutsPerWeek: toNumber(player.average_workouts_per_week, 0),
	}));
	const maxHearts = Math.max(...normalized.map((player) => player.hearts), 0);
	return {
		seasonNumber,
		winners: normalized.filter((player) => player.hearts === maxHearts),
		losers: normalized.filter((player) => player.hearts < maxHearts),
		finalPot,
		highlights: {},
	};
}

export const ReconcileService = {
	async reconcileLobby(input: { supabase: SupabaseLike; lobbyId: string }): Promise<{ ok: true; actions: string[] }> {
		const { supabase, lobbyId } = input;
		const { data: lobbyRow } = await supabase
			.from("lobby")
			.select(
				"id,status,stage,mode,season_start,season_end,scheduled_start,cash_pool,initial_pot,weekly_ante,scaling_enabled,per_player_boost,season_number,season_summary"
			)
			.eq("id", lobbyId)
			.maybeSingle();
		if (!lobbyRow) fail("NOT_FOUND", "Lobby not found", 404);
		const lobby = lobbyRow as ReconcileLobbyRow;

		const actions: string[] = [];
		let status: SeasonStatus = lobby.status ?? "pending";
		let stage: LobbyStage =
			lobby.stage ??
			(status === "completed"
				? "COMPLETED"
				: status === "active" || status === "transition_spin"
					? "ACTIVE"
					: "PRE_STAGE");

		if (status === "scheduled" && lobby.scheduled_start) {
			const scheduledMs = new Date(lobby.scheduled_start).getTime();
			if (Number.isFinite(scheduledMs) && scheduledMs <= Date.now()) {
				const mode = String(lobby.mode || "MONEY_SURVIVAL");
				if (mode.startsWith("CHALLENGE_ROULETTE")) {
					await supabase.from("lobby").update({ status: "transition_spin", scheduled_start: null, stage: "ACTIVE" }).eq("id", lobbyId);
					actions.push("SCHEDULED_TO_TRANSITION_SPIN");
					status = "transition_spin";
					stage = "ACTIVE";
				} else {
					await supabase
						.from("lobby")
						.update({
							status: "active",
							scheduled_start: null,
							season_start: new Date().toISOString(),
							stage: "ACTIVE",
						})
						.eq("id", lobbyId);
					actions.push("SCHEDULED_TO_ACTIVE");
					status = "active";
					stage = "ACTIVE";
				}
			}
		}

		if (String(lobby.mode || "") === "CHALLENGE_ROULETTE" && (status === "active" || status === "transition_spin")) {
			try {
				const roulette = await runWeeklyRouletteJob({ lobbyId });
				if ((roulette.transitioned ?? 0) > 0 || (roulette.spun ?? 0) > 0) {
					actions.push(`ROULETTE_AUTO:transitioned=${roulette.transitioned},spun=${roulette.spun}`);
				}
			} catch (err) {
				logError({ route: "POST /api/lobby/[id]/reconcile", code: "ROULETTE_AUTO_RECONCILE_FAILED", err, lobbyId });
			}
		}

		const { data: playersRaw } = await supabase.from("player").select("*").eq("lobby_id", lobbyId);
		const players = (playersRaw ?? []) as ReconcilePlayerRow[];
		const aliveNonSuddenDeath = players.filter((player) => toNumber(player.lives_remaining, 0) > 0 && !player.sudden_death);
		const anyZero = players.find((player) => toNumber(player.lives_remaining, 0) <= 0 && !player.sudden_death);

		try {
			const { data: pendingActs } = await supabase
				.from("manual_activities")
				.select("id")
				.eq("lobby_id", lobbyId)
				.eq("status", "pending")
				.limit(200);
			const pendingIds = ((pendingActs ?? []) as VoteActivityRow[]).map((row) => row.id).filter(Boolean);
			if (pendingIds.length > 0) {
				const { data: voteRows } = await supabase
					.from("activity_votes")
					.select("activity_id")
					.in("activity_id", pendingIds);
				const counts: Record<string, number> = {};
				for (const row of (voteRows ?? []) as VoteCountRow[]) {
					counts[row.activity_id] = (counts[row.activity_id] ?? 0) + 1;
				}
				const zeroVoteIds = pendingIds.filter((id) => !counts[id]);
				if (zeroVoteIds.length > 0) {
					await supabase
						.from("manual_activities")
						.update({ status: "approved", vote_deadline: null, decided_at: null })
						.in("id", zeroVoteIds);
					actions.push(`PENDING_WITHOUT_VOTES_REVERTED:${zeroVoteIds.length}`);
				}
			}
		} catch (err) {
			logError({ route: "POST /api/lobby/[id]/reconcile", code: "ACTIVITY_RECONCILE_FAILED", err, lobbyId });
		}

		if (status === "active") {
			const mode = String(lobby.mode || "MONEY_SURVIVAL");
			if (mode === "MONEY_SURVIVAL" && anyZero) {
				await supabase.from("lobby").update({ status: "completed", stage: "COMPLETED", season_end: new Date().toISOString() }).eq("id", lobbyId);
				await supabase.from("history_events").insert({
					lobby_id: lobbyId,
					actor_player_id: null,
					target_player_id: anyZero.id,
					type: "SEASON_KO",
					payload: {
						loserPlayerId: anyZero.id,
						currentPot: toNumber(lobby.cash_pool, 0),
						seasonNumber: toNumber(lobby.season_number, 1),
					},
				});
				actions.push("SEASON_KO_COMPLETED");
				status = "completed";
				stage = "COMPLETED";
			} else if (mode === "MONEY_LAST_MAN" && aliveNonSuddenDeath.length === 1) {
				const winner = aliveNonSuddenDeath[0];
				await supabase.from("lobby").update({ status: "completed", stage: "COMPLETED", season_end: new Date().toISOString() }).eq("id", lobbyId);
				await supabase.from("history_events").insert({
					lobby_id: lobbyId,
					actor_player_id: null,
					target_player_id: winner.id,
					type: "SEASON_WINNER",
					payload: {
						winnerPlayerId: winner.id,
						currentPot: toNumber(lobby.cash_pool, 0),
						seasonNumber: toNumber(lobby.season_number, 1),
					},
				});
				actions.push("SEASON_WINNER_COMPLETED");
				status = "completed";
				stage = "COMPLETED";
			}
		}

		if (String(lobby.mode || "").startsWith("MONEY_") && lobby.season_start) {
			const weeks = weeksSince(lobby.season_start);
			if (weeks > 0) {
				const effectiveAnte = computeEffectiveWeeklyAnte(
					{
						initialPot: toNumber(lobby.initial_pot, 0),
						weeklyAnte: toNumber(lobby.weekly_ante, 10),
						scalingEnabled: !!lobby.scaling_enabled,
						perPlayerBoost: toNumber(lobby.per_player_boost, 0),
					},
					players.length
				);
				const { data: existing } = await supabase
					.from("weekly_pot_contributions")
					.select("week_start")
					.eq("lobby_id", lobbyId);
				const existingRows = (existing ?? []) as ContributionRow[];
				const existingSet = new Set(
					existingRows.map((row) => {
						const d = new Date(row.week_start);
						return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
					})
				);

				const startDate = new Date(lobby.season_start);
				const start = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate(), 0, 0, 0, 0));
				for (let i = 0; i < weeks; i++) {
					const weekStartIso = new Date(start.getTime() + i * 7 * 24 * 60 * 60 * 1000).toISOString();
					const d = new Date(weekStartIso);
					const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
					if (existingSet.has(key)) continue;
					const survivors = players.filter((player) => toNumber(player.lives_remaining, 0) > 0).length;
					await supabase.from("weekly_pot_contributions").insert({
						lobby_id: lobbyId,
						week_start: weekStartIso,
						amount: effectiveAnte * Math.max(survivors, 0),
						player_count: survivors,
					});
					actions.push(`POT_CONTRIBUTION_ADDED:${key}`);
				}
			}

			const { data: sumRows } = await supabase.from("weekly_pot_contributions").select("amount").eq("lobby_id", lobbyId);
			const contributions = (sumRows ?? []) as Array<{ amount: number | null }>;
			const contributionTotal = contributions.reduce((sum, row) => sum + toNumber(row.amount, 0), 0);
			const computedPot = toNumber(lobby.initial_pot, 0) + contributionTotal;
			if (computedPot !== toNumber(lobby.cash_pool, 0)) {
				await supabase.from("lobby").update({ cash_pool: computedPot }).eq("id", lobbyId);
				actions.push("POT_UPDATED");
			}
		}

		if (stage === "ACTIVE" && lobby.season_end) {
			const seasonEndTime = new Date(lobby.season_end).getTime();
			if (Number.isFinite(seasonEndTime) && seasonEndTime <= Date.now()) {
				await supabase.from("lobby").update({ status: "completed", stage: "COMPLETED" }).eq("id", lobbyId);
				actions.push("SEASON_END_COMPLETED");
				stage = "COMPLETED";
				status = "completed";
			}
		}

		if (stage === "COMPLETED" && !lobby.season_summary) {
			const { data: latestLobby } = await supabase
				.from("lobby")
				.select("cash_pool,season_number")
				.eq("id", lobbyId)
				.maybeSingle();
			const latest = (latestLobby ?? {}) as { cash_pool?: number | null; season_number?: number | null };
			const summary = buildSeasonSummary(
				players,
				toNumber(latest.season_number ?? lobby.season_number, 1),
				toNumber(latest.cash_pool ?? lobby.cash_pool, 0)
			);
			await supabase.from("lobby").update({ season_summary: summary }).eq("id", lobbyId);
			actions.push("SEASON_SUMMARY_WRITTEN");
		}

		if (
			stage === "COMPLETED" &&
			(actions.includes("SEASON_SUMMARY_WRITTEN") ||
				actions.includes("SEASON_END_COMPLETED") ||
				actions.includes("SEASON_KO_COMPLETED") ||
				actions.includes("SEASON_WINNER_COMPLETED"))
		) {
			try {
				const archived = await archiveCurrentLobbySeason(lobbyId);
				if (archived.ok) {
					actions.push("SEASON_ARCHIVED");
				} else {
					actions.push(`SEASON_ARCHIVE_WARNING:${archived.reason ?? "unknown"}`);
				}
			} catch (err) {
				logError({ route: "POST /api/lobby/[id]/reconcile", code: "SEASON_ARCHIVE_RECONCILE_FAILED", err, lobbyId });
			}
		}

		void refreshLobbyLiveSnapshot(lobbyId);
		return { ok: true, actions };
	},
};

export function isReconcileServiceError(err: unknown): err is ReconcileServiceError {
	return err instanceof ReconcileServiceError;
}
