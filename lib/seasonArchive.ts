import { buildLiveLobbyResponse } from "@/lib/liveSnapshot";
import { calculatePoints, compareByPointsDesc } from "@/lib/points";
import { getServerSupabase } from "@/lib/supabaseClient";
import { logError } from "@/lib/logger";
import type { Lobby, Player, SeasonSummary } from "@/types/game";

type ArchivedPlayer = {
	playerId: string;
	userId: string | null;
	name: string;
	avatarUrl: string | null;
	rank: number;
	workouts: number;
	streak: number;
	longestStreak: number;
	hearts: number;
	weeklyTarget: number;
	weeklyProgress: number;
	points: number;
	result: "CHAMPION" | "ELIMINATED" | "IN_PROGRESS";
};

type ArchivedPlayerBase = Omit<ArchivedPlayer, "rank" | "result">;

function readWeeklyProgress(player: Player): number {
	const timeline = Array.isArray(player.heartsTimeline) ? player.heartsTimeline : [];
	if (!timeline.length) return 0;
	return Number(timeline[timeline.length - 1]?.workouts ?? 0);
}

function deriveResult(playerId: string, summary: SeasonSummary | null | undefined, stage: string, rank: number): ArchivedPlayer["result"] {
	if (String(stage) !== "COMPLETED") return "IN_PROGRESS";
	const winnerIds = new Set<string>((summary?.winners ?? []).map((w) => String(w?.id || "")));
	const loserIds = new Set<string>((summary?.losers ?? []).map((l) => String(l?.id || "")));
	if (winnerIds.has(playerId)) return "CHAMPION";
	if (loserIds.has(playerId)) return "ELIMINATED";
	return rank === 1 ? "CHAMPION" : "ELIMINATED";
}

export async function archiveCurrentLobbySeason(lobbyId: string): Promise<{ ok: boolean; reason?: string }> {
	const supabase = getServerSupabase();
	if (!supabase) return { ok: false, reason: "supabase_unavailable" };

	const live = await buildLiveLobbyResponse({
		lobbyId,
		requestTimezoneOffsetMinutes: 0,
	});
	if (!live?.lobby) return { ok: false, reason: "live_snapshot_unavailable" };

	const lobby = live.lobby as Lobby;
	const summary = lobby.seasonSummary ?? null;
	const players = Array.isArray(lobby.players) ? lobby.players : ([] as Player[]);

	const ranked = players
		.map((p): ArchivedPlayerBase => {
			const workouts = Number(p.totalWorkouts ?? 0);
			const streak = Number(p.currentStreak ?? 0);
			const penalties = 0;
			return {
				playerId: String(p.id ?? ""),
				userId: p.userId ? String(p.userId) : null,
				name: String(p.name ?? "Athlete"),
				avatarUrl: p.avatarUrl ? String(p.avatarUrl) : null,
				workouts,
				streak,
				longestStreak: Number(p.longestStreak ?? 0),
				hearts: Number(p.livesRemaining ?? 0),
				weeklyTarget: Number(p.weeklyTarget ?? lobby.weeklyTarget ?? 3),
				weeklyProgress: readWeeklyProgress(p),
				points: calculatePoints({ workouts, streak, penalties }),
			};
		})
		.filter((p: ArchivedPlayerBase) => !!p.playerId)
		.sort((a, b) =>
			compareByPointsDesc(
				{ rank: 0, athleteName: a.name, workouts: a.workouts, streak: a.streak, penalties: 0, points: a.points },
				{ rank: 0, athleteName: b.name, workouts: b.workouts, streak: b.streak, penalties: 0, points: b.points }
			)
		)
		.map((p: ArchivedPlayerBase, idx): ArchivedPlayer => {
			const rank = idx + 1;
			return {
				...p,
				rank,
				result: deriveResult(p.playerId, summary, String(lobby.stage || "PRE_STAGE"), rank),
			};
		});

	const payload = {
		lobby_id: String(lobby.id),
		lobby_name: String(lobby.name ?? "Lobby"),
		season_number: Number(lobby.seasonNumber ?? 1),
		mode: lobby.mode ? String(lobby.mode) : null,
		stage: lobby.stage ? String(lobby.stage) : null,
		status: lobby.status ? String(lobby.status) : null,
		season_start: lobby.seasonStart ?? null,
		season_end: lobby.seasonEnd ?? null,
		final_pot: Number(summary?.finalPot ?? lobby.cashPool ?? 0),
		summary,
		players: ranked,
		archived_at: new Date().toISOString(),
	};

	const { error } = await supabase
		.from("lobby_seasons")
		.upsert(payload, { onConflict: "lobby_id,season_number" });

	if (error) {
		logError({
			route: "seasonArchive",
			code: "ARCHIVE_UPSERT_FAILED",
			err: error,
			lobbyId,
			extra: { seasonNumber: payload.season_number },
		});
		return { ok: false, reason: error.message };
	}

	return { ok: true };
}
