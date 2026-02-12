import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabaseClient";
import { getRequestUserId } from "@/lib/requestAuth";
import {
	enqueueCommentaryEvent,
	ensureCommentaryQueueReady,
	isCommentaryQueueUnavailableError,
} from "@/lib/commentaryEvents";
import { processCommentaryQueue } from "@/lib/commentaryProcessor";

async function enqueueVoteResolvedEvent(input: {
	lobbyId: string;
	activityId: string;
	playerId: string;
	result: "approved" | "rejected";
	reason?: string | null;
	legit?: number;
	sus?: number;
}) {
	await enqueueCommentaryEvent({
		lobbyId: input.lobbyId,
		type: "VOTE_RESOLVED",
		key: `vote-result:${input.activityId}:${input.result}`,
		payload: {
			activityId: input.activityId,
			playerId: input.playerId,
			result: input.result,
			reason: input.reason ?? null,
			legit: input.legit ?? null,
			sus: input.sus ?? null,
		},
	});
}

async function resolveActivityVotes(supabase: any, activityId: string) {
	// load activity and votes
	const { data: act, error: actErr } = await supabase.from("manual_activities").select("id,lobby_id,player_id,status,vote_deadline,decided_at").eq("id", activityId).maybeSingle();
	if (actErr) {
		console.error("resolveActivityVotes: failed to load activity", actErr);
		return;
	}
	if (!act) return;
	const now = new Date();
	const { data: votes, error: votesErr } = await supabase.from("activity_votes").select("*").eq("activity_id", activityId);
	if (votesErr) {
		console.error("resolveActivityVotes: failed to load votes", votesErr);
		return;
	}
	const { data: players, error: playersErr } = await supabase.from("player").select("id").eq("lobby_id", act.lobby_id);
	if (playersErr) {
		console.error("resolveActivityVotes: failed to load players", playersErr);
		return;
	}
	
	// Calculate eligible voters: all players except the activity author
	const totalEligibleVoters = Math.max(0, (players?.length || 0) - 1);
	
	// Early return if no eligible voters
	if (totalEligibleVoters === 0) {
		return; // nothing meaningful to resolve
	}
	
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
		const { error: updateErr } = await supabase.from("manual_activities").update({ 
			status: "approved", 
			decided_at: now.toISOString() 
		}).eq("id", activityId);
		if (updateErr) {
			console.error("resolveActivityVotes: failed to update timeout", updateErr);
			return;
		}
		await supabase.from("history_events").insert({
			lobby_id: act.lobby_id, type: "VOTE_RESULT",
			payload: { activityId, result: "approved_timeout", legit, sus, totalEligibleVoters }
		});
		try {
			await enqueueVoteResolvedEvent({
				lobbyId: String(act.lobby_id),
				activityId: String(activityId),
				playerId: String(act.player_id),
				result: "approved",
				reason: "approved_timeout",
				legit,
				sus,
			});
		} catch { /* ignore */ }
		return;
	}
	
	// Early reject: if 75%+ of eligible voters vote sus (only if we have at least 2 eligible voters)
	// Check this BEFORE majority rule so it fires when applicable
	if (totalEligibleVoters >= 2 && totalVotes > 0) {
		const susRatio = sus / totalEligibleVoters;
		if (susRatio >= 0.75) {
			const { error: updateErr } = await supabase.from("manual_activities").update({ 
				status: "rejected", 
				decided_at: now.toISOString() 
			}).eq("id", activityId);
			if (updateErr) {
				console.error("resolveActivityVotes: failed to update 75% threshold", updateErr);
				return;
			}
			await supabase.from("history_events").insert({
				lobby_id: act.lobby_id, type: "VOTE_RESULT",
				payload: { activityId, result: "rejected_threshold", legit, sus, totalEligibleVoters }
			});
			try {
				await enqueueVoteResolvedEvent({
					lobbyId: String(act.lobby_id),
					activityId: String(activityId),
					playerId: String(act.player_id),
					result: "rejected",
					reason: "rejected_threshold",
					legit,
					sus,
				});
			} catch { /* ignore */ }
			return;
		}
	}
	
	// Small lobby: unanimous sus among all eligible voters
	// Check this BEFORE majority rule so it fires when applicable
	if (totalEligibleVoters > 0 && sus === totalEligibleVoters && sus > 0) {
		const { error: updateErr } = await supabase.from("manual_activities").update({ 
			status: "rejected", 
			decided_at: now.toISOString() 
		}).eq("id", activityId);
		if (updateErr) {
			console.error("resolveActivityVotes: failed to update unanimous", updateErr);
			return;
		}
		await supabase.from("history_events").insert({
			lobby_id: act.lobby_id, type: "VOTE_RESULT",
			payload: { activityId, result: "rejected_unanimous", legit, sus, totalEligibleVoters }
		});
		try {
			await enqueueVoteResolvedEvent({
				lobbyId: String(act.lobby_id),
				activityId: String(activityId),
				playerId: String(act.player_id),
				result: "rejected",
				reason: "rejected_unanimous",
				legit,
				sus,
			});
		} catch { /* ignore */ }
		return;
	}
	
	// Majority rule: more than 50% of eligible voters have voted
	// This runs AFTER the special cases above
	const hasMajority = totalVotes > (totalEligibleVoters / 2);
	
	if (hasMajority) {
		// Determine winner: whichever side has more votes (ties default to legit)
		const winner = legit > sus ? "approved" : legit < sus ? "rejected" : "approved";
		
		const { error: updateErr } = await supabase.from("manual_activities").update({ 
			status: winner, 
			decided_at: now.toISOString() 
		}).eq("id", activityId);
		if (updateErr) {
			console.error("resolveActivityVotes: failed to update majority", updateErr);
			return;
		}
		
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
		try {
			await enqueueVoteResolvedEvent({
				lobbyId: String(act.lobby_id),
				activityId: String(activityId),
				playerId: String(act.player_id),
				result: winner as "approved" | "rejected",
				reason: winner === "approved" ? "approved_majority" : "rejected_majority",
				legit,
				sus,
			});
		} catch { /* ignore */ }
		return;
	}
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ activityId: string }> }) {
	const { activityId } = await params;
	const supabase = getServerSupabase();
	if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 501 });
	try {
		await ensureCommentaryQueueReady();
		const userId = await getRequestUserId(req);
		if (!userId) return NextResponse.json({ error: "Missing user" }, { status: 401 });
		const body = await req.json();
		const choice = String(body.choice || "");
		// Allow "remove" to delete a vote and revert activity to approved if appropriate
		if (choice === "remove") {
			const { data: actRow } = await supabase.from("manual_activities").select("*").eq("id", activityId).maybeSingle();
			if (!actRow) return NextResponse.json({ error: "Not found" }, { status: 404 });
			
			// Check if voter is member of lobby
			const { data: voter } = await supabase
				.from("player")
				.select("*")
				.eq("lobby_id", actRow.lobby_id)
				.eq("user_id", userId)
				.maybeSingle();
			if (!voter || voter.lobby_id !== actRow.lobby_id) return NextResponse.json({ error: "Not in lobby" }, { status: 400 });
			const voterPlayerId = voter.id as string;
			
			// Fetch lobby to get owner_id
			const { data: lobby } = await supabase.from("lobby").select("owner_id").eq("id", actRow.lobby_id).maybeSingle();
			if (!lobby) return NextResponse.json({ error: "Lobby not found" }, { status: 404 });
			
			// Find the challenge starter (earliest VOTE_STARTED event for this activity)
			const { data: voteStartedEvent } = await supabase
				.from("history_events")
				.select("actor_player_id")
				.eq("lobby_id", actRow.lobby_id)
				.eq("type", "VOTE_STARTED")
				.eq("payload->>activityId", activityId)
				.order("created_at", { ascending: true })
				.limit(1)
				.maybeSingle();
			
			const starterPlayerId = voteStartedEvent?.actor_player_id || null;
			const isStarter = voterPlayerId === starterPlayerId;
			const isOwner = voterPlayerId === lobby.owner_id;
			
			// Only starter or owner can fully cancel the challenge (revert to approved)
			// This only works if the activity is still pending and undecided
			if ((isStarter || isOwner) && actRow.status === "pending" && !actRow.decided_at) {
				// Delete all votes for this activity
				const { error: delAllErr } = await supabase
					.from("activity_votes")
					.delete()
					.eq("activity_id", activityId);
				if (delAllErr) {
					console.error("Vote delete all error:", delAllErr);
					throw delAllErr;
				}
				
				// Revert activity to approved
				const { error: updateErr } = await supabase
					.from("manual_activities")
					.update({
						status: "approved",
						vote_deadline: null,
						decided_at: null
					})
					.eq("id", activityId);
				if (updateErr) {
					console.error("Activity revert error:", updateErr);
					throw updateErr;
				}
				
				// Log the cancellation event
				const reason = isOwner ? "owner_cancel" : "starter_cancel";
				await supabase.from("history_events").insert({
					lobby_id: actRow.lobby_id,
					actor_player_id: voterPlayerId,
					target_player_id: actRow.player_id,
					type: "VOTE_CANCELLED",
					payload: { activityId, reason }
				});
				
				return NextResponse.json({ ok: true, removed: true, reverted: true });
			}
			
			// For everyone else (not starter, not owner) OR if activity is no longer pending/undecided:
			// Just remove their vote and re-run resolution
			const { error: delErr } = await supabase
				.from("activity_votes")
				.delete()
				.eq("activity_id", activityId)
				.eq("voter_player_id", voterPlayerId);
			if (delErr) {
				console.error("Vote delete error:", delErr);
				throw delErr;
			}
			
			// Re-resolve votes (will revert to approved if no votes remain, or apply normal resolution logic)
			await resolveActivityVotes(supabase, activityId);
			void processCommentaryQueue({ lobbyId: String(actRow.lobby_id), limit: 80, maxMs: 600 }).catch((err) => {
				console.error("vote commentary tail-process failed", err);
			});
			return NextResponse.json({ ok: true, removed: true, reverted: false });
		}
		if (!["legit", "sus"].includes(choice)) return NextResponse.json({ error: "Invalid choice" }, { status: 400 });
		// Activity
		const { data: actRow } = await supabase.from("manual_activities").select("*").eq("id", activityId).maybeSingle();
		if (!actRow) return NextResponse.json({ error: "Not found" }, { status: 404 });
		// Voter is member of lobby
		const { data: voter } = await supabase
			.from("player")
			.select("*")
			.eq("lobby_id", actRow.lobby_id)
			.eq("user_id", userId)
			.maybeSingle();
		if (!voter || voter.lobby_id !== actRow.lobby_id) return NextResponse.json({ error: "Not in lobby" }, { status: 400 });
		const voterPlayerId = voter.id as string;
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
		// Commentary will be generated inside resolveActivityVotes when a final verdict is reached
		await resolveActivityVotes(supabase, activityId);
		void processCommentaryQueue({ lobbyId: String(actRow.lobby_id), limit: 80, maxMs: 600 }).catch((err) => {
			console.error("vote commentary tail-process failed", err);
		});
		return NextResponse.json({ ok: true });
	} catch (e) {
		if (isCommentaryQueueUnavailableError(e)) {
			return NextResponse.json(
				{ error: "COMMENTARY_QUEUE_UNAVAILABLE", message: "Run latest SQL schema before voting." },
				{ status: 503 }
			);
		}
		console.error("vote error", e);
		const errorMessage = e instanceof Error ? e.message : "Bad request";
		return NextResponse.json({ error: errorMessage }, { status: 400 });
	}
}
