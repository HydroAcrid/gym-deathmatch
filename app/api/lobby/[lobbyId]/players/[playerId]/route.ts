import { NextRequest, NextResponse } from "next/server";
import { resolveLobbyAccess } from "@/lib/lobbyAccess";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ lobbyId: string; playerId: string }> }) {
	const { lobbyId, playerId } = await params;
	const access = await resolveLobbyAccess(req, lobbyId);
	if (!access.ok) return NextResponse.json({ error: access.message }, { status: access.status });
	if (!access.isOwner) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	const supabase = access.supabase;
	try {
		if (playerId === access.ownerPlayerId) return NextResponse.json({ error: "Cannot remove owner" }, { status: 400 });
		const { data: targetPlayer } = await supabase
			.from("player")
			.select("id,user_id")
			.eq("id", playerId)
			.eq("lobby_id", lobbyId)
			.maybeSingle();
		if (!targetPlayer?.id) return NextResponse.json({ error: "Player not found" }, { status: 404 });
		if (targetPlayer.user_id && targetPlayer.user_id === access.userId) {
			return NextResponse.json({ error: "Owner cannot remove their own membership" }, { status: 400 });
		}
		const { data: lobby } = await supabase
			.from("lobby")
			.select("owner_user_id")
			.eq("id", lobbyId)
			.maybeSingle();
		if (targetPlayer.user_id && lobby?.owner_user_id && targetPlayer.user_id === lobby.owner_user_id) {
			return NextResponse.json({ error: "Cannot remove owner" }, { status: 400 });
		}

		const { error } = await supabase.from("player").delete().match({ id: playerId, lobby_id: lobbyId });
		if (error) throw error;
		return NextResponse.json({ ok: true });
	} catch (e) {
		console.error("owner delete player error", e);
		return NextResponse.json({ error: "Failed" }, { status: 500 });
	}
}
