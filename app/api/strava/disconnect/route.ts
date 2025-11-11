import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabaseClient";

export async function POST(req: NextRequest) {
	const supabase = getServerSupabase();
	if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 501 });
	try {
		const body = await req.json();
		const playerId = String(body.playerId || "");
		const userId = body.userId ? String(body.userId) : null;
		// Best-effort delete: user-scoped and legacy player-scoped tokens
		if (userId) {
			await supabase.from("user_strava_token").delete().eq("user_id", userId);
		}
		if (playerId) {
			await supabase.from("strava_token").delete().eq("player_id", playerId);
		}
		return NextResponse.json({ ok: true });
	} catch (e) {
		console.error("disconnect error", e);
		return NextResponse.json({ error: "Bad request" }, { status: 400 });
	}
}


