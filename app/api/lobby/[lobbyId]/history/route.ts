import { NextRequest, NextResponse } from "next/server";
import { resolveLobbyAccess } from "@/lib/lobbyAccess";
import { loadLobbyTimelineData } from "@/lib/lobbyTimeline";

export async function GET(req: NextRequest, { params }: { params: Promise<{ lobbyId: string }> }) {
	const { lobbyId } = await params;
	const access = await resolveLobbyAccess(req, lobbyId);
	if (!access.ok) return NextResponse.json({ error: access.message }, { status: access.status });
	if (!access.memberPlayerId && !access.isOwner) return NextResponse.json({ error: "Not a member of lobby" }, { status: 403 });
	const supabase = access.supabase;
	const member = { id: access.memberPlayerId || access.ownerPlayerId };

	try {
		const limitParam = Number(new URL(req.url).searchParams.get("limit") || "50");
		const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 100) : 50;
		const data = await loadLobbyTimelineData({
			supabase,
			lobbyId,
			limit,
			memberPlayerId: member.id ?? null,
			commentVisibility: ["history", "both"],
		});

		return NextResponse.json(
			{
				activities: data.activities,
				events: data.events,
				comments: data.comments,
				players: data.players,
				lobby: data.lobby,
				ownerPlayerId: data.ownerPlayerId,
				ownerUserId: data.ownerUserId,
				lobbyName: data.lobbyName,
				votes: data.votes,
				myPlayerId: data.myPlayerId,
				timeline: data.timeline,
			},
			{ status: 200 }
		);
	} catch (e) {
		console.error("history GET error", e);
		return NextResponse.json({ error: "Bad request" }, { status: 400 });
	}
}
