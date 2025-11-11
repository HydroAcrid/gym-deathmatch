import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabaseClient";

export async function GET(req: NextRequest) {
	const { searchParams } = new URL(req.url);
	const userId = searchParams.get("userId");
	const supabase = getServerSupabase();
	if (!supabase) return NextResponse.json({ lobbies: [] });
	try {
		let query = supabase.from("lobby").select("*").order("name", { ascending: true }).limit(100);
		if (userId) {
			// Filter to lobbies where the user has a player row OR owns the lobby
			const { data: mine } = await supabase
				.from("player")
				.select("lobby_id")
				.eq("user_id", userId)
				.limit(200);
			const lobbyIds = Array.from(new Set([...(mine?.map(r => r.lobby_id) ?? [] as any),] as any));
			if (lobbyIds.length) {
				query = query.in("id", lobbyIds as any);
			} else {
				// No player rows; still include lobbies owned by the user if any
				query = query.eq("owner_user_id", userId);
			}
		}
		const { data, error } = await query;
		if (error) throw error;
		return NextResponse.json({ lobbies: data ?? [] });
	} catch (e) {
		console.error("lobbies list error", e);
		return NextResponse.json({ lobbies: [] });
	}
}


