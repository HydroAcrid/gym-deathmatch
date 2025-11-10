import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabaseClient";

function isAdmin(req: NextRequest): boolean {
	const header = req.headers.get("authorization") || "";
	const secret = process.env.ADMIN_SECRET || "";
	return header === `Bearer ${secret}` && !!secret;
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ lobbyId: string; playerId: string }> }) {
	if (!isAdmin(req)) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}
	const { lobbyId, playerId } = await params;
	const supabase = getServerSupabase();
	if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 501 });
	try {
		const { error } = await supabase.from("player").delete().match({ id: playerId, lobby_id: lobbyId });
		if (error) throw error;
		return NextResponse.json({ ok: true });
	} catch (e) {
		console.error("admin delete player error", e);
		return NextResponse.json({ error: "Failed" }, { status: 500 });
	}
}


