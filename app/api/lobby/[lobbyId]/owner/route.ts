import { NextRequest, NextResponse } from "next/server";
import { resolveLobbyAccess } from "@/lib/lobbyAccess";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ lobbyId: string }> }) {
	const { lobbyId } = await params;
	const access = await resolveLobbyAccess(req, lobbyId);
	if (!access.ok) return NextResponse.json({ error: access.message }, { status: access.status });
	if (!access.memberPlayerId) return NextResponse.json({ error: "Not a lobby member" }, { status: 403 });
	if (!access.isOwner) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	const supabase = access.supabase;
	try {
		const body = await req.json();
		const newOwnerPlayerId = body?.newOwnerPlayerId as string | undefined;
		if (!newOwnerPlayerId) return NextResponse.json({ error: "newOwnerPlayerId required" }, { status: 400 });
		if (newOwnerPlayerId === access.ownerPlayerId) return NextResponse.json({ error: "No change" }, { status: 400 });
		// Ensure new owner is a player in this lobby
		const { data: exists } = await supabase.from("player").select("id").match({ id: newOwnerPlayerId, lobby_id: lobbyId }).single();
		if (!exists) return NextResponse.json({ error: "Player not in lobby" }, { status: 400 });

		const { data: ownerPlayer } = await supabase.from("player").select("user_id").eq("id", newOwnerPlayerId).maybeSingle();
		const { error } = await supabase
			.from("lobby")
			.update({ owner_id: newOwnerPlayerId, owner_user_id: ownerPlayer?.user_id ?? null })
			.eq("id", lobbyId);
		if (error) throw error;
		return NextResponse.json({ ok: true });
	} catch (e) {
		console.error("transfer owner error", e);
		return NextResponse.json({ error: "Failed" }, { status: 500 });
	}
}

