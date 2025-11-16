import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabaseClient";
import { jsonError, logError } from "@/lib/logger";

function currentWeekIndex(startIso: string) {
	const start = new Date(startIso);
	const now = new Date();
	const diffMs = now.getTime() - start.getTime();
	return Math.max(0, Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000))) + 1;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ lobbyId: string }> }) {
	const { lobbyId } = await params;
	const supabase = getServerSupabase();
	if (!supabase) return jsonError("SUPABASE_NOT_CONFIGURED", "Supabase not configured", 501);
	const { data: lobby } = await supabase.from("lobby").select("season_start,status,mode").eq("id", lobbyId).maybeSingle();
	if (!lobby) return jsonError("NOT_FOUND", "Lobby not found", 404);
	// In transition_spin for CHALLENGE_ROULETTE, derive week from existing submissions (+1),
	// so it doesn't jump to 3+ if season_start was earlier.
	let week = currentWeekIndex(lobby.season_start || new Date().toISOString());
	if (String(lobby.mode || "").startsWith("CHALLENGE_ROULETTE") && lobby.status === "transition_spin") {
		const { data: maxw } = await supabase
			.from("lobby_punishments")
			.select("week")
			.eq("lobby_id", lobbyId)
			.order("week", { ascending: false })
			.limit(1);
		week = ((maxw && maxw.length) ? ((maxw[0] as any).week as number) : 1);
	}
	const { data } = await supabase.from("lobby_punishments").select("*").eq("lobby_id", lobbyId).eq("week", week).order("created_at", { ascending: true });
	const active = (data || []).find((x: any) => x.active);
	// Locked: when any row is locked true (we treat as list-level lock)
	const locked = (data || []).length > 0 ? (data as any[]).every((x: any) => !!x.locked) : false;
	// Week status: get from active punishment or default to PENDING_PUNISHMENT
	const weekStatus = active?.week_status || (data && data.length > 0 ? "PENDING_PUNISHMENT" : null);
	return NextResponse.json({ week, items: data || [], active: active || null, locked, weekStatus });
}

// Suggest a punishment for current week
export async function POST(req: NextRequest, { params }: { params: Promise<{ lobbyId: string }> }) {
	const { lobbyId } = await params;
	const supabase = getServerSupabase();
	if (!supabase) return jsonError("SUPABASE_NOT_CONFIGURED", "Supabase not configured", 501);
	try {
		const body = await req.json();
		const { text, playerId } = body || {};
		if (!text || !playerId) return jsonError("MISSING_FIELDS", "Missing fields");
		const { data: lobby } = await supabase.from("lobby").select("season_start,status,mode").eq("id", lobbyId).maybeSingle();
		if (!lobby) return jsonError("NOT_FOUND", "Lobby not found", 404);
		let week = currentWeekIndex(lobby.season_start || new Date().toISOString());
		if (String(lobby.mode || "").startsWith("CHALLENGE_ROULETTE") && lobby.status === "transition_spin") {
			const { data: maxw } = await supabase
				.from("lobby_punishments")
				.select("week")
				.eq("lobby_id", lobbyId)
				.order("week", { ascending: false })
				.limit(1);
			week = ((maxw && maxw.length) ? ((maxw[0] as any).week as number) : 1);
		}
		const trimmed = String(text).slice(0, 50);
		// First, delete any existing submission for this player/week
		// Then insert the new one (simpler than upsert with partial unique index)
		const { error: deleteError } = await supabase
			.from("lobby_punishments")
			.delete()
			.eq("lobby_id", lobbyId)
			.eq("week", week)
			.eq("created_by", playerId);
		
		if (deleteError) {
			logError({ route: "POST /api/lobby/[id]/punishments", code: "PUNISHMENT_DELETE_FAILED", err: deleteError, lobbyId, actorPlayerId: playerId });
			// Continue anyway - might not exist
		}
		
		// Insert new submission (locked has a default value, so we don't need to set it)
		const { error: insertError } = await supabase
			.from("lobby_punishments")
			.insert({
				lobby_id: lobbyId,
				week,
				text: trimmed,
				created_by: playerId,
				active: false,
			});
		
		if (insertError) {
			logError({ route: "POST /api/lobby/[id]/punishments", code: "PUNISHMENT_INSERT_FAILED", err: insertError, lobbyId, actorPlayerId: playerId });
			return jsonError("PUNISHMENT_INSERT_FAILED", "Failed to save punishment", 400);
		}
		
		return NextResponse.json({ ok: true });
	} catch (e) {
		logError({ route: "POST /api/lobby/[id]/punishments", code: "PUNISHMENT_SAVE_FAILED", err: e, lobbyId });
		return jsonError("PUNISHMENT_SAVE_FAILED", "Failed to save punishment", 400);
	}
}


