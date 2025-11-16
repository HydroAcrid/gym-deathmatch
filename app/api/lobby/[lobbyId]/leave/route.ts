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
		// If this player is the owner, reassign or clear ownership before delete
		const { data: lobby } = await supabase.from("lobby").select("owner_id, owner_user_id").eq("id", lobbyId).maybeSingle();
		if (lobby?.owner_id === me.id) {
			// Find another player to transfer ownership; otherwise clear owner
			const { data: other } = await supabase.from("player").select("id,user_id").eq("lobby_id", lobbyId).neq("id", me.id).limit(1).maybeSingle();
			if (other?.id) {
				// Transfer ownership to another player
				const { error: uerr } = await supabase.from("lobby").update({ owner_id: other.id, owner_user_id: other.user_id || null }).eq("id", lobbyId);
				if (uerr) {
					console.error("leave lobby transfer error", uerr);
					return NextResponse.json({ ok: false, error: "Failed to transfer ownership" }, { status: 500 });
				}
			} else {
				// No other players - clear owner (must set to NULL to satisfy foreign key)
				const { error: uerr } = await supabase.from("lobby").update({ owner_id: null, owner_user_id: null }).eq("id", lobbyId);
				if (uerr) {
					console.error("leave lobby clear owner error", uerr);
					return NextResponse.json({ ok: false, error: "Failed to clear ownership" }, { status: 500 });
				}
			}
			// Verify the update succeeded by re-fetching
			const { data: verify } = await supabase.from("lobby").select("owner_id").eq("id", lobbyId).maybeSingle();
			if (verify?.owner_id === me.id) {
				console.error("leave lobby: owner_id still points to leaving player after update");
				return NextResponse.json({ ok: false, error: "Failed to update ownership" }, { status: 500 });
			}
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


