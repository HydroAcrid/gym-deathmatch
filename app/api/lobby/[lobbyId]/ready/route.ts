import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabaseClient";
import { onReadyChanged } from "@/lib/commentary";
import { jsonError, logError } from "@/lib/logger";

export async function POST(req: NextRequest, { params }: { params: Promise<{ lobbyId: string }> }) {
	const { lobbyId } = await params;
	const supabase = getServerSupabase();
	if (!supabase) return jsonError("SUPABASE_NOT_CONFIGURED", "Supabase not configured", 501);
	try {
		const body = await req.json();
		const { userId, ready } = body || {};
		if (!userId) return jsonError("MISSING_USER", "Missing userId");
		const { error } = await supabase.from("user_ready_states").upsert({ user_id: userId, lobby_id: lobbyId, ready: !!ready }, { onConflict: "user_id,lobby_id" });
		if (error) throw error;
		// Map user to player in this lobby for a nicer quip
		try {
			const { data: p } = await supabase.from("player").select("id").eq("lobby_id", lobbyId).eq("user_id", userId).maybeSingle();
			if (p?.id) await onReadyChanged(lobbyId, p.id as string, !!ready);
		} catch (e) {
			logError({ route: "POST /api/lobby/[id]/ready", code: "QUIP_READY_FAILED", err: e, lobbyId, actorUserId: userId });
		}
		return NextResponse.json({ ok: true });
	} catch (e) {
		logError({ route: "POST /api/lobby/[id]/ready", code: "READY_SAVE_FAILED", err: e, lobbyId });
		return jsonError("READY_SAVE_FAILED", "Failed to set ready", 400);
	}
}


