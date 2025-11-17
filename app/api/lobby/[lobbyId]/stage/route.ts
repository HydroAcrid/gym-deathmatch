import { NextResponse } from "next/server";
import { updateLobbyStage } from "@/lib/persistence";
import { jsonError, logError } from "@/lib/logger";
import { getServerSupabase } from "@/lib/supabaseClient";
import { onReadyChanged } from "@/lib/commentary";

export async function PATCH(req: Request, { params }: { params: Promise<{ lobbyId: string }> }) {
	try {
		const { lobbyId } = await params;
		const decoded = decodeURIComponent(lobbyId);
		const body = await req.json();
		const payload: any = {};
		if (body.status) payload.status = body.status;
		if (body.scheduledStart !== undefined) {
			payload.scheduledStart = body.scheduledStart;
			// Keep Season start in sync with the scheduled time for consistent UI display
			if (!body.startNow) payload.seasonStart = body.scheduledStart;
		}
		if (body.startNow === true) {
			// Determine mode to decide if we go into transition (roulette) or active directly
			try {
				const supabase = getServerSupabase();
				if (supabase) {
					const { data: lrow } = await supabase.from("lobby").select("mode,status").eq("id", decoded).maybeSingle();
					const mode = (lrow?.mode as string) || "MONEY_SURVIVAL";
					if (String(mode).startsWith("CHALLENGE_ROULETTE")) {
						// If we're already in transition, starting now advances to ACTIVE
						if (lrow?.status === "transition_spin") {
							payload.status = "active";
							payload.seasonStart = new Date().toISOString();
							payload.scheduledStart = null;
							// Announce start (same dedupe as money mode)
							try {
								const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
								const { data: exists } = await supabase
									.from("comments")
									.select("id")
									.eq("lobby_id", decoded)
									.eq("rendered", "The arena opens. Fight!")
									.gte("created_at", since)
									.limit(1);
								if (!exists || !exists.length) {
									await supabase.from("comments").insert({
										lobby_id: decoded,
										type: "SUMMARY",
										rendered: "The arena opens. Fight!",
										payload: { type: "START" },
										visibility: "feed"
									});
								}
							} catch (e) {
								logError({ route: "PATCH /api/lobby/[id]/stage", code: "START_ANNOUNCE_FAILED", err: e, lobbyId: decoded });
							}
						} else {
							// Enter transition spin; do not set seasonStart yet
							payload.status = "transition_spin";
							payload.scheduledStart = null;
							// Set stage to ACTIVE since we're starting the season
							payload.stage = "ACTIVE";
						}
					} else {
						payload.status = "active";
						payload.seasonStart = new Date().toISOString();
						payload.scheduledStart = null;
						// Quip: match started
						try {
							// dedupe start comment in last hour
							const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
							const { data: exists } = await supabase
								.from("comments")
								.select("id")
								.eq("lobby_id", decoded)
								.eq("rendered", "The arena opens. Fight!")
								.gte("created_at", since)
								.limit(1);
							if (!exists || !exists.length) {
								await supabase.from("comments").insert({
									lobby_id: decoded,
									type: "SUMMARY",
									rendered: "The arena opens. Fight!",
									payload: { type: "START" },
									visibility: "feed"
								});
							}
						} catch (e) {
							logError({ route: "PATCH /api/lobby/[id]/stage", code: "START_ANNOUNCE_FAILED", err: e, lobbyId: decoded });
						}
					}
				}
			} catch (e) {
				logError({ route: "PATCH /api/lobby/[id]/stage", code: "MODE_FETCH_FAILED", err: e, lobbyId: decoded });
			}
		}
		const ok = await updateLobbyStage(decoded, payload);
		if (!ok) return jsonError("STAGE_UPDATE_FAILED", "Failed to update stage", 500);
		return NextResponse.json({ ok: true });
	} catch (e) {
		logError({ route: "PATCH /api/lobby/[id]/stage", code: "STAGE_BAD_REQUEST", err: e });
		return jsonError("STAGE_BAD_REQUEST", "Bad request", 400);
	}
}


