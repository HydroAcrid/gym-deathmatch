import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabaseClient";

export async function GET(req: NextRequest) {
	const { searchParams } = new URL(req.url);
	const _playerId = searchParams.get("playerId"); // not used for filtering right now
	const supabase = getServerSupabase();
	if (!supabase) return NextResponse.json({ lobbies: [] });
	try {
		// Return all lobbies (client decides which ones are editable/owned)
		const { data, error } = await supabase.from("lobby").select("*").order("name", { ascending: true }).limit(100);
		if (error) throw error;
		return NextResponse.json({ lobbies: data ?? [] });
	} catch (e) {
		console.error("lobbies list error", e);
		return NextResponse.json({ lobbies: [] });
	}
}


