import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabaseClient";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ lobbyId: string }> }) {
	const { lobbyId } = await params;
	const supabase = getServerSupabase();
	if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 501 });
	try {
		const body = await req.json();
		const ownerPlayerId = body?.ownerPlayerId as string | undefined;
		const newOwnerPlayerId = body?.newOwnerPlayerId as string | undefined;
		if (!ownerPlayerId || !newOwnerPlayerId) return NextResponse.json({ error: "ownerPlayerId and newOwnerPlayerId required" }, { status: 400 });
		if (newOwnerPlayerId === ownerPlayerId) return NextResponse.json({ error: "No change" }, { status: 400 });

		const { data: lobby } = await supabase.from("lobby").select("owner_id").eq("id", lobbyId).single();
		if (!lobby || lobby.owner_id !== ownerPlayerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		// Ensure new owner is a player in this lobby
		const { data: exists } = await supabase.from("player").select("id").match({ id: newOwnerPlayerId, lobby_id: lobbyId }).single();
		if (!exists) return NextResponse.json({ error: "Player not in lobby" }, { status: 400 });

		const { error } = await supabase.from("lobby").update({ owner_id: newOwnerPlayerId }).eq("id", lobbyId);
		if (error) throw error;
		return NextResponse.json({ ok: true });
	} catch (e) {
		console.error("transfer owner error", e);
		return NextResponse.json({ error: "Failed" }, { status: 500 });
	}
}


