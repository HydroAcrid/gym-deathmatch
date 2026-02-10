import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabaseClient";
import { onVoteResolved } from "@/lib/commentary";
import { getRequestUserId } from "@/lib/requestAuth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ activityId: string }> }) {
	const { activityId } = await params;
	const supabase = getServerSupabase();
	if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 501 });
	try {
		const userId = await getRequestUserId(req);
		if (!userId) return NextResponse.json({ error: "Missing user" }, { status: 401 });
		const body = await req.json();
		const newStatus = String(body.newStatus || "");
		const reason = body.reason ? String(body.reason) : null;
		if (!["approved", "rejected"].includes(newStatus)) return NextResponse.json({ error: "Invalid status" }, { status: 400 });
		const { data: act } = await supabase.from("manual_activities").select("*").eq("id", activityId).maybeSingle();
		if (!act) return NextResponse.json({ error: "Not found" }, { status: 404 });
		const { data: lobby } = await supabase.from("lobby").select("owner_user_id,owner_id").eq("id", act.lobby_id).maybeSingle();
		if (!lobby) return NextResponse.json({ error: "Lobby not found" }, { status: 404 });
		let ownerUserId = lobby.owner_user_id as string | null;
		if (!ownerUserId && lobby.owner_id) {
			const { data: ownerPlayer } = await supabase.from("player").select("user_id").eq("id", lobby.owner_id as string).maybeSingle();
			ownerUserId = (ownerPlayer?.user_id as string | null) ?? null;
		}
		if (ownerUserId !== userId) return NextResponse.json({ error: "Not owner" }, { status: 403 });
		const ownerPlayerId = (lobby.owner_id as string | null) ?? null;
		if (!ownerPlayerId) return NextResponse.json({ error: "Owner not found" }, { status: 403 });
		// update - owner override closes voting permanently
		await supabase.from("manual_activities").update({ 
			status: newStatus, 
			decided_at: new Date().toISOString(),
			vote_deadline: null // Clear deadline since owner decided
		}).eq("id", activityId);
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
