import { NextRequest, NextResponse } from "next/server";
import { jsonError, logError } from "@/lib/logger";
import { resolveLobbyAccess } from "@/lib/lobbyAccess";
import { refreshLobbyLiveSnapshot } from "@/lib/liveSnapshotStore";

export async function POST(req: NextRequest, { params }: { params: Promise<{ lobbyId: string }> }) {
	const { lobbyId } = await params;
	const access = await resolveLobbyAccess(req, lobbyId);
	if (!access.ok) return jsonError(access.code, access.message, access.status);
	if (!access.isOwner) return jsonError("FORBIDDEN", "Owner only", 403);
	const supabase = access.supabase;
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
		void refreshLobbyLiveSnapshot(lobbyId);
		return NextResponse.json({ ok: true });
	} catch (e) {
		logError({ route: "POST /api/lobby/[id]/punishments/resolve-all", code: "BULK_RESOLVE_FAILED", err: e, lobbyId });
		return jsonError("BULK_RESOLVE_FAILED", "Failed to resolve", 400);
	}
}
