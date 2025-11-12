import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabaseClient";
import { jsonError, logError } from "@/lib/logger";
import { onPunishmentResolved } from "@/lib/commentary";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const supabase = getServerSupabase();
	if (!supabase) return jsonError("SUPABASE_NOT_CONFIGURED", "Supabase not configured", 501);
	try {
		const body = await req.json();
		const actorUserId = body?.userId as string | undefined;
		const approve = !!body?.approve; // owner approval path
		// Fetch target row to check lobby ownership when needed
		const { data: row } = await supabase.from("user_punishments").select("id,user_id,lobby_id,resolved").eq("id", id).maybeSingle();
		if (!row) return jsonError("NOT_FOUND", "Punishment not found", 404);
		// Ownership check is done by RLS; here we just attempt updates:
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


