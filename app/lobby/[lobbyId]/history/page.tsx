"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/components/AuthProvider";
import { ActivityRow, PlayerLite } from "@/types/game";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { ActivityFeedItem } from "@/components/ActivityFeedItem";
import { useToast } from "@/components/ToastProvider";
import { getBrowserSupabase } from "@/lib/supabaseBrowser";
import { AnimatePresence, motion } from "framer-motion";
import { useLobbyRealtime } from "@/hooks/useLobbyRealtime";

type EventRow = { id: string; lobby_id: string; actor_player_id: string | null; target_player_id: string | null; type: string; payload: any; created_at: string };

export default function LobbyHistoryPage({ params }: { params: Promise<{ lobbyId: string }> }) {
	const [lobbyId, setLobbyId] = useState<string>("");
	const [players, setPlayers] = useState<PlayerLite[]>([]);
	const [ownerPlayerId, setOwnerPlayerId] = useState<string | null>(null);
	const [activities, setActivities] = useState<ActivityRow[]>([]);
	const [votesByAct, setVotesByAct] = useState<Record<string, { legit: number; sus: number; mine?: "legit" | "sus" }>>({});
	const { user, isHydrated } = useAuth();
	const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
	const [adjustTarget, setAdjustTarget] = useState<string>("");
	const [busy, setBusy] = useState(false);
	const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
	const [historyEvents, setHistoryEvents] = useState<EventRow[]>([]);
	const [lobbyName, setLobbyName] = useState<string>("");
	const toast = useToast();

	// Subscribe to realtime updates for this lobby
	useLobbyRealtime(lobbyId);

	const reloadActivities = useCallback(async (idOverride?: string) => {
		const id = idOverride || lobbyId;
		if (!id) return;
		try {
			const headers: any = {};
			if (user?.id) headers["x-user-id"] = user.id;
			const res = await fetch(`/api/lobby/${encodeURIComponent(id)}/history`, { headers, cache: "no-store" });
			if (res.ok) {
				const data = await res.json();
				setActivities(data.activities);
				setPlayers(data.players);
				setOwnerPlayerId(data.ownerPlayerId);
				setVotesByAct(data.votes);
				if (data.myPlayerId) setMyPlayerId(data.myPlayerId);
				if (data.events) setHistoryEvents(data.events);
				if (data.lobbyName) setLobbyName(data.lobbyName);
			}
		} catch { /* ignore */ }
	}, [lobbyId, user?.id]);

	useEffect(() => {
		(async () => {
			const { lobbyId } = await params;
			setLobbyId(lobbyId);
			// Wait for auth hydration and user to be known; the API requires x-user-id
			if (!isHydrated) return;
			if (!user?.id) return;
			await reloadActivities(lobbyId);
		})();
	}, [params, isHydrated, user?.id, reloadActivities]);

	// Also refresh when a global refresh event is fired (after posting or from realtime)
	useEffect(() => {
		function onRefresh() { reloadActivities(); }
		if (typeof window !== "undefined") window.addEventListener("gymdm:refresh-live", onRefresh as any);
		return () => { if (typeof window !== "undefined") window.removeEventListener("gymdm:refresh-live", onRefresh as any); };
	}, [lobbyId, reloadActivities]);

	// Auto-refresh every 30 seconds while tab is visible
	useAutoRefresh(
		() => {
			reloadActivities(lobbyId);
		},
		30000, // 30s refresh for history
		[lobbyId]
	);

	// Supabase Realtime subscription for live vote updates across all devices
	useEffect(() => {
		if (!lobbyId) return;
		const supabase = getBrowserSupabase();
		if (!supabase) return;
		
		const channel = supabase.channel(`lobby_votes:${lobbyId}`)
			.on("postgres_changes", { 
				event: "*", 
				schema: "public", 
				table: "vote", 
				filter: `activity_id=in.(${activities.map(a => a.id).join(",")})` 
			}, () => {
				reloadActivities();
			})
			.subscribe();
			
		return () => {
			supabase.removeChannel(channel);
		};
	}, [lobbyId, activities.length, reloadActivities]);

	const isOwner = useMemo(() => {
		return ownerPlayerId && myPlayerId ? ownerPlayerId === myPlayerId : false;
	}, [ownerPlayerId, myPlayerId]);

	async function postComment(activityId: string, text: string) {
		if (!text.trim()) return;
		try {
			await fetch(`/api/activity/${activityId}/comment`, {
				method: "POST",
				headers: { "Content-Type": "application/json", "x-user-id": user?.id || "" },
				body: JSON.stringify({ text })
			});
			reloadActivities();
		} catch {
			toast.push("Failed to post comment");
		}
	}

	async function adjustHearts(playerId: string, delta: number, reason: string) {
		if (!reason.trim()) {
			toast.push("Enter a reason");
			return;
		}
		setBusy(true);
		try {
			const res = await fetch(`/api/lobby/${lobbyId}/admin/hearts`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ targetPlayerId: playerId, delta, reason, userId: user?.id })
			});
			if (res.ok) {
				setAdjustTarget("");
				reloadActivities();
				toast.push("Hearts adjusted");
			} else {
				toast.push("Failed to adjust");
			}
		} finally {
			setBusy(false);
		}
	}

	async function deleteActivity(actId: string) {
		if (!confirm("Delete this activity? Pot/hearts will not revert automatically.")) return;
		try {
			await fetch(`/api/activity/${actId}`, {
				method: "DELETE",
				headers: { "x-user-id": user?.id || "" }
			});
			reloadActivities();
			toast.push("Deleted");
		} catch {
			toast.push("Failed to delete");
		}
	}

	async function vote(activityId: string, type: "legit" | "sus") {
		if (!myPlayerId) return;
		// Optimistic
		setVotesByAct(prev => {
			const next = { ...prev };
			const current = next[activityId] || { legit: 0, sus: 0 };
			// If changing vote, remove old
			if (current.mine === "legit") current.legit--;
			if (current.mine === "sus") current.sus--;
			// Add new
			if (type === "legit") current.legit++;
			if (type === "sus") current.sus++;
			current.mine = type;
			next[activityId] = current;
			return next;
		});

		try {
			const res = await fetch(`/api/activity/${activityId}/vote`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ playerId: myPlayerId, type })
			});
			if (!res.ok) throw new Error();
			reloadActivities();
		} catch {
			reloadActivities(); // revert
			toast.push("Vote failed");
		}
	}

	if (!isHydrated) return <div className="p-8 text-center text-deepBrown/60">Loading...</div>;

	return (
		<div className="mx-auto max-w-2xl pb-20">
			<div className="flex items-center justify-between mb-4">
				<h2 className="poster-headline text-xl">{lobbyName || "History"}</h2>
			</div>

			<div className="space-y-6">
				<section>
					<h3 className="text-xs font-bold uppercase tracking-wide mb-3 text-deepBrown/50">Recent Activity</h3>
					<div className="space-y-4">
						{historyEvents.filter(e => e.type === "KO" || e.type === "WINNER" || e.type === "REVIVE").map(e => (
							<div key={e.id} className="paper-card paper-grain ink-edge p-3 bg-red-50 border-l-4 border-accent-danger text-sm">
								<div className="flex items-center gap-2 mb-1">
									<span className="text-xl">{e.type === "KO" ? "🥊" : e.type === "WINNER" ? "👑" : "❤️"}</span>
									<span className="font-bold">
										{e.type === "KO" ? "KNOCKOUT" : e.type === "WINNER" ? "VICTORY" : "REVIVED"}
									</span>
									<span className="ml-auto text-[10px] opacity-60">
										{new Date(e.created_at).toLocaleDateString()}
									</span>
								</div>
								<p>
									{e.type === "KO" 
										? `${e.payload.loserName} was KO'd! Pot is $${e.payload.pot}.` 
										: e.type === "WINNER"
										? `${e.payload.winnerName} wins the season! Pot: $${e.payload.pot}.`
										: `${e.payload.playerName} used Sudden Death to revive.`}
								</p>
							</div>
						))}

						{activities.length === 0 && historyEvents.length === 0 ? (
							<div className="p-8 text-center border border-dashed border-deepBrown/30 rounded-xl text-sm text-deepBrown/60">
								No history yet.
							</div>
						) : (
							activities.map(a => (
								<ActivityFeedItem
									key={a.id}
									activity={a}
									votes={votesByAct[a.id] || { legit: 0, sus: 0 }}
									players={players}
									onVote={vote}
									onComment={postComment}
									onDelete={isOwner || a.playerId === myPlayerId ? () => deleteActivity(a.id) : undefined}
									currentUserId={user?.id}
									onImageClick={setLightboxUrl}
								/>
							))
						)}
					</div>
				</section>

				{isOwner && (
					<section className="mt-8 pt-6 border-t border-deepBrown/20">
						<h3 className="text-xs font-bold uppercase tracking-wide mb-3 text-deepBrown/50">Admin: Adjust Hearts</h3>
						<div className="paper-card p-4 bg-white/50">
							<select 
								className="w-full mb-2 p-2 text-sm rounded border border-deepBrown/30 bg-white"
								value={adjustTarget}
								onChange={e => setAdjustTarget(e.target.value)}
							>
								<option value="">Select player...</option>
								{players.map(p => (
									<option key={p.id} value={p.id}>{p.name} ({p.hearts} ❤)</option>
								))}
							</select>
							{adjustTarget && (
								<div className="flex gap-2">
									<button disabled={busy} onClick={() => adjustHearts(adjustTarget, 1, "Admin bonus")} className="flex-1 bg-green-100 border border-green-300 p-2 rounded text-xs font-bold text-green-800 hover:bg-green-200">
										+1 Heart
									</button>
									<button disabled={busy} onClick={() => adjustHearts(adjustTarget, -1, "Admin penalty")} className="flex-1 bg-red-100 border border-red-300 p-2 rounded text-xs font-bold text-red-800 hover:bg-red-200">
										-1 Heart
									</button>
								</div>
							)}
						</div>
					</section>
				)}
			</div>

			<AnimatePresence>
				{lightboxUrl && (
					<motion.div
						initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
						className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
						onClick={() => setLightboxUrl(null)}
					>
						<img src={lightboxUrl} alt="Full size" className="max-w-full max-h-full rounded shadow-2xl" />
						<button className="absolute top-4 right-4 text-white text-xl bg-white/20 w-10 h-10 rounded-full">×</button>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}
