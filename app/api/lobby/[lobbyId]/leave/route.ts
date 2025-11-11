import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabaseClient";

export async function POST(req: Request, { params }: { params: Promise<{ lobbyId: string }> }) {
	const { lobbyId } = await params;
	const supabase = getServerSupabase();
	if (!supabase) return NextResponse.json({ ok: false }, { status: 501 });
	try {
		const { userId } = await req.json();
		if (!userId) return NextResponse.json({ ok: false, error: "Missing userId" }, { status: 400 });
		const { error } = await supabase.from("player").delete().eq("lobby_id", lobbyId).eq("user_id", userId);
		if (error) {
			console.error("leave lobby error", error);
			return NextResponse.json({ ok: false }, { status: 500 });
		}
		return NextResponse.json({ ok: true });
	} catch {
		return NextResponse.json({ ok: false, error: "bad request" }, { status: 400 });
	}
}


