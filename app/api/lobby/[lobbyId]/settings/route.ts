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
		// Pot settings (owner only UI)
		if (typeof body.initialPot === "number") patch.initial_pot = body.initialPot;
		if (typeof body.weeklyAnte === "number") patch.weekly_ante = body.weeklyAnte;
		if (typeof body.scalingEnabled === "boolean") patch.scaling_enabled = body.scalingEnabled;
		if (typeof body.perPlayerBoost === "number") patch.per_player_boost = body.perPlayerBoost;
		// Challenge settings (JSONB)
		if (body.challengeSettings !== undefined) patch.challenge_settings = body.challengeSettings;
		// Mode settings
		if (typeof body.mode === "string") patch.mode = body.mode;
		if (typeof body.suddenDeathEnabled === "boolean") patch.sudden_death_enabled = body.suddenDeathEnabled;
		if (Object.keys(patch).length === 0) return NextResponse.json({ error: "No changes" }, { status: 400 });
		// Update only provided fields; avoid upsert so NOT NULL columns (e.g. name) aren't required
		const { error } = await supabase.from("lobby").update(patch).eq("id", lobbyId);
		if (error) throw error;
		return NextResponse.json({ ok: true });
	} catch (e) {
		console.error("settings patch error", e);
		return NextResponse.json({ error: "Bad request" }, { status: 400 });
	}
}

