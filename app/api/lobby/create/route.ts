import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabaseClient";

export async function POST(req: NextRequest) {
	const supabase = getServerSupabase();
	if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 501 });
	try {
		const body = await req.json();
		const {
			lobbyId,
			name,
			seasonStart,
			seasonEnd,
			weeklyTarget = 3,
			initialLives = 3,
			ownerId,
			ownerName,
			ownerAvatarUrl,
			ownerQuip
		} = body;
		if (!lobbyId || !name || !seasonStart || !seasonEnd) {
			return NextResponse.json({ error: "Missing fields" }, { status: 400 });
		}
		// Create owner player if provided and not existing
		if (ownerId && ownerName) {
			await supabase.from("player").upsert({
				id: ownerId,
				lobby_id: lobbyId, // temporary; we will create lobby then update player's lobby_id to lobbyId
				name: ownerName,
				avatar_url: ownerAvatarUrl ?? null,
				quip: ownerQuip ?? null
			});
		}
		// Create lobby
		const { error: lobbyErr } = await supabase.from("lobby").upsert({
			id: lobbyId,
			name,
			season_number: 1,
			season_start: seasonStart,
			season_end: seasonEnd,
			cash_pool: 0,
			weekly_target: weeklyTarget,
			initial_lives: initialLives,
			owner_id: ownerId ?? null
		});
		if (lobbyErr) throw lobbyErr;
		// If owner exists but has different lobby_id, ensure row references the lobby (optional)
		if (ownerId && ownerName) {
			await supabase.from("player").upsert({
				id: ownerId,
				lobby_id: lobbyId,
				name: ownerName,
				avatar_url: ownerAvatarUrl ?? null,
				quip: ownerQuip ?? null
			});
		}
		return NextResponse.json({ ok: true, id: lobbyId });
	} catch (e) {
		console.error("create lobby error", e);
		return NextResponse.json({ error: "Bad request" }, { status: 400 });
	}
}


