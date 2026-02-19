import { NextRequest, NextResponse } from "next/server";
import { resolveLobbyAccess } from "@/lib/lobbyAccess";
import { refreshLobbyLiveSnapshot } from "@/lib/liveSnapshotStore";
import {
	ensureCommentaryQueueReady,
	isCommentaryQueueUnavailableError,
} from "@/lib/commentaryEvents";
import { emitActivityLoggedEvent } from "@/lib/commentaryProducers";
import { processCommentaryQueue } from "@/lib/commentaryProcessor";

export async function POST(req: NextRequest, { params }: { params: Promise<{ lobbyId: string }> }) {
	const { lobbyId } = await params;
	const access = await resolveLobbyAccess(req, lobbyId);
	if (!access.ok) return NextResponse.json({ error: access.message }, { status: access.status });
	if (!access.memberPlayerId) return NextResponse.json({ error: "Not a player in lobby" }, { status: 403 });
	const supabase = access.supabase;
	try {
		await ensureCommentaryQueueReady();
		const requestTimezoneOffsetMinutes = (() => {
			const raw = req.headers.get("x-timezone-offset-minutes");
			if (!raw) return undefined;
			const parsed = Number(raw);
			if (!Number.isFinite(parsed)) return undefined;
			const rounded = Math.round(parsed);
			if (rounded < -840 || rounded > 840) return undefined;
			return rounded;
		})();
		const body = await req.json();
		const playerId = access.memberPlayerId;
		// Always use current time when submitting - prevents date manipulation and timezone issues
		const dateIso = new Date().toISOString();
		const type = String(body.type || "other").toLowerCase();
		const durationMinutes = body.durationMinutes != null ? Number(body.durationMinutes) : null;
		const distanceKm = body.distanceKm != null ? Number(body.distanceKm) : null;
		const notes = body.notes ? String(body.notes).slice(0, 200) : null;
		const photoUrl = String(body.photoUrl || "");
		const caption = String(body.caption || "").slice(0, 200);
		if (!photoUrl || !caption) {
			return NextResponse.json({ error: "Photo and caption are required" }, { status: 400 });
		}

		const { data, error } = await supabase.from("manual_activities").insert({
			lobby_id: lobbyId,
			player_id: playerId,
			date: dateIso,
			type,
			duration_minutes: durationMinutes,
			distance_km: distanceKm,
			notes,
			photo_url: photoUrl,
			caption,
			status: "approved",
			vote_deadline: null
		}).select("*").single();
		if (error) throw error;

		// Log history event
		await supabase.from("history_events").insert({
			lobby_id: lobbyId,
			actor_player_id: playerId,
			target_player_id: playerId,
			type: "ACTIVITY_LOGGED",
			payload: { activityId: data.id, type, durationMinutes, distanceKm, caption, photoUrl }
		});

		await emitActivityLoggedEvent({
			lobbyId,
			activity: {
				id: String(data.id),
				playerId,
				lobbyId,
				date: String(data.date || dateIso),
				durationMinutes,
				distanceKm,
				type: type as "run" | "ride" | "gym" | "walk" | "other",
				source: "manual",
				notes,
			},
		});
		// Process commentary synchronously so workout push notifications fire immediately.
		// Keep failures non-blocking for the workout post itself.
		try {
			await processCommentaryQueue({ lobbyId, limit: 50, maxMs: 2000, newestFirst: true });
		} catch (err) {
			console.error("manual activity commentary process failed", err);
		}

		void refreshLobbyLiveSnapshot(lobbyId, requestTimezoneOffsetMinutes);
		return NextResponse.json({
			id: data.id,
			lobbyId: data.lobby_id,
			playerId: data.player_id,
			date: new Date(data.date).toISOString(),
			type: data.type,
			durationMinutes: data.duration_minutes,
			distanceKm: data.distance_km,
			source: "manual",
			notes: data.notes ?? null,
			photoUrl: data.photo_url,
			caption: data.caption,
			status: data.status,
			voteDeadline: data.vote_deadline,
			decidedAt: data.decided_at
		}, { status: 201 });
	} catch (e) {
		if (isCommentaryQueueUnavailableError(e)) {
			return NextResponse.json(
				{ error: "COMMENTARY_QUEUE_UNAVAILABLE", message: "Run latest SQL schema before posting activities." },
				{ status: 503 }
			);
		}
		console.error("manual activity POST error", e);
		return NextResponse.json({ error: "Bad request" }, { status: 400 });
	}
}
