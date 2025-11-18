import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabaseClient";
import { onVoteResolved } from "@/lib/commentary";

export async function POST(req: NextRequest, { params }: { params: Promise<{ activityId: string }> }) {
	const { activityId } = await params;
	const supabase = getServerSupabase();
	if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 501 });
	try {
		const body = await req.json();
		const ownerPlayerId = String(body.ownerPlayerId || "");
		const newStatus = String(body.newStatus || "");
		const reason = body.reason ? String(body.reason) : null;
		if (!["approved", "rejected"].includes(newStatus)) return NextResponse.json({ error: "Invalid status" }, { status: 400 });
		const { data: act } = await supabase.from("manual_activities").select("*").eq("id", activityId).maybeSingle();
		if (!act) return NextResponse.json({ error: "Not found" }, { status: 404 });
		// verify owner
		const { data: owner } = await supabase.from("player").select("id,lobby_id").eq("id", ownerPlayerId).maybeSingle();
		if (!owner || owner.lobby_id !== act.lobby_id) return NextResponse.json({ error: "Not in lobby" }, { status: 400 });
		const { data: lobby } = await supabase.from("lobby").select("owner_user_id,owner_id").eq("id", act.lobby_id).maybeSingle();
		if (!lobby) return NextResponse.json({ error: "Lobby not found" }, { status: 404 });
		// allow if this player is the owner row in this lobby
		if (lobby.owner_id !== ownerPlayerId) return NextResponse.json({ error: "Not owner" }, { status: 403 });
		// update
		await supabase.from("manual_activities").update({ status: newStatus, decided_at: new Date().toISOString() }).eq("id", activityId);
		await supabase.from("history_events").insert({
			lobby_id: act.lobby_id,
			actor_player_id: ownerPlayerId,
			target_player_id: act.player_id,
			type: "OWNER_OVERRIDE_ACTIVITY",
			payload: { activityId, previousStatus: act.status, newStatus, reason }
		});
		// Generate commentary (like voting does)
		try {
			const activity = { id: activityId, playerId: act.player_id, lobbyId: act.lobby_id } as any;
			await onVoteResolved(act.lobby_id as any, activity as any, newStatus as "approved" | "rejected");
		} catch { /* ignore */ }
		return NextResponse.json({ ok: true });
	} catch (e) {
		console.error("override error", e);
		return NextResponse.json({ error: "Bad request" }, { status: 400 });
	}
}


