import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabaseClient";

export async function POST(req: Request) {
	const supabase = getServerSupabase();
	if (!supabase) return NextResponse.json({ error: "No DB" }, { status: 501 });
	const admin = (await req.json().catch(() => ({ admin: "" })))?.admin as string | undefined;
	if (!process.env.ADMIN_SECRET || admin !== process.env.ADMIN_SECRET) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}
	try {
		const lobbyId = "demo-lobby";
		await supabase.from("lobby").upsert({
			id: lobbyId,
			name: "Demo Lobby",
			season_number: 1,
			season_start: new Date().toISOString(),
			season_end: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
			cash_pool: 0,
			weekly_target: 3,
			initial_lives: 3,
			status: "pending"
		});
		await supabase.from("player").upsert([
			{ id: "demo-a", lobby_id: lobbyId, name: "Demo A", avatar_url: null, quip: "Let's go!" },
			{ id: "demo-b", lobby_id: lobbyId, name: "Demo B", avatar_url: null, quip: "Bring it." }
		]);
		return NextResponse.json({ ok: true, lobbyId });
	} catch {
		return NextResponse.json({ error: "seed failed" }, { status: 500 });
	}
}

