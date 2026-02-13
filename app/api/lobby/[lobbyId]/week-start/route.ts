import { NextRequest, NextResponse } from "next/server";
import { jsonError, logError } from "@/lib/logger";
import { resolveLobbyAccess } from "@/lib/lobbyAccess";
import { refreshLobbyLiveSnapshot } from "@/lib/liveSnapshotStore";

export async function POST(req: NextRequest, { params }: { params: Promise<{ lobbyId: string }> }) {
	const { lobbyId } = await params;
	const access = await resolveLobbyAccess(req, lobbyId);
	if (!access.ok) return jsonError(access.code, access.message, access.status);
	if (!access.isOwner) return jsonError("FORBIDDEN", "Owner only", 403);
	const supabase = access.supabase;
	
	try {
		const body = await req.json();
		const { week } = body || {};
		if (week === undefined) return jsonError("MISSING_WEEK", "Missing week");
		
		// Get the active punishment for this week
		const { data: activePunishment } = await supabase
			.from("lobby_punishments")
			.select("id, text, week_status")
			.eq("lobby_id", lobbyId)
			.eq("week", week)
			.eq("active", true)
			.maybeSingle();
		
		if (!activePunishment) {
			return jsonError("NO_ACTIVE_PUNISHMENT", "No active punishment found for this week", 404);
		}
		
		// If already active, treat as idempotent success.
		if ((activePunishment as any).week_status === "ACTIVE") {
			await supabase.from("lobby").update({ status: "active", stage: "ACTIVE" }).eq("id", lobbyId);
			void refreshLobbyLiveSnapshot(lobbyId);
			return NextResponse.json({ ok: true, alreadyStarted: true });
		}

		// Update week_status to ACTIVE
		const { error: updateError } = await supabase
			.from("lobby_punishments")
			.update({ week_status: "ACTIVE" })
			.eq("id", activePunishment.id);
		
		if (updateError) throw updateError;
		
		// Get lobby info for logging
		const { data: lobby } = await supabase
			.from("lobby")
			.select("season_start, mode, owner_id")
			.eq("id", lobbyId)
			.maybeSingle();
		if (!lobby) {
			return jsonError("NOT_FOUND", "Lobby not found", 404);
		}
		
		// If season_start is missing, initialize it when a week is activated.
		if (!lobby.season_start) {
			await supabase
				.from("lobby")
				.update({ season_start: new Date().toISOString(), status: "active", stage: "ACTIVE" })
				.eq("id", lobbyId);
		} else if (String(lobby.mode || "").startsWith("CHALLENGE_ROULETTE")) {
			// For challenge roulette, ensure status is active
			await supabase
				.from("lobby")
				.update({ status: "active", stage: "ACTIVE" })
				.eq("id", lobbyId);
		}
		
		// Get host name for event
		let hostName = "Host";
		if (lobby?.owner_id) {
			const { data: hostPlayer } = await supabase
				.from("player")
				.select("name")
				.eq("id", lobby.owner_id)
				.maybeSingle();
			if (hostPlayer?.name) hostName = hostPlayer.name;
		}
		
		// Log week start event
		try {
			await supabase.from("history_events").insert({
				lobby_id: lobbyId,
				type: "WEEK_STARTED",
				payload: { week, punishment: activePunishment.text, hostName },
			});
		} catch (e) {
			logError({ route: "POST /api/lobby/[id]/week-start", code: "HISTORY_LOG_FAILED", err: e, lobbyId });
		}
		
		// Add feed entry
		try {
			const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
			const { data: exists } = await supabase
				.from("comments")
				.select("id")
				.eq("lobby_id", lobbyId)
				.eq("rendered", `Week ${week} armed by ${hostName} – fight!`)
				.gte("created_at", since)
				.limit(1);
			
			if (!exists || !exists.length) {
				await supabase.from("comments").insert({
					lobby_id: lobbyId,
					type: "SUMMARY",
					rendered: `Week ${week} armed by ${hostName} – fight!`,
					payload: { type: "WEEK_START", week },
					visibility: "feed",
				});
			}
		} catch (e) {
			logError({ route: "POST /api/lobby/[id]/week-start", code: "FEED_LOG_FAILED", err: e, lobbyId });
		}
		
		void refreshLobbyLiveSnapshot(lobbyId);
		return NextResponse.json({ ok: true });
	} catch (e) {
		logError({ route: "POST /api/lobby/[id]/week-start", code: "WEEK_START_FAILED", err: e, lobbyId });
		return jsonError("WEEK_START_FAILED", "Failed to start week", 400);
	}
}
