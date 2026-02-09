import { NextRequest, NextResponse } from "next/server";
import { resolveLobbyAccess } from "@/lib/lobbyAccess";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ lobbyId: string }> }) {
	const { lobbyId } = await params;
	const access = await resolveLobbyAccess(req, lobbyId);
	if (!access.ok) return NextResponse.json({ error: access.message }, { status: access.status });
	if (!access.memberPlayerId) return NextResponse.json({ error: "Not a lobby member" }, { status: 403 });
	if (!access.isOwner) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	const supabase = access.supabase;
	try {
		const { error } = await supabase.from("lobby").delete().eq("id", lobbyId);
		if (error) throw error;
		return NextResponse.json({ ok: true });
	} catch (e) {
		console.error("owner delete lobby error", e);
		return NextResponse.json({ error: "Failed" }, { status: 500 });
	}
}

