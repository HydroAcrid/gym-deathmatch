import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabaseClient";
import { jsonError, logError } from "@/lib/logger";
import { onPunishmentResolved } from "@/lib/commentary";
import { getRequestUserId } from "@/lib/requestAuth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const supabase = getServerSupabase();
	if (!supabase) return jsonError("SUPABASE_NOT_CONFIGURED", "Supabase not configured", 501);
	try {
		const actorUserId = await getRequestUserId(req);
		if (!actorUserId) return jsonError("UNAUTHORIZED", "Unauthorized", 401);
		// Fetch target row to check lobby ownership when needed
		const { data: row } = await supabase.from("user_punishments").select("id,user_id,lobby_id,resolved").eq("id", id).maybeSingle();
		if (!row) return jsonError("NOT_FOUND", "Punishment not found", 404);
		const { data: lobby } = await supabase.from("lobby").select("owner_user_id,owner_id").eq("id", row.lobby_id).maybeSingle();
		let ownerUserId = lobby?.owner_user_id as string | null;
		if (!ownerUserId && lobby?.owner_id) {
			const { data: ownerPlayer } = await supabase.from("player").select("user_id").eq("id", lobby.owner_id as string).maybeSingle();
			ownerUserId = (ownerPlayer?.user_id as string | null) ?? null;
		}
		const isOwner = ownerUserId === actorUserId;
		if (!isOwner && row.user_id !== actorUserId) return jsonError("FORBIDDEN", "Not allowed", 403);
		const { error } = await supabase.from("user_punishments").update({ resolved: true }).eq("id", id);
		if (error) throw error;
		// History event for visibility
		try {
			await supabase.from("history_events").insert({
				lobby_id: row.lobby_id,
				type: "PUNISHMENT_RESOLVED",
				target_player_id: null,
				payload: { punishmentId: id, userId: row.user_id }
			});
			// link user to player for nicer quip if possible
			const { data: p } = await supabase.from("player").select("id").eq("lobby_id", row.lobby_id).eq("user_id", row.user_id).maybeSingle();
			if (p?.id) await onPunishmentResolved(row.lobby_id as string, p.id as string);
		} catch (e) {
			logError({ route: "POST /api/punishments/[id]/resolve", code: "HISTORY_LOG_FAILED", err: e, lobbyId: row.lobby_id, actorUserId });
		}
		return NextResponse.json({ ok: true });
	} catch (e) {
		logError({ route: "POST /api/punishments/[id]/resolve", code: "RESOLVE_FAILED", err: e });
		return jsonError("RESOLVE_FAILED", "Failed to resolve punishment", 400);
	}
}
