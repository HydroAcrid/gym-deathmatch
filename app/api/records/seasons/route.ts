import { NextResponse } from "next/server";
import { getRequestUserId } from "@/lib/requestAuth";
import { getServerSupabase } from "@/lib/supabaseClient";
import { logError } from "@/lib/logger";

type LobbyIdRow = { lobby_id: string };
type OwnerLobbyRow = { id: string };
type ArchivedPlayerRow = {
	playerId?: string | null;
	userId?: string | null;
	name?: string | null;
	avatarUrl?: string | null;
	rank?: number | null;
	workouts?: number | null;
	streak?: number | null;
	longestStreak?: number | null;
	hearts?: number | null;
	points?: number | null;
	result?: string | null;
};
type LobbySeasonRow = {
	lobby_id: string;
	lobby_name: string | null;
	season_number: number | null;
	mode: string | null;
	stage: string | null;
	status: string | null;
	season_start: string | null;
	season_end: string | null;
	final_pot: number | null;
	summary: unknown;
	players: unknown;
	archived_at: string | null;
};

function toNumber(value: unknown, fallback = 0): number {
	const n = typeof value === "number" ? value : Number(value);
	return Number.isFinite(n) ? n : fallback;
}

function normalizePlayers(value: unknown): ArchivedPlayerRow[] {
	return Array.isArray(value) ? (value as ArchivedPlayerRow[]) : [];
}

export async function GET(req: Request) {
	const userId = await getRequestUserId(req);
	if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const supabase = getServerSupabase();
	if (!supabase) return NextResponse.json({ seasons: [] });

	try {
		const [{ data: memberRows }, { data: ownerRows }] = await Promise.all([
			supabase.from("player").select("lobby_id").eq("user_id", userId).limit(500),
			supabase.from("lobby").select("id").eq("owner_user_id", userId).limit(500),
		]);

		const lobbyIds = Array.from(
			new Set([
				...((memberRows ?? []) as LobbyIdRow[]).map((row) => String(row.lobby_id)),
				...((ownerRows ?? []) as OwnerLobbyRow[]).map((row) => String(row.id)),
			].filter(Boolean))
		);
		const accessibleLobbyIds = new Set(lobbyIds);

		const { data: rows, error } = await supabase
			.from("lobby_seasons")
			.select("lobby_id,lobby_name,season_number,mode,stage,status,season_start,season_end,final_pot,summary,players,archived_at")
			.order("archived_at", { ascending: false })
			.limit(1000);
		if (error) throw error;

		const seasons = ((rows ?? []) as LobbySeasonRow[])
			.map((row) => {
				const players = normalizePlayers(row.players);
				const hasPlayerAccess = players.some((player) => String(player.userId ?? "") === userId);
				if (!accessibleLobbyIds.has(String(row.lobby_id)) && !hasPlayerAccess) return null;

				const standings = players
					.map((player) => ({
						playerId: String(player.playerId ?? ""),
						userId: player.userId ? String(player.userId) : null,
						athleteName: String(player.name ?? "Athlete"),
						avatarUrl: player.avatarUrl ? String(player.avatarUrl) : null,
						rank: toNumber(player.rank, 0),
						workouts: toNumber(player.workouts, 0),
						streak: toNumber(player.streak, 0),
						longestStreak: toNumber(player.longestStreak, 0),
						hearts: toNumber(player.hearts, 0),
						points: toNumber(player.points, 0),
						result: String(player.result ?? "IN_PROGRESS"),
					}))
					.filter((player) => player.playerId || player.athleteName)
					.sort((a, b) => {
						if (a.rank > 0 && b.rank > 0 && a.rank !== b.rank) return a.rank - b.rank;
						if (b.points !== a.points) return b.points - a.points;
						if (b.hearts !== a.hearts) return b.hearts - a.hearts;
						if (b.workouts !== a.workouts) return b.workouts - a.workouts;
						return a.athleteName.localeCompare(b.athleteName);
					});

				return {
					lobbyId: String(row.lobby_id),
					lobbyName: String(row.lobby_name ?? "Lobby"),
					seasonNumber: toNumber(row.season_number, 1),
					mode: row.mode ? String(row.mode) : null,
					stage: row.stage ? String(row.stage) : null,
					status: row.status ? String(row.status) : null,
					seasonStart: row.season_start,
					seasonEnd: row.season_end,
					finalPot: toNumber(row.final_pot, 0),
					archivedAt: row.archived_at,
					summary: row.summary ?? null,
					standings,
				};
			})
			.filter(Boolean);

		return NextResponse.json({ seasons });
	} catch (err) {
		logError({ route: "GET /api/records/seasons", code: "RECORDS_SEASONS_FAILED", err });
		return NextResponse.json({ seasons: [] });
	}
}
