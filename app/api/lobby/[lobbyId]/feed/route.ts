import { NextRequest, NextResponse } from "next/server";
import { resolveLobbyAccess } from "@/lib/lobbyAccess";
import { loadLobbyTimelineData } from "@/lib/lobbyTimeline";

type FeedItem = {
	id: string;
	type: "post" | "event" | "comment";
	text: string;
	createdAt: string;
	player: { name: string | null; avatar_url?: string | null } | null;
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ lobbyId: string }> }) {
	const { lobbyId } = await params;
	const access = await resolveLobbyAccess(req, lobbyId);
	if (!access.ok) return NextResponse.json({ error: access.message, items: [] }, { status: access.status });
	if (!access.memberPlayerId && !access.isOwner) return NextResponse.json({ error: "Not a lobby member", items: [] }, { status: 403 });

	const supabase = access.supabase;

	try {
		const limitParam = Number(new URL(req.url).searchParams.get("limit") || "50");
		const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 100) : 50;
		const timelineData = await loadLobbyTimelineData({
			supabase,
			lobbyId,
			limit,
			memberPlayerId: access.memberPlayerId || access.ownerPlayerId || null,
			commentVisibility: ["feed", "history", "both"],
		});
		const items: FeedItem[] = timelineData.timeline.map((item) => ({
			id: item.id,
			type: item.source === "activity" ? "post" : item.source === "event" ? "event" : "comment",
			text: item.text,
			createdAt: item.createdAt,
			player: item.player
				? {
						name: item.player.name,
						avatar_url: item.player.avatar_url ?? null,
				  }
				: null,
		}));

		return NextResponse.json({ items });
	} catch (e) {
		console.error("feed GET error", e);
		return NextResponse.json({ error: "Failed to load feed", items: [] }, { status: 500 });
	}
}
