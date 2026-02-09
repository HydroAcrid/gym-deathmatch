import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabaseClient";
import { onAllReady, onReadyChanged } from "@/lib/commentary";
import { jsonError, logError } from "@/lib/logger";
import { getRequestUserId } from "@/lib/requestAuth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ lobbyId: string }> }) {
	const { lobbyId } = await params;
	const supabase = getServerSupabase();
	if (!supabase) return jsonError("SUPABASE_NOT_CONFIGURED", "Supabase not configured", 501);
	try {
		const userId = await getRequestUserId(req);
		if (!userId) return jsonError("UNAUTHORIZED", "Unauthorized", 401);
		const body = await req.json();
		const { ready } = body || {};
		const { data: member } = await supabase.from("player").select("id").eq("lobby_id", lobbyId).eq("user_id", userId).maybeSingle();
		if (!member?.id) return jsonError("FORBIDDEN", "Not a lobby member", 403);
		const { error } = await supabase.from("user_ready_states").upsert({ user_id: userId, lobby_id: lobbyId, ready: !!ready }, { onConflict: "user_id,lobby_id" });
		if (error) throw error;
		// Map user to player in this lobby for a nicer quip
		try {
			const { data: p } = await supabase.from("player").select("id").eq("lobby_id", lobbyId).eq("user_id", userId).maybeSingle();
			if (p?.id) await onReadyChanged(lobbyId, p.id as string, !!ready);
			if (ready) {
				const { data: states } = await supabase.from("user_ready_states").select("ready").eq("lobby_id", lobbyId);
				const readyRows = (states ?? []) as Array<{ ready: boolean | null }>;
				if (readyRows.length > 0 && readyRows.every((s) => !!s.ready)) {
					await onAllReady(lobbyId);
				}
			}
		} catch (e) {
			logError({ route: "POST /api/lobby/[id]/ready", code: "QUIP_READY_FAILED", err: e, lobbyId, actorUserId: userId });
		}
		return NextResponse.json({ ok: true });
	} catch (e) {
		logError({ route: "POST /api/lobby/[id]/ready", code: "READY_SAVE_FAILED", err: e, lobbyId });
		return jsonError("READY_SAVE_FAILED", "Failed to set ready", 400);
	}
}
