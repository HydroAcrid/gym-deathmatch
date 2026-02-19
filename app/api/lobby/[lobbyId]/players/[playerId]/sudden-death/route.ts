import { NextRequest, NextResponse } from "next/server";
import { resolveLobbyAccess } from "@/lib/lobbyAccess";
import { refreshLobbyLiveSnapshot } from "@/lib/liveSnapshotStore";

export async function POST(req: NextRequest, { params }: { params: Promise<{ lobbyId: string; playerId: string }> }) {
	const { lobbyId, playerId } = await params;
	const access = await resolveLobbyAccess(req, lobbyId);
	if (!access.ok) return NextResponse.json({ error: access.message }, { status: access.status });
	if (!access.isOwner) return NextResponse.json({ error: "Owner only" }, { status: 403 });
	const supabase = access.supabase;
	try {
		const body = await req.json();
		const enabled = !!body.enabled;
		// Ensure player belongs to lobby
		const { data: p } = await supabase.from("player").select("id,lobby_id").eq("id", playerId).maybeSingle();
		if (!p || p.lobby_id !== lobbyId) return NextResponse.json({ error: "Not found" }, { status: 404 });
		const { error } = await supabase.from("player").update({ sudden_death: enabled }).eq("id", playerId);
		if (error) throw error;
		void refreshLobbyLiveSnapshot(lobbyId);
		return NextResponse.json({ ok: true });
	} catch {
		return NextResponse.json({ error: "Bad request" }, { status: 400 });
	}
}
