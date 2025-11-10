import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabaseClient";

export async function GET(req: NextRequest) {
	const { searchParams } = new URL(req.url);
	const playerId = searchParams.get("playerId");
	const supabase = getServerSupabase();
	if (!supabase) return NextResponse.json({ lobbies: [] });
	try {
		if (playerId) {
			const { data, error } = await supabase
				.from("player")
				.select("lobby:lobby_id ( id, name, season_number, season_start, season_end, cash_pool, weekly_target, initial_lives )")
				.eq("id", playerId)
				.limit(1)
				.returns<any>();
			if (error) throw error;
			const lobby = data?.[0]?.lobby;
			return NextResponse.json({ lobbies: lobby ? [lobby] : [] });
		}
		// fallback: list all lobbies (public) – for now return all
		const { data, error } = await supabase.from("lobby").select("*").limit(20);
		if (error) throw error;
		return NextResponse.json({ lobbies: data ?? [] });
	} catch (e) {
		console.error("lobbies list error", e);
		return NextResponse.json({ lobbies: [] });
	}
}


