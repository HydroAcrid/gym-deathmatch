import { NextResponse } from "next/server";
import { getRequestUserId } from "@/lib/requestAuth";
import { getServerSupabase } from "@/lib/supabaseClient";
import { logError } from "@/lib/logger";

type LobbyIdRow = { lobby_id: string };
type OwnerLobbyRow = { id: string };
type SeasonPlayerRow = {
	userId?: string | null;
	rank?: number | null;
	workouts?: number | null;
	points?: number | null;
	streak?: number | null;
	longestStreak?: number | null;
	hearts?: number | null;
	weeklyProgress?: number | null;
	weeklyTarget?: number | null;
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
	players: unknown;
	archived_at: string | null;
};

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
				...((memberRows ?? []) as LobbyIdRow[]).map((r) => String(r.lobby_id)),
				...((ownerRows ?? []) as OwnerLobbyRow[]).map((r) => String(r.id)),
			].filter(Boolean))
		);
		if (!lobbyIds.length) return NextResponse.json({ seasons: [] });

		const { data: rows, error } = await supabase
			.from("lobby_seasons")
			.select("lobby_id,lobby_name,season_number,mode,stage,status,season_start,season_end,final_pot,players,archived_at")
			.in("lobby_id", lobbyIds)
			.order("archived_at", { ascending: false })
			.limit(1000);

		if (error) throw error;

		const seasons = (rows ?? [])
			.map((row) => {
				const seasonRow = row as LobbySeasonRow;
				const players = (Array.isArray(seasonRow.players) ? seasonRow.players : []) as SeasonPlayerRow[];
				const me = players.find((p) => String(p?.userId || "") === userId);
				if (!me) return null;
				return {
					lobbyId: String(seasonRow.lobby_id),
					lobbyName: String(seasonRow.lobby_name ?? "Lobby"),
					seasonNumber: Number(seasonRow.season_number ?? 1),
					mode: seasonRow.mode ? String(seasonRow.mode) : null,
					stage: seasonRow.stage ? String(seasonRow.stage) : null,
					status: seasonRow.status ? String(seasonRow.status) : null,
					seasonStart: seasonRow.season_start ?? null,
					seasonEnd: seasonRow.season_end ?? null,
					finalPot: Number(seasonRow.final_pot ?? 0),
					archivedAt: seasonRow.archived_at ?? null,
					rank: Number(me.rank ?? 0),
					workouts: Number(me.workouts ?? 0),
					points: Number(me.points ?? 0),
					currentStreak: Number(me.streak ?? 0),
					longestStreak: Number(me.longestStreak ?? 0),
					hearts: Number(me.hearts ?? 0),
					weeklyProgress: Number(me.weeklyProgress ?? 0),
					weeklyTarget: Number(me.weeklyTarget ?? 3),
					result: String(me.result ?? "IN_PROGRESS"),
				};
			})
			.filter(Boolean);

		return NextResponse.json({ seasons });
	} catch (err) {
		logError({ route: "GET /api/profile/seasons", code: "PROFILE_SEASONS_FAILED", err });
		return NextResponse.json({ seasons: [] });
	}
}
