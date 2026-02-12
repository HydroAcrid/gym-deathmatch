import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabaseClient";
import { jsonError, logError } from "@/lib/logger";
import { getRequestUserId } from "@/lib/requestAuth";
import { refreshLobbyLiveSnapshot } from "@/lib/liveSnapshotStore";
import {
	enqueueCommentaryEvent,
	ensureCommentaryQueueReady,
	isCommentaryQueueUnavailableError,
} from "@/lib/commentaryEvents";
import { processCommentaryQueue } from "@/lib/commentaryProcessor";

export async function POST(req: NextRequest, { params }: { params: Promise<{ lobbyId: string }> }) {
	const { lobbyId } = await params;
	const supabase = getServerSupabase();
	if (!supabase) return jsonError("SUPABASE_NOT_CONFIGURED", "Supabase not configured", 501);
	try {
		await ensureCommentaryQueueReady();
		const userId = await getRequestUserId(req);
		if (!userId) return jsonError("UNAUTHORIZED", "Unauthorized", 401);
		const body = await req.json();
		const { ready } = body || {};
		const { data: member } = await supabase.from("player").select("id").eq("lobby_id", lobbyId).eq("user_id", userId).maybeSingle();
		if (!member?.id) return jsonError("FORBIDDEN", "Not a lobby member", 403);
		const { error } = await supabase.from("user_ready_states").upsert({ user_id: userId, lobby_id: lobbyId, ready: !!ready }, { onConflict: "user_id,lobby_id" });
		if (error) throw error;
		try {
			const { data: p } = await supabase.from("player").select("id").eq("lobby_id", lobbyId).eq("user_id", userId).maybeSingle();
			if (p?.id) {
				await enqueueCommentaryEvent({
					lobbyId,
					type: "READY_CHANGED",
					key: `ready:${String(p.id)}:${ready ? "1" : "0"}`,
					payload: {
						playerId: String(p.id),
						ready: !!ready,
					},
				});
			}
			if (ready) {
				const { data: states } = await supabase.from("user_ready_states").select("user_id,ready").eq("lobby_id", lobbyId);
				const readyRows = (states ?? []) as Array<{ user_id: string | null; ready: boolean | null }>;
				if (readyRows.length > 0 && readyRows.every((s) => !!s.ready)) {
					const readyPlayerIds: string[] = [];
					for (const state of (states ?? []) as Array<{ user_id: string | null; ready: boolean | null }>) {
						if (!state.user_id || !state.ready) continue;
						const { data: readyPlayer } = await supabase
							.from("player")
							.select("id")
							.eq("lobby_id", lobbyId)
							.eq("user_id", state.user_id)
							.maybeSingle();
						if (readyPlayer?.id) readyPlayerIds.push(String(readyPlayer.id));
					}
					await enqueueCommentaryEvent({
						lobbyId,
						type: "ALL_READY",
						key: `all-ready:${readyPlayerIds.slice().sort().join(",") || "none"}`,
						payload: { readyPlayerIds },
					});
				}
			}
		} catch (e) {
			logError({ route: "POST /api/lobby/[id]/ready", code: "QUIP_READY_FAILED", err: e, lobbyId, actorUserId: userId });
		}
		void processCommentaryQueue({ lobbyId, limit: 40, maxMs: 300 }).catch((err) => {
			logError({ route: "POST /api/lobby/[id]/ready", code: "READY_PROCESS_TAIL_FAILED", err, lobbyId, actorUserId: userId });
		});
		void refreshLobbyLiveSnapshot(lobbyId);
		return NextResponse.json({ ok: true });
	} catch (e) {
		if (isCommentaryQueueUnavailableError(e)) {
			return jsonError("COMMENTARY_QUEUE_UNAVAILABLE", "Run latest SQL schema before setting ready state.", 503);
		}
		logError({ route: "POST /api/lobby/[id]/ready", code: "READY_SAVE_FAILED", err: e, lobbyId });
		return jsonError("READY_SAVE_FAILED", "Failed to set ready", 400);
	}
}
