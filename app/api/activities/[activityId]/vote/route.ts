import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabaseClient";
import { onVoteResolved } from "@/lib/commentary";

async function resolveActivityVotes(supabase: any, activityId: string) {
	// load activity and votes
	const { data: act } = await supabase.from("manual_activities").select("id,lobby_id,player_id,status,vote_deadline,decided_at").eq("id", activityId).maybeSingle();
	if (!act) return;
	const now = new Date();
	const { data: votes } = await supabase.from("activity_votes").select("*").eq("activity_id", activityId);
	const { data: players } = await supabase.from("player").select("id").eq("lobby_id", act.lobby_id);
	
	// Calculate eligible voters: all players except the activity author
	const totalEligibleVoters = Math.max(0, (players?.length || 0) - 1);
	const legit = (votes || []).filter((v: any) => v.choice === "legit").length;
	const sus = (votes || []).filter((v: any) => v.choice === "sus").length;
	const totalVotes = legit + sus;
	
	// If already decided (has decided_at timestamp), don't change it (unless owner override)
	if (act.decided_at && act.status !== "pending") {
		return;
	}
	
	// If no votes remain and status is pending, revert to approved
	if (totalVotes === 0 && act.status === "pending") {
		await supabase.from("manual_activities").update({ 
			status: "approved", 
			vote_deadline: null,
			decided_at: null
		}).eq("id", activityId);
		return;
	}
	
	// If status is approved but has votes, it should be pending (this handles edge cases)
	if (act.status === "approved" && totalVotes > 0 && !act.decided_at) {
		const deadline = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
		await supabase.from("manual_activities").update({ status: "pending", vote_deadline: deadline }).eq("id", activityId);
		// Continue to check majority rules below (don't return)
	}
	
	// If status is approved and no votes, keep it approved (nothing to do)
	if (act.status === "approved" && totalVotes === 0) {
		return;
	}
	
	// Timeout rule: if deadline passed, approve by default
	if (act.vote_deadline && new Date(act.vote_deadline).getTime() <= now.getTime()) {
		await supabase.from("manual_activities").update({ 
			status: "approved", 
			decided_at: now.toISOString() 
		}).eq("id", activityId);
		await supabase.from("history_events").insert({
			lobby_id: act.lobby_id, type: "VOTE_RESULT",
			payload: { activityId, result: "approved_timeout", legit, sus, totalEligibleVoters }
		});
		return;
	}
	
	// Majority rule: more than 50% of eligible voters have voted
	const hasMajority = totalVotes > (totalEligibleVoters / 2);
	
	if (hasMajority) {
		// Determine winner: whichever side has more votes (ties default to legit)
		const winner = legit > sus ? "approved" : legit < sus ? "rejected" : "approved";
		
		await supabase.from("manual_activities").update({ 
			status: winner, 
			decided_at: now.toISOString() 
		}).eq("id", activityId);
		
		await supabase.from("history_events").insert({
			lobby_id: act.lobby_id, type: "VOTE_RESULT",
			payload: { 
				activityId, 
				result: winner === "approved" ? "approved_majority" : "rejected_majority", 
				legit, 
				sus, 
				totalEligibleVoters,
				totalVotes
			}
		});
		return;
	}
	
	// Early reject: if 75%+ of eligible voters vote sus (only if we have at least 2 eligible voters)
	if (totalEligibleVoters >= 2 && totalVotes > 0) {
		const susRatio = sus / totalEligibleVoters;
		if (susRatio >= 0.75) {
			await supabase.from("manual_activities").update({ 
				status: "rejected", 
				decided_at: now.toISOString() 
			}).eq("id", activityId);
			await supabase.from("history_events").insert({
				lobby_id: act.lobby_id, type: "VOTE_RESULT",
				payload: { activityId, result: "rejected_threshold", legit, sus, totalEligibleVoters }
			});
			return;
		}
	}
	
	// Small lobby: unanimous sus among all eligible voters
	if (totalEligibleVoters > 0 && sus === totalEligibleVoters && sus > 0) {
		await supabase.from("manual_activities").update({ 
			status: "rejected", 
			decided_at: now.toISOString() 
		}).eq("id", activityId);
		await supabase.from("history_events").insert({
			lobby_id: act.lobby_id, type: "VOTE_RESULT",
			payload: { activityId, result: "rejected_unanimous", legit, sus, totalEligibleVoters }
		});
		return;
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
		// Upsert vote (update choice if player already voted, insert if new)
		const { error } = await supabase.from("activity_votes").upsert({
			activity_id: activityId, voter_player_id: voterPlayerId, choice
		}, {
			onConflict: "activity_id,voter_player_id"
		});
		if (error) {
			console.error("Vote upsert error:", error);
			throw error;
		}
		// Always resolve votes after any vote change
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


