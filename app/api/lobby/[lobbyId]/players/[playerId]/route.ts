import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabaseClient";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ lobbyId: string; playerId: string }> }) {
	const { lobbyId, playerId } = await params;
	const supabase = getServerSupabase();
	if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 501 });
	try {
		const body = await req.json().catch(() => ({}));
		const ownerPlayerId = body?.ownerPlayerId as string | undefined;
		if (!ownerPlayerId) return NextResponse.json({ error: "ownerPlayerId required" }, { status: 400 });

		const { data: lobby } = await supabase.from("lobby").select("owner_id").eq("id", lobbyId).single();
		if (!lobby || lobby.owner_id !== ownerPlayerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		if (playerId === lobby.owner_id) return NextResponse.json({ error: "Cannot remove owner" }, { status: 400 });

		const { error } = await supabase.from("player").delete().match({ id: playerId, lobby_id: lobbyId });
		if (error) throw error;
		return NextResponse.json({ ok: true });
	} catch (e) {
		console.error("owner delete player error", e);
		return NextResponse.json({ error: "Failed" }, { status: 500 });
	}
}


