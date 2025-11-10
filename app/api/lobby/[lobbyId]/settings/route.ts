import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabaseClient";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ lobbyId: string }> }) {
	const { lobbyId } = await params;
	const supabase = getServerSupabase();
	if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 501 });
	try {
		const body = await req.json();
		const patch: any = {};
		if (typeof body.weeklyTarget === "number") patch.weekly_target = body.weeklyTarget;
		if (typeof body.initialLives === "number") patch.initial_lives = body.initialLives;
		if (typeof body.seasonStart === "string") patch.season_start = body.seasonStart;
		if (typeof body.seasonEnd === "string") patch.season_end = body.seasonEnd;
		if (Object.keys(patch).length === 0) return NextResponse.json({ error: "No changes" }, { status: 400 });
		patch.id = lobbyId;
		const { error } = await supabase.from("lobby").upsert(patch, { onConflict: "id" });
		if (error) throw error;
		return NextResponse.json({ ok: true });
	} catch (e) {
		console.error("settings patch error", e);
		return NextResponse.json({ error: "Bad request" }, { status: 400 });
	}
}


