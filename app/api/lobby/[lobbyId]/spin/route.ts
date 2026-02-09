import { NextRequest, NextResponse } from "next/server";
import { onSpin } from "@/lib/commentary";
import { jsonError, logError } from "@/lib/logger";
import { resolveLobbyAccess } from "@/lib/lobbyAccess";

function currentWeekIndex(startIso: string) {
	const start = new Date(startIso);
	const now = new Date();
	const diffMs = now.getTime() - start.getTime();
	return Math.max(0, Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000))) + 1;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ lobbyId: string }> }) {
	const { lobbyId } = await params;
	const access = await resolveLobbyAccess(req, lobbyId);
	if (!access.ok) return jsonError(access.code, access.message, access.status);
	if (!access.memberPlayerId) return jsonError("FORBIDDEN", "Not a lobby member", 403);
	if (!access.isOwner) return jsonError("FORBIDDEN", "Owner only", 403);
	const supabase = access.supabase;

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
	let spinEvent: { id: string; started_at: string; winner_item_id: string } | null = null;
	let createdSpinEvent = false;
	const { data: existingSpinEvent } = await supabase
		.from("lobby_spin_events")
		.select("id,started_at,winner_item_id")
		.eq("lobby_id", lobbyId)
		.eq("week", week)
		.maybeSingle();
	spinEvent = (existingSpinEvent as any) ?? null;
	if (!spinEvent) {
		const { data: items } = await supabase.from("lobby_punishments").select("*").eq("lobby_id", lobbyId).eq("week", week);
		const pool = (items || []).filter((x: any) => !x.active);
		if (!pool.length) return jsonError("NO_ITEMS", "Nothing to spin");
		const candidateWinner = pool[Math.floor(Math.random() * pool.length)];
		const startedAt = new Date(Date.now() + 1500).toISOString();
		try {
			const { data, error } = await supabase
				.from("lobby_spin_events")
				.insert({
					lobby_id: lobbyId,
					week,
					winner_item_id: candidateWinner.id,
					started_at: startedAt,
					created_by: access.memberPlayerId
				})
				.select("id,started_at,winner_item_id")
				.single();
			if (error) {
				if (error.code === "23505") {
					const { data: existing } = await supabase
						.from("lobby_spin_events")
						.select("id,started_at,winner_item_id")
						.eq("lobby_id", lobbyId)
						.eq("week", week)
						.maybeSingle();
					spinEvent = (existing as any) ?? null;
				} else {
					throw error;
				}
			} else {
				spinEvent = data as any;
				createdSpinEvent = true;
			}
		} catch (e) {
			logError({ route: "POST /api/lobby/[id]/spin", code: "SPIN_EVENT_WRITE_FAILED", err: e, lobbyId });
		}
	}
	if (!spinEvent) return jsonError("SPIN_EVENT_UNAVAILABLE", "Unable to create spin event", 500);
	const { data: chosen } = await supabase
		.from("lobby_punishments")
		.select("*")
		.eq("id", spinEvent.winner_item_id)
		.maybeSingle();
	if (!chosen) return jsonError("SPIN_WINNER_NOT_FOUND", "Spin winner not found", 500);
	// Enforce active row from canonical spin-event winner
	await supabase.from("lobby_punishments").update({ active: false, week_status: null }).eq("lobby_id", lobbyId).eq("week", week);
	await supabase.from("lobby_punishments").update({ active: true, week_status: "PENDING_CONFIRMATION" }).eq("id", chosen.id);
	
	if (createdSpinEvent) {
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
				payload: {
					week,
					text: chosen.text,
					spinId: spinEvent.id,
					startedAt: spinEvent.started_at,
					winnerItemId: spinEvent.winner_item_id
				}
			});
		} catch (e) {
			logError({ route: "POST /api/lobby/[id]/spin", code: "HISTORY_LOG_FAILED", err: e, lobbyId });
		}
		try { await onSpin(lobbyId, chosen.text as string); } catch (e) {
			logError({ route: "POST /api/lobby/[id]/spin", code: "QUIP_SPIN_FAILED", err: e, lobbyId });
		}
	}
	return NextResponse.json({
		ok: true,
		chosen,
		spinEvent: {
			spinId: spinEvent.id,
			startedAt: spinEvent.started_at,
			winnerItemId: spinEvent.winner_item_id,
			week
		}
	});
}
