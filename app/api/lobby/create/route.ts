import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabaseClient";

export async function POST(req: Request) {
	const supabase = getServerSupabase();
	if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 501 });
	try {
		const body = await req.json();
		const lobby = {
			id: body.lobbyId,
			name: body.name,
			season_number:  body.seasonNumber ?? 1,
			season_start: body.seasonStart,
			season_end: body.seasonEnd,
			cash_pool: 0,
			weekly_target: body.weeklyTarget ?? 3,
			initial_lives: body.initialLives ?? 3,
			owner_id: body.ownerId || null,
			status: body.status || "pending"
		};
		const { error: lerr } = await supabase.from("lobby").insert(lobby);
		if (lerr) {
			console.error("create lobby error", lerr);
			return NextResponse.json({ error: "Failed to create lobby" }, { status: 500 });
		}
		// If an owner player should be created, do it
		if (body.ownerId) {
			let ownerName = body.ownerName || null;
			let ownerAvatarUrl = body.ownerAvatarUrl || null;
			// Enrich from user_profile if available
			try {
				const { data: prof } = await supabase.from("user_profile").select("*").eq("user_id", body.userId).maybeSingle();
				if (!ownerName) ownerName = prof?.display_name ?? null;
				if (!ownerAvatarUrl) ownerAvatarUrl = prof?.avatar_url ?? null;
			} catch { /* ignore */ }
			const player = {
				id: body.ownerId,
				lobby_id: body.lobbyId,
				name: ownerName ?? "Owner",
				avatar_url: ownerAvatarUrl ?? null,
				location: body.ownerLocation ?? null,
				quip: body.ownerQuip ?? null,
				user_id: body.userId || null
			};
			const { error: perr } = await supabase.from("player").insert(player);
			if (perr) {
				console.error("owner player insert error", perr);
			}
		}
		return NextResponse.json({ ok: true });
	} catch (e) {
		return NextResponse.json({ error: "Bad request" }, { status: 400 });
	}
}

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


