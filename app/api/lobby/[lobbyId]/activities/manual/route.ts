import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabaseClient";

export async function POST(req: NextRequest, { params }: { params: Promise<{ lobbyId: string }> }) {
	const { lobbyId } = await params;
	const supabase = getServerSupabase();
	if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 501 });
	try {
		const body = await req.json();
		const playerId = String(body.playerId || "");
		if (!playerId) return NextResponse.json({ error: "Missing playerId" }, { status: 400 });
		const dateIso = body.date ? new Date(body.date).toISOString() : new Date().toISOString();
		const type = String(body.type || "other").toLowerCase();
		const durationMinutes = body.durationMinutes != null ? Number(body.durationMinutes) : null;
		const distanceKm = body.distanceKm != null ? Number(body.distanceKm) : null;
		const notes = body.notes ? String(body.notes).slice(0, 200) : null;
		const photoUrl = String(body.photoUrl || "");
		const caption = String(body.caption || "").slice(0, 200);
		if (!photoUrl || !caption) {
			return NextResponse.json({ error: "Photo and caption are required" }, { status: 400 });
		}

		// Validate player belongs to lobby
		const { data: prow } = await supabase.from("player").select("id").eq("id", playerId).eq("lobby_id", lobbyId).maybeSingle();
		if (!prow) return NextResponse.json({ error: "Player not in lobby" }, { status: 400 });

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
		console.error("manual activity POST error", e);
		return NextResponse.json({ error: "Bad request" }, { status: 400 });
	}
}


