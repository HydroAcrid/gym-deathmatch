import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabaseClient";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ lobbyId: string }> }) {
	const { lobbyId } = await params;
	const supabase = getServerSupabase();
	if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 501 });
	try {
		const body = await req.json().catch(() => ({}));
		const ownerPlayerId = body?.ownerPlayerId as string | undefined;
		if (!ownerPlayerId) return NextResponse.json({ error: "ownerPlayerId required" }, { status: 400 });

		const { data: lobby } = await supabase.from("lobby").select("owner_id").eq("id", lobbyId).single();
		if (!lobby || lobby.owner_id !== ownerPlayerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

		const { error } = await supabase.from("lobby").delete().eq("id", lobbyId);
		if (error) throw error;
		return NextResponse.json({ ok: true });
	} catch (e) {
		console.error("owner delete lobby error", e);
		return NextResponse.json({ error: "Failed" }, { status: 500 });
	}
}


