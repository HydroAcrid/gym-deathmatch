import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabaseClient";

export async function POST(req: Request, { params }: { params: Promise<{ lobbyId: string }> }) {
	const { lobbyId } = await params;
	const supabase = getServerSupabase();
	if (!supabase) return NextResponse.json({ ok: false }, { status: 501 });
	try {
		const { userId } = await req.json();
		if (!userId) return NextResponse.json({ ok: false, error: "Missing userId" }, { status: 400 });
		// Find the player's row in this lobby
		const { data: me } = await supabase.from("player").select("id").eq("lobby_id", lobbyId).eq("user_id", userId).maybeSingle();
		if (!me?.id) return NextResponse.json({ ok: false, error: "Not in lobby" }, { status: 404 });
		// If this player is the owner, prevent them from leaving
		// Owner can only leave if they transfer ownership first (via /owner endpoint)
		const { data: lobby } = await supabase.from("lobby").select("owner_id, owner_user_id").eq("id", lobbyId).maybeSingle();
		if (lobby?.owner_id === me.id) {
			return NextResponse.json({ ok: false, error: "Lobby owner cannot leave. Transfer ownership first using the settings menu." }, { status: 403 });
		}
		const { error } = await supabase.from("player").delete().eq("id", me.id);
		if (error) {
			console.error("leave lobby error", error);
			return NextResponse.json({ ok: false }, { status: 500 });
		}
		return NextResponse.json({ ok: true });
	} catch {
		return NextResponse.json({ ok: false, error: "bad request" }, { status: 400 });
	}
}


