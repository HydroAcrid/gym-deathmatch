import { NextRequest, NextResponse } from "next/server";
import { jsonError, logError } from "@/lib/logger";
import { resolveLobbyAccess } from "@/lib/lobbyAccess";
import { refreshLobbyLiveSnapshot } from "@/lib/liveSnapshotStore";
import { archiveCurrentLobbySeason } from "@/lib/seasonArchive";

export async function POST(req: NextRequest, { params }: { params: Promise<{ lobbyId: string }> }) {
	const { lobbyId } = await params;
	const access = await resolveLobbyAccess(req, lobbyId);
	if (!access.ok) return jsonError(access.code, access.message, access.status);
	if (!access.isOwner) return jsonError("FORBIDDEN", "Owner only", 403);
	const supabase = access.supabase;

	try {
		const body = await req.json().catch(() => ({}));
		const { seasonStart, seasonEnd } = body || {};

		// Get current lobby state
		const { data: lobby } = await supabase
			.from("lobby")
			.select("season_number, initial_pot, initial_lives, season_start, season_end")
			.eq("id", lobbyId)
			.maybeSingle();

		if (!lobby) return jsonError("NOT_FOUND", "Lobby not found", 404);

		const newSeasonNumber = (lobby.season_number as number) + 1;
		let archiveWarning: string | null = null;

		// Archive current season snapshot before reset.
		// Best-effort: do not block rollover if archival table is missing in a lagging environment.
		try {
			const archived = await archiveCurrentLobbySeason(lobbyId);
			if (!archived.ok) {
				archiveWarning = archived.reason ?? "archive_failed";
				logError({
					route: "POST /api/lobby/[id]/season/next",
					code: "SEASON_ARCHIVE_WARNING",
					err: new Error(archiveWarning),
					lobbyId
				});
			}
		} catch (e) {
			archiveWarning = "archive_exception";
			logError({
				route: "POST /api/lobby/[id]/season/next",
				code: "SEASON_ARCHIVE_EXCEPTION",
				err: e,
				lobbyId
			});
		}
		
		// Calculate new dates if not provided
		let newSeasonStart: string;
		let newSeasonEnd: string;
		
		if (seasonStart && seasonEnd) {
			newSeasonStart = seasonStart;
			newSeasonEnd = seasonEnd;
		} else {
			// Default: start now, end same duration as previous season
			const oldStart = new Date(lobby.season_start || new Date().toISOString());
			const oldEnd = new Date(lobby.season_end);
			const duration = oldEnd.getTime() - oldStart.getTime();
			newSeasonStart = new Date().toISOString();
			newSeasonEnd = new Date(Date.now() + duration).toISOString();
		}

		// Update lobby: increment season, reset stage, reset pot
		const { error: updateError } = await supabase
			.from("lobby")
			.update({
				season_number: newSeasonNumber,
				stage: "PRE_STAGE",
				status: "pending",
				season_start: null, // Will be set when season actually starts
				season_end: newSeasonEnd,
				cash_pool: lobby.initial_pot || 0,
				season_summary: null // Clear previous summary
			})
			.eq("id", lobbyId);

		if (updateError) throw updateError;

		// Reset all player hearts to initial_lives
		const { error: heartsError } = await supabase
			.from("player")
			.update({
				sudden_death: false
			})
			.eq("lobby_id", lobbyId);

		if (heartsError) {
			logError({ route: "POST /api/lobby/[id]/season/next", code: "HEARTS_RESET_FAILED", err: heartsError, lobbyId });
			// Continue anyway - hearts are computed dynamically
		}

		// Clear weekly pot contributions for this lobby
		try {
			await supabase
				.from("weekly_pot_contributions")
				.delete()
				.eq("lobby_id", lobbyId);
		} catch (e) {
			logError({ route: "POST /api/lobby/[id]/season/next", code: "POT_CLEAR_FAILED", err: e, lobbyId });
			// Continue anyway
		}

		// Clear heart adjustments
		try {
			await supabase
				.from("heart_adjustments")
				.delete()
				.eq("lobby_id", lobbyId);
		} catch (e) {
			logError({ route: "POST /api/lobby/[id]/season/next", code: "HEART_ADJ_CLEAR_FAILED", err: e, lobbyId });
			// Continue anyway
		}

		// Clear challenge mode state (roulette punishments, ready states)
		try {
			await supabase
				.from("lobby_punishments")
				.delete()
				.eq("lobby_id", lobbyId);
		} catch (e) {
			logError({ route: "POST /api/lobby/[id]/season/next", code: "PUNISHMENTS_CLEAR_FAILED", err: e, lobbyId });
		}

		try {
			await supabase
				.from("week_ready_states")
				.delete()
				.eq("lobby_id", lobbyId);
		} catch (e) {
			logError({ route: "POST /api/lobby/[id]/season/next", code: "READY_STATES_CLEAR_FAILED", err: e, lobbyId });
		}

		// Clear user ready states
		try {
			await supabase
				.from("user_ready_states")
				.update({ ready: false })
				.eq("lobby_id", lobbyId);
		} catch (e) {
			logError({ route: "POST /api/lobby/[id]/season/next", code: "USER_READY_CLEAR_FAILED", err: e, lobbyId });
		}

		void refreshLobbyLiveSnapshot(lobbyId);
		return NextResponse.json({ 
			ok: true, 
			seasonNumber: newSeasonNumber,
			seasonStart: newSeasonStart,
			seasonEnd: newSeasonEnd,
			archiveWarning
		});
	} catch (e) {
		logError({ route: "POST /api/lobby/[id]/season/next", code: "NEXT_SEASON_FAILED", err: e, lobbyId });
		return jsonError("NEXT_SEASON_FAILED", "Failed to start next season", 500);
	}
}
