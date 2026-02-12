import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabaseClient";
import { getRequestUserId } from "@/lib/requestAuth";
import {
	enqueueCommentaryEvent,
	ensureCommentaryQueueReady,
	isCommentaryQueueUnavailableError,
} from "@/lib/commentaryEvents";
import { processCommentaryQueue } from "@/lib/commentaryProcessor";

export async function POST(req: NextRequest, { params }: { params: Promise<{ activityId: string }> }) {
	const { activityId } = await params;
	const supabase = getServerSupabase();
	if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 501 });
	try {
		await ensureCommentaryQueueReady();
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
		await enqueueCommentaryEvent({
			lobbyId: String(act.lobby_id),
			type: "VOTE_RESOLVED",
			key: `vote-result:${activityId}:${newStatus}`,
			payload: {
				activityId: String(activityId),
				playerId: String(act.player_id),
				result: newStatus as "approved" | "rejected",
				reason: reason ?? "owner_override",
			},
		});
		void processCommentaryQueue({ lobbyId: String(act.lobby_id), limit: 80, maxMs: 600 }).catch((err) => {
			console.error("override commentary tail-process failed", err);
		});
		return NextResponse.json({ ok: true });
	} catch (e) {
		if (isCommentaryQueueUnavailableError(e)) {
			return NextResponse.json(
				{ error: "COMMENTARY_QUEUE_UNAVAILABLE", message: "Run latest SQL schema before overriding." },
				{ status: 503 }
			);
		}
		console.error("override error", e);
		return NextResponse.json({ error: "Bad request" }, { status: 400 });
	}
}
