import { NextRequest, NextResponse } from "next/server";
import { resolveLobbyAccess } from "@/lib/lobbyAccess";
import { LiveSnapshotService } from "@/domains/lobby/services/liveSnapshotService";
import { getLobbyLiveSnapshot, saveLobbyLiveSnapshot } from "@/lib/liveSnapshotStore";

function readDebugFlag(req: Request): boolean {
	try {
		const url = new URL(req.url);
		return url.searchParams.get("debug") === "1";
	} catch {
		return false;
	}
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ lobbyId: string }> }) {
	const { lobbyId } = await params;
	const debugMode = readDebugFlag(req);
	const access = await resolveLobbyAccess(req, lobbyId);
	if (!access.ok) {
		return NextResponse.json({ error: access.message }, { status: access.status });
	}
	if (!access.memberPlayerId && !access.isOwner) {
		return NextResponse.json({ error: "Not a lobby member" }, { status: 403 });
	}

	const requestTimezoneOffsetMinutes = LiveSnapshotService.readRequestTimezoneOffsetMinutes(req);

	if (!debugMode) {
		const snapshot = await getLobbyLiveSnapshot(lobbyId, requestTimezoneOffsetMinutes);
		if (snapshot) return NextResponse.json(snapshot, { status: 200 });
	}

	const live = await LiveSnapshotService.getLobbySnapshot({
		lobbyId,
		debugMode,
		requestTimezoneOffsetMinutes,
	});
	if (!live) {
		return NextResponse.json({ error: "Lobby not found" }, { status: 404 });
	}
	void saveLobbyLiveSnapshot(lobbyId, live, requestTimezoneOffsetMinutes);
	return NextResponse.json(live, { status: 200 });
}
