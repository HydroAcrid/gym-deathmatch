import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabaseClient";
import { onVoteResolved } from "@/lib/commentary";

async function resolveActivityVotes(supabase: any, activityId: string) {
	// load activity and votes
	const { data: act } = await supabase.from("manual_activities").select("id,lobby_id,player_id,status,vote_deadline").eq("id", activityId).maybeSingle();
	if (!act) return;
	const now = new Date();
	const { data: votes } = await supabase.from("activity_votes").select("*").eq("activity_id", activityId);
	const { data: players } = await supabase.from("player").select("id").eq("lobby_id", act.lobby_id);
	const totalVoters = Math.max(0, (players?.length || 0) - 1); // minus the owner
	const legit = (votes || []).filter((v: any) => v.choice === "legit").length;
	const sus = (votes || []).filter((v: any) => v.choice === "sus").length;
	if (act.status === "approved" || act.status === "rejected") return;
	// timeout rule
	if (act.vote_deadline && new Date(act.vote_deadline).getTime() <= now.getTime()) {
		await supabase.from("manual_activities").update({ status: "approved", decided_at: now.toISOString() }).eq("id", activityId);
		await supabase.from("history_events").insert({
			lobby_id: act.lobby_id, type: "VOTE_RESULT",
			payload: { activityId, result: "approved_timeout", legit, sus, totalVoters }
		});
		return;
	}
	// early reject rules
	if (totalVoters >= 2) {
		const ratio = totalVoters ? sus / totalVoters : 0;
		if (ratio >= 0.75) {
			await supabase.from("manual_activities").update({ status: "rejected", decided_at: now.toISOString() }).eq("id", activityId);
			await supabase.from("history_events").insert({
				lobby_id: act.lobby_id, type: "VOTE_RESULT",
				payload: { activityId, result: "rejected_threshold", legit, sus, totalVoters }
			});
			return;
		}
	}
	// very small lobby: unanimous sus among other players
	if (totalVoters > 0 && sus === totalVoters) {
		await supabase.from("manual_activities").update({ status: "rejected", decided_at: now.toISOString() }).eq("id", activityId);
		await supabase.from("history_events").insert({
			lobby_id: act.lobby_id, type: "VOTE_RESULT",
			payload: { activityId, result: "rejected_unanimous_small", legit, sus, totalVoters }
		});
	}
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ activityId: string }> }) {
	const { activityId } = await params;
	const supabase = getServerSupabase();
	if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 501 });
	try {
		const body = await req.json();
		const voterPlayerId = String(body.voterPlayerId || "");
		const choice = String(body.choice || "");
		if (!["legit", "sus"].includes(choice)) return NextResponse.json({ error: "Invalid choice" }, { status: 400 });
		// Activity
		const { data: actRow } = await supabase.from("manual_activities").select("*").eq("id", activityId).maybeSingle();
		if (!actRow) return NextResponse.json({ error: "Not found" }, { status: 404 });
		// Voter is member of lobby
		const { data: voter } = await supabase.from("player").select("*").eq("id", voterPlayerId).maybeSingle();
		if (!voter || voter.lobby_id !== actRow.lobby_id) return NextResponse.json({ error: "Not in lobby" }, { status: 400 });
		// Prevent self-vote
		if (voterPlayerId === actRow.player_id) return NextResponse.json({ error: "No self-vote" }, { status: 400 });
		// Disable voting in very small lobbies (<= 2 players)
		const { data: plist } = await supabase.from("player").select("id").eq("lobby_id", actRow.lobby_id);
		if ((plist?.length || 0) <= 2) {
			return NextResponse.json({ error: "Voting disabled for lobbies with fewer than 3 players" }, { status: 400 });
		}
		// If currently approved, first vote starts a challenge window by flipping to pending
		if (actRow.status === "approved") {
			const now = new Date();
			const deadline = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
			await supabase.from("manual_activities").update({ status: "pending", vote_deadline: deadline }).eq("id", activityId);
			await supabase.from("history_events").insert({
				lobby_id: actRow.lobby_id, actor_player_id: voterPlayerId, target_player_id: actRow.player_id, type: "VOTE_STARTED",
				payload: { activityId }
			});
		} else {
			// Prevent if decided or deadline passed
			if (actRow.status === "rejected") return NextResponse.json({ error: "Voting closed" }, { status: 400 });
			if (actRow.vote_deadline && new Date(actRow.vote_deadline).getTime() < Date.now()) return NextResponse.json({ error: "Voting closed" }, { status: 400 });
		}
		// Upsert vote
		const { error } = await supabase.from("activity_votes").upsert({
			activity_id: activityId, voter_player_id: voterPlayerId, choice
		});
		if (error) throw error;
		// Try resolve
		await resolveActivityVotes(supabase, activityId);
		try {
			// Commentary quip (fire-and-forget)
			const activity = { id: activityId, playerId: actRow.player_id, lobbyId: actRow.lobby_id } as any;
			await onVoteResolved(actRow.lobby_id as any, activity as any, choice === "legit" ? "approved" : "rejected");
		} catch { /* ignore */ }
		return NextResponse.json({ ok: true });
	} catch (e) {
		console.error("vote error", e);
		const errorMessage = e instanceof Error ? e.message : "Bad request";
		return NextResponse.json({ error: errorMessage }, { status: 400 });
	}
}


