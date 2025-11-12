import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabaseClient";
import { jsonError, logError } from "@/lib/logger";

function currentWeekIndex(startIso: string) {
	const start = new Date(startIso);
	const now = new Date();
	const diffMs = now.getTime() - start.getTime();
	return Math.max(0, Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000))) + 1;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ lobbyId: string }> }) {
	const { lobbyId } = await params;
	const supabase = getServerSupabase();
	if (!supabase) return jsonError("SUPABASE_NOT_CONFIGURED", "Supabase not configured", 501);
	try {
		const body = await req.json();
		const locked = !!body?.locked;
		const { data: lobby } = await supabase.from("lobby").select("season_start").eq("id", lobbyId).maybeSingle();
		if (!lobby) return jsonError("NOT_FOUND", "Lobby not found", 404);
		const week = currentWeekIndex(lobby.season_start || new Date().toISOString());
		// Set locked on all submissions for the week
		await supabase.from("lobby_punishments").update({ locked }).eq("lobby_id", lobbyId).eq("week", week);
		return NextResponse.json({ ok: true, locked });
	} catch (e) {
		logError({ route: "POST /api/lobby/[id]/punishments/lock", code: "LOCK_FAILED", err: e, lobbyId });
		return jsonError("LOCK_FAILED", "Failed to lock/unlock", 400);
	}
}


