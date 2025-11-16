import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabaseClient";
import { jsonError, logError } from "@/lib/logger";

// Get week-ready states for a specific week
export async function GET(req: NextRequest, { params }: { params: Promise<{ lobbyId: string }> }) {
	const { lobbyId } = await params;
	const supabase = getServerSupabase();
	if (!supabase) return jsonError("SUPABASE_NOT_CONFIGURED", "Supabase not configured", 501);
	
	const { searchParams } = new URL(req.url);
	const week = parseInt(searchParams.get("week") || "1", 10);
	
	try {
		const { data } = await supabase
			.from("week_ready_states")
			.select("player_id, ready")
			.eq("lobby_id", lobbyId)
			.eq("week", week);
		
		const readyByPlayer: Record<string, boolean> = {};
		(data || []).forEach((r: any) => {
			readyByPlayer[r.player_id] = !!r.ready;
		});
		
		return NextResponse.json({ ok: true, readyByPlayer });
	} catch (e) {
		logError({ route: "GET /api/lobby/[id]/week-ready", code: "WEEK_READY_LOAD_FAILED", err: e, lobbyId });
		return jsonError("WEEK_READY_LOAD_FAILED", "Failed to load week ready states", 400);
	}
}

// Set week-ready state for a player
export async function POST(req: NextRequest, { params }: { params: Promise<{ lobbyId: string }> }) {
	const { lobbyId } = await params;
	const supabase = getServerSupabase();
	if (!supabase) return jsonError("SUPABASE_NOT_CONFIGURED", "Supabase not configured", 501);
	
	try {
		const body = await req.json();
		const { playerId, week, ready } = body || {};
		if (!playerId || week === undefined) return jsonError("MISSING_FIELDS", "Missing playerId or week");
		
		const { error } = await supabase
			.from("week_ready_states")
			.upsert(
				{
					lobby_id: lobbyId,
					week,
					player_id: playerId,
					ready: !!ready,
				},
				{ onConflict: "lobby_id,week,player_id" }
			);
		
		if (error) throw error;
		
		console.log("[WeekSetup] Player ready toggled", { playerId, week, ready });
		return NextResponse.json({ ok: true });
	} catch (e) {
		logError({ route: "POST /api/lobby/[id]/week-ready", code: "WEEK_READY_SAVE_FAILED", err: e, lobbyId });
		return jsonError("WEEK_READY_SAVE_FAILED", "Failed to set week ready state", 400);
	}
}

