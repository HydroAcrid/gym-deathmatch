import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabaseClient";

export async function POST(req: NextRequest, { params }: { params: Promise<{ lobbyId: string; playerId: string }> }) {
	const { lobbyId, playerId } = await params;
	const supabase = getServerSupabase();
	if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 501 });
	try {
		const body = await req.json();
		const enabled = !!body.enabled;
		// Ensure player belongs to lobby
		const { data: p } = await supabase.from("player").select("id,lobby_id").eq("id", playerId).maybeSingle();
		if (!p || p.lobby_id !== lobbyId) return NextResponse.json({ error: "Not found" }, { status: 404 });
		const { error } = await supabase.from("player").update({ sudden_death: enabled }).eq("id", playerId);
		if (error) throw error;
		return NextResponse.json({ ok: true });
	} catch (e) {
		return NextResponse.json({ error: "Bad request" }, { status: 400 });
	}
}


