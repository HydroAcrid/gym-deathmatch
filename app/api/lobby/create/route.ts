import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabaseClient";

export async function POST(req: NextRequest) {
	const supabase = getServerSupabase();
	if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 501 });
	try {
		const body = await req.json();
		const lobby = {
			id: body.lobbyId,
			name: body.name,
			season_number: body.seasonNumber ?? 1,
			season_start: body.seasonStart,
			season_end: body.seasonEnd,
			cash_pool: 0,
			weekly_target: body.weeklyTarget ?? 3,
			initial_lives: body.initialLives ?? 3,
			owner_id: body.ownerId || null,
			owner_user_id: body.userId || null,
			status: body.status || "pending"
		};
		const { error: lerr } = await supabase.from("lobby").insert(lobby);
		if (lerr) {
			console.error("create lobby error", lerr);
			return NextResponse.json({ error: "Failed to create lobby" }, { status: 500 });
		}
		// Ensure owner player created/updated from user profile
		if (body.ownerId) {
			let ownerName = body.ownerName || null;
			let ownerAvatarUrl = body.ownerAvatarUrl || null;
			try {
				const { data: prof } = await supabase.from("user_profile").select("*").eq("user_id", body.userId).maybeSingle();
				if (!ownerName) ownerName = prof?.display_name ?? null;
				if (!ownerAvatarUrl) ownerAvatarUrl = prof?.avatar_url ?? null;
			} catch { /* ignore */ }
			await supabase.from("player").upsert({
				id: body.ownerId,
				lobby_id: body.lobbyId,
				name: ownerName ?? "Owner",
				avatar_url: ownerAvatarUrl ?? null,
				location: body.ownerLocation ?? null,
				quip: body.ownerQuip ?? null,
				user_id: body.userId || null
			});
		}
		return NextResponse.json({ ok: true, id: body.lobbyId });
	} catch (e) {
		return NextResponse.json({ error: "Bad request" }, { status: 400 });
	}
}

