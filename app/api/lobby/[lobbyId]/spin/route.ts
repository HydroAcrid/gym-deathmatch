import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabaseClient";
import { onSpin } from "@/lib/commentary";
import { jsonError, logError } from "@/lib/logger";

function currentWeekIndex(startIso: string) {
	const start = new Date(startIso);
	const now = new Date();
	const diffMs = now.getTime() - start.getTime();
	return Math.max(0, Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000))) + 1;
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ lobbyId: string }> }) {
	const { lobbyId } = await params;
	const supabase = getServerSupabase();
	if (!supabase) return jsonError("SUPABASE_NOT_CONFIGURED", "Supabase not configured", 501);
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
	const { data: items } = await supabase.from("lobby_punishments").select("*").eq("lobby_id", lobbyId).eq("week", week);
	const pool = (items || []).filter((x: any) => !x.active);
	if (!pool.length) return jsonError("NO_ITEMS", "Nothing to spin");
	const chosen = pool[Math.floor(Math.random() * pool.length)];
	// Mark chosen active, all others not active, and set week_status to PENDING_CONFIRMATION
	await supabase.from("lobby_punishments").update({ active: false, week_status: null }).eq("lobby_id", lobbyId).eq("week", week);
	await supabase.from("lobby_punishments").update({ active: true, week_status: "PENDING_CONFIRMATION" }).eq("id", chosen.id);
	
	// Reset all week-ready states for this week
	try {
		await supabase.from("week_ready_states").delete().eq("lobby_id", lobbyId).eq("week", week);
	} catch (e) {
		logError({ route: "POST /api/lobby/[id]/spin", code: "READY_RESET_FAILED", err: e, lobbyId });
	}
	
	// Log an event for the feed
	try {
		await supabase.from("history_events").insert({
			lobby_id: lobbyId,
			type: "PUNISHMENT_SPUN",
			payload: { week, text: chosen.text }
		});
	} catch (e) {
		logError({ route: "POST /api/lobby/[id]/spin", code: "HISTORY_LOG_FAILED", err: e, lobbyId });
	}
	try { await onSpin(lobbyId, chosen.text as string); } catch (e) {
		logError({ route: "POST /api/lobby/[id]/spin", code: "QUIP_SPIN_FAILED", err: e, lobbyId });
	}
	return NextResponse.json({ ok: true, chosen });
}


