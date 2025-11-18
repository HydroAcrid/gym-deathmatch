import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabaseClient";

export async function GET(req: NextRequest, { params }: { params: Promise<{ lobbyId: string }> }) {
	const { lobbyId } = await params;
	const supabase = getServerSupabase();
	if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 501 });

	try {
		// Validate membership by user id header (client supplies from auth)
		const userId = req.headers.get("x-user-id") || "";
		if (!userId) return NextResponse.json({ error: "Missing user" }, { status: 401 });
		const { data: member } = await supabase.from("player").select("id").eq("lobby_id", lobbyId).eq("user_id", userId).maybeSingle();
		if (!member) return NextResponse.json({ error: "Not a member of lobby" }, { status: 403 });

		const limitParam = Number(new URL(req.url).searchParams.get("limit") || "50");
		const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 100) : 50;

		// Cleanup: Fix existing activities that are pending with 0 votes (should be approved)
		// This runs on every history page load to fix stuck activities
		try {
			const { data: pendingActivities } = await supabase
				.from("manual_activities")
				.select("id")
				.eq("lobby_id", lobbyId)
				.eq("status", "pending")
				.limit(100);
			
			if (pendingActivities && pendingActivities.length > 0) {
				const pendingIds = pendingActivities.map(a => a.id);
				const { data: allVotes } = await supabase
					.from("activity_votes")
					.select("activity_id")
					.in("activity_id", pendingIds);
				
				// Count votes per activity
				const voteCounts: Record<string, number> = {};
				for (const v of (allVotes || [])) {
					voteCounts[v.activity_id] = (voteCounts[v.activity_id] || 0) + 1;
				}
				
				// Find activities with 0 votes
				const zeroVoteIds = pendingIds.filter(id => !voteCounts[id] || voteCounts[id] === 0);
				
				// Revert them to approved
				if (zeroVoteIds.length > 0) {
					const { error: updateError } = await supabase
						.from("manual_activities")
						.update({ 
							status: "approved", 
							vote_deadline: null,
							decided_at: null
						})
						.in("id", zeroVoteIds);
					if (updateError) {
						console.error("History cleanup update error:", updateError);
					}
				}
			}
		} catch (e) {
			// Don't fail the request if cleanup fails
			console.error("History cleanup error:", e);
		}

		const [{ data: activities }, { data: events }, { data: comments }, { data: players }, { data: lobby }] = await Promise.all([
			supabase.from("manual_activities").select("*").eq("lobby_id", lobbyId).order("created_at", { ascending: false }).limit(limit),
			supabase.from("history_events").select("*").eq("lobby_id", lobbyId).order("created_at", { ascending: false }).limit(limit),
			supabase.from("comments").select("id,type,rendered,created_at,primary_player_id").eq("lobby_id", lobbyId).in("visibility", ["history", "both"] as any).order("created_at", { ascending: false }).limit(limit),
			supabase.from("player").select("id,name,avatar_url,user_id").eq("lobby_id", lobbyId),
			supabase.from("lobby").select("id,name,owner_id,owner_user_id").eq("id", lobbyId).maybeSingle()
		]);

		return NextResponse.json({
			activities: activities ?? [],
			events: events ?? [],
			comments: comments ?? [],
			players: players ?? [],
			lobby: lobby ?? null,
			ownerPlayerId: lobby?.owner_id ?? null,
			ownerUserId: lobby?.owner_user_id ?? null
		}, { status: 200 });
	} catch (e) {
		console.error("history GET error", e);
		return NextResponse.json({ error: "Bad request" }, { status: 400 });
	}
}


