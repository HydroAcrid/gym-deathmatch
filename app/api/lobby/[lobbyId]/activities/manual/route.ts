import { NextRequest, NextResponse } from "next/server";
import { onActivityLogged } from "@/lib/commentary";
import type { Activity } from "@/lib/types";
import { calculateStreakFromActivities } from "@/lib/streaks";
import { resolveLobbyAccess } from "@/lib/lobbyAccess";

type ActivityCommentRow = {
	primary_player_id: string | null;
	payload: { type?: string } | null;
};
type ActivityDateRow = { date: string };

export async function POST(req: NextRequest, { params }: { params: Promise<{ lobbyId: string }> }) {
	const { lobbyId } = await params;
	const access = await resolveLobbyAccess(req, lobbyId);
	if (!access.ok) return NextResponse.json({ error: access.message }, { status: access.status });
	if (!access.memberPlayerId) return NextResponse.json({ error: "Not a player in lobby" }, { status: 403 });
	const supabase = access.supabase;
	try {
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
		const type = (String(body.type || "other").toLowerCase() as Activity["type"]);
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

		// Commentary engine (activity, plus social/theme checks)
		try {
			const act: Activity = {
				id: data.id,
				playerId,
				lobbyId,
				date: dateIso,
				durationMinutes,
				distanceKm,
				type,
				source: "manual",
				notes: notes ?? undefined
			};
			await onActivityLogged(lobbyId, act);

			try {
				const { data: streakRows } = await supabase
					.from("manual_activities")
					.select("date")
					.eq("lobby_id", lobbyId)
					.eq("player_id", playerId)
					.in("status", ["approved", "pending"])
					.order("date", { ascending: false })
					.limit(500);
				const currentStreak = calculateStreakFromActivities(
					((streakRows ?? []) as ActivityDateRow[]).map((r) => ({ start_date_local: r.date })),
					undefined,
					undefined,
					{ timezoneOffsetMinutes: requestTimezoneOffsetMinutes }
				);
				const { onStreakMilestone, onStreakPR } = await import("@/lib/commentary");
				if ([3, 5, 7, 10].includes(currentStreak)) {
					await onStreakMilestone(lobbyId, playerId, currentStreak);
				}
				await onStreakPR(lobbyId, playerId, currentStreak);
			} catch {
				// best-effort streak commentary
			}

				// Social coincidence checks:
				const since20 = new Date(Date.now() - 20 * 60 * 1000).toISOString();
				const { data: recentActs } = await supabase
					.from("comments")
					.select("primary_player_id, payload")
					.eq("lobby_id", lobbyId)
					.eq("type", "ACTIVITY")
					.gte("created_at", since20)
					.order("created_at", { ascending: false })
					.limit(5);
				const other = ((recentActs ?? []) as ActivityCommentRow[]).find((r) => r.primary_player_id && r.primary_player_id !== playerId);

				const since60 = new Date(Date.now() - 60 * 60 * 1000).toISOString();
				const { data: lastHour } = await supabase
					.from("comments")
					.select("primary_player_id, payload")
					.eq("lobby_id", lobbyId)
					.eq("type", "ACTIVITY")
					.gte("created_at", since60);
				const distinctPlayersSameType = new Set(
					((lastHour ?? []) as ActivityCommentRow[])
						.filter((r) => (r.payload?.type || "").toLowerCase() === type.toLowerCase())
						.map((r) => r.primary_player_id)
				);

				if (other || distinctPlayersSameType.size >= 2) {
					const commentary = await import("@/lib/commentary");
					if (other) {
						await commentary.onSocialBurst(lobbyId, String(other.primary_player_id), playerId);
						await commentary.onRivalryPulse(lobbyId, String(other.primary_player_id), playerId);
					}
					if (distinctPlayersSameType.size >= 2) {
						await commentary.onThemeHour(lobbyId, type);
					}
				}
			} catch { /* ignore */ }

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
