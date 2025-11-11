import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabaseClient";

export async function POST(req: NextRequest, { params }: { params: Promise<{ lobbyId: string }> }) {
	const { lobbyId } = await params;
	const supabase = getServerSupabase();
	if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 501 });
	try {
		const body = await req.json();
		const ownerPlayerId = String(body.ownerPlayerId || "");
		const targetPlayerId = String(body.targetPlayerId || "");
		const delta = Number(body.delta || 0);
		const reason = body.reason ? String(body.reason) : null;
		if (![-3,-2,-1,1,2,3].includes(delta)) return NextResponse.json({ error: "Invalid delta" }, { status: 400 });
		const { data: lobby } = await supabase.from("lobby").select("owner_id").eq("id", lobbyId).maybeSingle();
		if (!lobby) return NextResponse.json({ error: "Lobby not found" }, { status: 404 });
		if (lobby.owner_id !== ownerPlayerId) return NextResponse.json({ error: "Not owner" }, { status: 403 });
		// ensure target in lobby
		const { data: t } = await supabase.from("player").select("id").eq("id", targetPlayerId).eq("lobby_id", lobbyId).maybeSingle();
		if (!t) return NextResponse.json({ error: "Target not in lobby" }, { status: 400 });
		await supabase.from("heart_adjustments").insert({ lobby_id: lobbyId, target_player_id: targetPlayerId, delta });
		await supabase.from("history_events").insert({
			lobby_id: lobbyId,
			actor_player_id: ownerPlayerId,
			target_player_id: targetPlayerId,
			type: "OWNER_ADJUST_HEARTS",
			payload: { targetPlayerId, delta, reason }
		});
		return NextResponse.json({ ok: true });
	} catch (e) {
		console.error("adjust hearts error", e);
		return NextResponse.json({ error: "Bad request" }, { status: 400 });
	}
}


