import { NextRequest, NextResponse } from "next/server";
import { jsonError, logError } from "@/lib/logger";
import { resolveLobbyAccess } from "@/lib/lobbyAccess";
import { resolvePunishmentWeek } from "@/lib/challengeWeek";
import { refreshLobbyLiveSnapshot } from "@/lib/liveSnapshotStore";

type LobbyPunishmentLockRow = {
	season_start: string | null;
	status: string | null;
	mode: string | null;
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ lobbyId: string }> }) {
	const { lobbyId } = await params;
	const access = await resolveLobbyAccess(req, lobbyId);
	if (!access.ok) return jsonError(access.code, access.message, access.status);
	if (!access.isOwner) return jsonError("FORBIDDEN", "Owner only", 403);
	const supabase = access.supabase;
	try {
		const body = await req.json();
		const locked = !!body?.locked;
			const { data: lobbyData } = await supabase.from("lobby").select("season_start,status,mode").eq("id", lobbyId).maybeSingle();
			const lobby = (lobbyData as LobbyPunishmentLockRow | null) ?? null;
			if (!lobby) return jsonError("NOT_FOUND", "Lobby not found", 404);
			const week = await resolvePunishmentWeek(supabase, lobbyId, {
				mode: lobby.mode,
				status: lobby.status,
				seasonStart: lobby.season_start
			});
		// Set locked on all submissions for the week
		await supabase.from("lobby_punishments").update({ locked }).eq("lobby_id", lobbyId).eq("week", week);
		void refreshLobbyLiveSnapshot(lobbyId);
		return NextResponse.json({ ok: true, locked });
	} catch (e) {
		logError({ route: "POST /api/lobby/[id]/punishments/lock", code: "LOCK_FAILED", err: e, lobbyId });
		return jsonError("LOCK_FAILED", "Failed to lock/unlock", 400);
	}
}
