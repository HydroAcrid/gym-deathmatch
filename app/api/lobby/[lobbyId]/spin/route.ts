import { NextRequest, NextResponse } from "next/server";
import { jsonError, logError } from "@/lib/logger";
import { resolveLobbyAccess } from "@/lib/lobbyAccess";
import { resolvePunishmentWeek } from "@/lib/challengeWeek";
import { refreshLobbyLiveSnapshot } from "@/lib/liveSnapshotStore";
import {
	ensureCommentaryQueueReady,
	isCommentaryQueueUnavailableError,
} from "@/lib/commentaryEvents";
import { emitSpinResolvedEvent } from "@/lib/commentaryProducers";
import { processCommentaryQueue } from "@/lib/commentaryProcessor";

export async function POST(req: NextRequest, { params }: { params: Promise<{ lobbyId: string }> }) {
	const { lobbyId } = await params;
	const access = await resolveLobbyAccess(req, lobbyId);
	if (!access.ok) return jsonError(access.code, access.message, access.status);
	if (!access.isOwner) return jsonError("FORBIDDEN", "Owner only", 403);
	const supabase = access.supabase;
	try {
		await ensureCommentaryQueueReady();
	} catch (e) {
		if (isCommentaryQueueUnavailableError(e)) {
			return jsonError("COMMENTARY_QUEUE_UNAVAILABLE", "Run latest SQL schema before spinning.", 503);
		}
		return jsonError("COMMENTARY_QUEUE_INIT_FAILED", "Failed to initialize commentary queue", 500);
	}

	const { data: lobby } = await supabase
		.from("lobby")
		.select("season_start,status,mode,challenge_settings")
		.eq("id", lobbyId)
		.maybeSingle();
	if (!lobby) return jsonError("NOT_FOUND", "Lobby not found", 404);
	if (String((lobby as any).mode || "") !== "CHALLENGE_ROULETTE") {
		return jsonError("INVALID_MODE", "Spin is only available in challenge roulette mode", 409);
	}
	const actorPlayerId = access.memberPlayerId || access.ownerPlayerId;
	if (!actorPlayerId) return jsonError("OWNER_PLAYER_MISSING", "Owner player record missing", 409);
	if (String((lobby as any).status || "") !== "transition_spin") {
		return jsonError("INVALID_PHASE", "Spin is only allowed during transition spin phase", 409);
	}
	const week = await resolvePunishmentWeek(supabase, lobbyId, {
		mode: (lobby as any).mode,
		status: (lobby as any).status,
		seasonStart: (lobby as any).season_start
	});
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
		const challengeSettings = (lobby as any).challenge_settings || {};
		const requireLock = Boolean(challengeSettings.requireLockBeforeSpin ?? true);
		if (requireLock && (items || []).some((x: any) => !x.locked)) {
			return jsonError("LOCK_REQUIRED", "Lock the punishment list before spinning", 409);
		}
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
					created_by: actorPlayerId
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
	await supabase.from("lobby_punishments").update({ active: true, week_status: "ACTIVE" }).eq("id", chosen.id);
	const lobbyPatch: Record<string, unknown> = { status: "active", stage: "ACTIVE" };
	if (week === 1 && !(lobby as any).season_start) {
		lobbyPatch.season_start = new Date().toISOString();
	}
	await supabase.from("lobby").update(lobbyPatch).eq("id", lobbyId);
	
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
			await supabase.from("history_events").insert({
				lobby_id: lobbyId,
				type: "WEEK_STARTED",
				payload: {
					week,
					punishment: chosen.text,
					viaSpin: true
				}
			});
			} catch (e) {
				logError({ route: "POST /api/lobby/[id]/spin", code: "HISTORY_LOG_FAILED", err: e, lobbyId });
			}
			try {
				await emitSpinResolvedEvent({
					lobbyId,
					week,
					spinId: String(spinEvent.id),
					winnerItemId: String(spinEvent.winner_item_id),
					text: String(chosen.text || ""),
					startedAt: String(spinEvent.started_at),
					auto: false,
				});
			} catch (e) {
				logError({ route: "POST /api/lobby/[id]/spin", code: "SPIN_EVENT_ENQUEUE_FAILED", err: e, lobbyId });
			}
		}
	void processCommentaryQueue({ lobbyId, limit: 80, maxMs: 800 }).catch((err) => {
		logError({ route: "POST /api/lobby/[id]/spin", code: "SPIN_PROCESS_TAIL_FAILED", err, lobbyId });
	});
	void refreshLobbyLiveSnapshot(lobbyId);
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
