import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabaseClient";
import { jsonError, logError } from "@/lib/logger";

export async function POST(req: NextRequest, { params }: { params: Promise<{ lobbyId: string }> }) {
	const { lobbyId } = await params;
	const supabase = getServerSupabase();
	if (!supabase) return jsonError("SUPABASE_NOT_CONFIGURED", "Supabase not configured", 501);
	try {
		const body = await req.json();
		const targetUserId = String(body?.userId || "");
		if (!targetUserId) return jsonError("MISSING_USER", "Missing userId");
		const { error } = await supabase
			.from("user_punishments")
			.update({ resolved: true })
			.eq("lobby_id", lobbyId)
			.eq("user_id", targetUserId)
			.eq("resolved", false);
		if (error) throw error;
		await supabase.from("history_events").insert({
			lobby_id: lobbyId,
			type: "PUNISHMENTS_RESOLVED_BULK",
			payload: { userId: targetUserId }
		});
		return NextResponse.json({ ok: true });
	} catch (e) {
		logError({ route: "POST /api/lobby/[id]/punishments/resolve-all", code: "BULK_RESOLVE_FAILED", err: e, lobbyId });
		return jsonError("BULK_RESOLVE_FAILED", "Failed to resolve", 400);
	}
}


