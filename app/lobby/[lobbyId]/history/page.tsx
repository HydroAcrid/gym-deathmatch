"use client";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ToastProvider";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import { StyledSelect } from "@/components/ui/StyledSelect";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";

type PlayerLite = { id: string; name: string; avatar_url?: string | null; user_id?: string | null };
type ActivityRow = {
	id: string; lobby_id: string; player_id: string; date: string; type: string;
	duration_minutes: number | null; distance_km: number | null;
	caption: string | null; photo_url: string | null;
	status: string; vote_deadline: string | null; decided_at: string | null;
	created_at?: string | null;
};
type EventRow = { id: string; lobby_id: string; actor_player_id: string | null; target_player_id: string | null; type: string; payload: any; created_at: string };

export default function LobbyHistoryPage({ params }: { params: Promise<{ lobbyId: string }> }) {
	const [lobbyId, setLobbyId] = useState<string>("");
	const [players, setPlayers] = useState<PlayerLite[]>([]);
	const [ownerPlayerId, setOwnerPlayerId] = useState<string | null>(null);
	const [activities, setActivities] = useState<ActivityRow[]>([]);
	const [votesByAct, setVotesByAct] = useState<Record<string, { legit: number; sus: number; mine?: "legit" | "sus" }>>({});
	const { user } = useAuth();
	const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
	const [adjustTarget, setAdjustTarget] = useState<string>("");
	const [busy, setBusy] = useState(false);
	const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
	const [historyEvents, setHistoryEvents] = useState<EventRow[]>([]);
	const [lobbyName, setLobbyName] = useState<string>("");
	const toast = useToast();

	useEffect(() => {
		(async () => {
			const { lobbyId } = await params;
			setLobbyId(lobbyId);
			// Wait for user to be known; the API requires x-user-id
			if (!user?.id) return;
			await reloadActivities(lobbyId);
		})();
	}, [params, user?.id]);

	// Also refresh when a global refresh event is fired (after posting)
	useEffect(() => {
		function onRefresh() { reloadActivities(); }
		if (typeof window !== "undefined") window.addEventListener("gymdm:refresh-live", onRefresh as any);
		return () => { if (typeof window !== "undefined") window.removeEventListener("gymdm:refresh-live", onRefresh as any); };
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [lobbyId]);

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
		
		let votesChannel: any = null;
		let activitiesChannel: any = null;
		let isSubscribed = true;
		
		(async () => {
			const supabase = (await import("@/lib/supabaseBrowser")).getBrowserSupabase();
			if (!supabase || !isSubscribed) return;

			// Subscribe to activity_votes changes
			// Note: Supabase Realtime doesn't support complex filters like `in.()`, so we subscribe to all
			// and filter client-side by checking if the activity belongs to this lobby
			// We'll reload on any vote change - the reload function already filters by lobby
			votesChannel = supabase
				.channel(`activity-votes-${lobbyId}-${Date.now()}`)
				.on(
					'postgres_changes',
					{
						event: '*', // INSERT, UPDATE, DELETE
						schema: 'public',
						table: 'activity_votes'
					},
					(payload: any) => {
						if (!isSubscribed) return;
						// Check if this vote is for an activity we care about
						// We check by reloading and letting the server filter, but we can optimize
						// by checking if we have this activity in our current state
						const activityId = payload.new?.activity_id || payload.old?.activity_id;
						// Reload activities - the server will only return activities for this lobby
						// This ensures we get updates even for newly added activities
						reloadActivities();
					}
				)
				.subscribe();

			// Subscribe to manual_activities status changes for this lobby
			activitiesChannel = supabase
				.channel(`manual-activities-${lobbyId}-${Date.now()}`)
				.on(
					'postgres_changes',
					{
						event: 'UPDATE', // Only status/decided_at changes
						schema: 'public',
						table: 'manual_activities',
						filter: `lobby_id=eq.${lobbyId}`
					},
					() => {
						if (!isSubscribed) return;
						// Reload activities when status changes
						reloadActivities();
					}
				)
				.subscribe();
		})();

		// Cleanup function
		return () => {
			isSubscribed = false;
			(async () => {
				const supabase = (await import("@/lib/supabaseBrowser")).getBrowserSupabase();
				if (supabase) {
					if (votesChannel) {
						await supabase.removeChannel(votesChannel);
					}
					if (activitiesChannel) {
						await supabase.removeChannel(activitiesChannel);
					}
				}
			})();
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [lobbyId]); // Only depend on lobbyId to avoid re-subscribing on every activity change

	async function reloadActivities(lid: string = lobbyId) {
		if (!lid) return;
		// Prefer server API (validates membership with service key) to avoid client RLS pitfalls
		const me = user?.id || "";
		const res = await fetch(`/api/lobby/${encodeURIComponent(lid)}/history?t=${Date.now()}`, {
			headers: me ? { "x-user-id": me } as any : undefined,
			cache: "no-store"
		});
		if (res.ok) {
			const j = await res.json();
			const acts = (j?.activities ?? []) as ActivityRow[];
			const prows = (j?.players ?? []) as PlayerLite[];
			const lrow = j?.lobby as any;
			const comms = (j?.comments ?? []) as Array<{ id: string; type: string; rendered: string; created_at: string; primary_player_id?: string | null }>;
			setLobbyName(lrow?.name || lid);
			setPlayers(prows as any);
			setActivities(acts as any);
			// Convert comments to history events format for display
			const commentEvents = comms.map(c => ({
				id: c.id,
				lobby_id: lid,
				actor_player_id: c.primary_player_id || null,
				target_player_id: null,
				type: "COMMENT",
				payload: { rendered: c.rendered, commentType: c.type },
				created_at: c.created_at
			}));
			// Merge regular events with comment events
			const allEvents = [...(j?.events ?? []), ...commentEvents];
			setHistoryEvents(allEvents as any);
			// derive owner and my player id
			let currentMyPlayerId: string | null = null;
			if (user?.id) {
				const mine = (prows ?? []).find((p: any) => (p as any).user_id === user.id);
				currentMyPlayerId = mine?.id ?? null;
				setMyPlayerId(currentMyPlayerId);
			}
			// Set owner player ID from API response
			const ownerPlayerIdFromApi = j?.ownerPlayerId as string | null | undefined;
			if (ownerPlayerIdFromApi) {
				setOwnerPlayerId(ownerPlayerIdFromApi);
			} else if (j?.ownerUserId && user?.id && j.ownerUserId === user.id) {
				// Fallback: if owner_user_id matches current user, find their player ID
				const ownerPlayer = (prows ?? []).find((p: any) => (p as any).user_id === user.id);
				if (ownerPlayer) {
					setOwnerPlayerId(ownerPlayer.id);
				}
			}
			// fetch votes client-side for convenience
			const supabase = (await import("@/lib/supabaseBrowser")).getBrowserSupabase();
			if (supabase && acts.length) {
				const ids = acts.map((a: any) => a.id);
				// Use cache: "no-store" equivalent by adding timestamp to force fresh fetch
				const { data: allVotes, error: votesError } = await supabase
					.from("activity_votes")
					.select("*")
					.in("activity_id", ids);
				if (votesError) {
					console.error("Failed to fetch votes:", votesError);
				}
				const map: Record<string, { legit: number; sus: number; mine?: "legit" | "sus" }> = {};
				// Initialize all activities with zero votes
				for (const id of ids) map[id] = { legit: 0, sus: 0 };
				// Count votes
				for (const v of (allVotes ?? [])) {
					if (!map[v.activity_id]) map[v.activity_id] = { legit: 0, sus: 0 };
					if (v.choice === "legit") map[v.activity_id].legit++;
					if (v.choice === "sus") map[v.activity_id].sus++;
					// Use the current myPlayerId from this fetch, not the stale closure value
					if (v.voter_player_id === currentMyPlayerId) map[v.activity_id].mine = v.choice;
				}
				setVotesByAct(map);
				return;
			}
		}
		// Fallback: empty
		setActivities([]);
		setHistoryEvents([]);
		const map: Record<string, { legit: number; sus: number; mine?: "legit" | "sus" }> = {};
		setVotesByAct(map);
	}

	function playerById(id: string) { return players.find(p => p.id === id); }
	function canVote(a: ActivityRow) {
		// Can't vote if already decided (has decided_at timestamp)
		if (a.decided_at) return false;
		// Disable voting for very small lobbies (<=2 players)
		if ((players?.length || 0) <= 2) return false;
		if (!myPlayerId || a.player_id === myPlayerId) return false;
		// Allow voting on pending activities (if deadline hasn't passed)
		if (a.status === "pending") {
			if (a.vote_deadline && new Date(a.vote_deadline).getTime() < Date.now()) return false;
			return true;
		}
		// Allow voting on approved activities (to challenge them) if not decided
		if (a.status === "approved" && !a.decided_at) return true;
		// Can't vote on rejected activities
		return false;
	}
	function timeLeft(a: ActivityRow) {
		if (!a.vote_deadline) return "";
		const ms = new Date(a.vote_deadline).getTime() - Date.now();
		if (ms <= 0) return "0h";
		const h = Math.floor(ms / 3600000);
		const m = Math.floor((ms % 3600000) / 60000);
		return `${h}h ${m}m`;
	}

	async function vote(activityId: string, choice: "legit" | "sus" | "remove") {
		if (!myPlayerId) {
			toast?.push?.("Unable to vote: player ID not found. Please refresh the page.");
			return;
		}
		setBusy(true);
		try {
			const res = await fetch(`/api/activities/${encodeURIComponent(activityId)}/vote`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ voterPlayerId: myPlayerId, choice }),
				cache: "no-store"
			});
			if (!res.ok) {
				const error = await res.json().catch(() => ({ error: "Unknown error" }));
				toast?.push?.(`Failed to ${choice === "remove" ? "remove vote" : "vote"}: ${error.error || "Unknown error"}`);
				return;
			}
			
			// Parse response to check if challenge was reverted
			const data = await res.json().catch(() => ({ ok: true }));
			
			// Show success message based on choice and response
			if (choice === "remove") {
				if (data.reverted === true) {
					toast?.push?.("Challenge cancelled. Activity reverted to approved ✅");
				} else {
					toast?.push?.("Your vote was removed.");
				}
			} else {
				const isChangingVote = votesByAct[activityId]?.mine && votesByAct[activityId].mine !== choice;
				if (choice === "legit") {
					toast?.push?.(isChangingVote ? "Changed vote to ✅ Looks good" : "Voted ✅ Looks good");
				} else {
					toast?.push?.(isChangingVote ? "Changed vote to 🚩 Challenge" : "Voted 🚩 Challenge");
				}
			}
			
			// Force a fresh reload with cache busting
			// Clear votes state first to force re-fetch
			setVotesByAct({});
			await reloadActivities();
			// Also trigger a small delay to ensure UI updates (give DB time to commit)
			setTimeout(() => {
				setVotesByAct({});
				reloadActivities();
			}, 300);
		} catch (e) {
			console.error("Vote error", e);
			toast?.push?.(`Failed to ${choice === "remove" ? "remove vote" : "vote"}. Please try again.`);
		} finally { setBusy(false); }
	}

	async function overrideActivity(activityId: string, newStatus: "approved" | "rejected") {
		if (!ownerPlayerId) {
			toast?.push?.("Unable to override: owner ID not found.");
			return;
		}
		setBusy(true);
		try {
			const res = await fetch(`/api/activities/${encodeURIComponent(activityId)}/override`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ ownerPlayerId, newStatus }),
				cache: "no-store"
			});
			if (!res.ok) {
				const error = await res.json().catch(() => ({ error: "Unknown error" }));
				toast?.push?.(`Failed to override: ${error.error || "Unknown error"}`);
				return;
			}
			toast?.push?.(newStatus === "approved" ? "Activity approved ✅" : "Activity rejected 🚩");
			// Clear votes state to force re-fetch
			setVotesByAct({});
			await reloadActivities();
			setTimeout(() => {
				setVotesByAct({});
				reloadActivities();
			}, 300);
		} catch (e) {
			console.error("Override error", e);
			toast?.push?.("Failed to override. Please try again.");
		} finally { setBusy(false); }
	}

	async function adjustHearts(delta: number) {
		if (!ownerPlayerId || !adjustTarget) return;
		setBusy(true);
		try {
			await fetch(`/api/lobby/${encodeURIComponent(lobbyId)}/adjust-hearts`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ ownerPlayerId, targetPlayerId: adjustTarget, delta })
			});
			alert("Adjustment logged. Hearts will reflect in the lobby view.");
		} finally { setBusy(false); }
	}

	const isOwner = ownerPlayerId && myPlayerId && ownerPlayerId === myPlayerId;

	// Build a single-column feed of items, newest first
	const items = useMemo(() => {
		const arr: Array<{ kind: "post" | "event"; createdAt: string; a?: ActivityRow; e?: EventRow }> = [];
		for (const a of activities as any[]) arr.push({ kind: "post", createdAt: (a.created_at || a.date) as string, a });
		for (const e of historyEvents as any[]) arr.push({ kind: "event", createdAt: e.created_at as string, e });
		arr.sort((x, y) => new Date(y.createdAt).getTime() - new Date(x.createdAt).getTime());
		return arr;
	}, [activities, historyEvents]);

	// Fallback signed URLs for photos if the bucket is not public
	const [signedUrlByAct, setSignedUrlByAct] = useState<Record<string, string>>({});
	async function resolveSignedUrl(activityId: string, publicUrl: string) {
		try {
			const supabase = (await import("@/lib/supabaseBrowser")).getBrowserSupabase();
			if (!supabase || !publicUrl) return;
			// public URL looks like .../storage/v1/object/public/<bucket>/<path>
			const marker = "/object/public/";
			const idx = publicUrl.indexOf(marker);
			if (idx === -1) return;
			const sub = publicUrl.slice(idx + marker.length);
			const slash = sub.indexOf("/");
			if (slash === -1) return;
			const bucket = sub.slice(0, slash);
			const objectPath = sub.slice(slash + 1);
			const { data, error } = await supabase.storage.from(bucket).createSignedUrl(objectPath, 60 * 60 * 12);
			if (error || !data?.signedUrl) return;
			setSignedUrlByAct(prev => ({ ...prev, [activityId]: data.signedUrl }));
		} catch {
			// ignore
		}
	}

	return (
		<div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 pb-8">
			<div className="paper-card paper-grain ink-edge p-5 sm:p-6 mb-6 sm:mb-8 border-b-4" style={{ borderColor: "#E1542A" }}>
				<div className="poster-headline text-lg sm:text-xl mb-2">HISTORY</div>
				<div className="text-deepBrown/70 text-xs sm:text-sm">Manual posts and decisions • Lobby: {lobbyName || lobbyId}</div>
			</div>

			{isOwner ? (
				<div className="paper-card paper-grain ink-edge p-4 sm:p-5 mb-6 sm:mb-8">
					<div className="poster-headline text-base sm:text-lg mb-3 sm:mb-4">Owner tools</div>
					<div className="flex flex-col md:flex-row gap-2 md:gap-3 items-start md:items-center md:justify-start flex-wrap">
						<div className="w-full md:w-auto">
							<StyledSelect value={adjustTarget} onChange={e => setAdjustTarget(e.target.value)} className="w-full md:w-auto text-sm">
								<option value="">Select athlete</option>
								{players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
							</StyledSelect>
						</div>
						<div className="flex gap-2 w-full md:w-auto">
							<Button variant="secondary" size="md" className="flex-1 md:flex-none" disabled={!adjustTarget || busy} onClick={() => adjustHearts(1)}>
								+1 HEART
							</Button>
							<Button variant="secondary" size="md" className="flex-1 md:flex-none" disabled={!adjustTarget || busy} onClick={() => adjustHearts(-1)}>
								-1 HEART
							</Button>
						</div>
						<div className="text-[11px] sm:text-xs text-deepBrown/70 w-full md:w-auto">Logged publicly in history.</div>
					</div>
				</div>
			) : null}

			<div className="flex flex-col gap-4 sm:gap-6">
				{items.map(item => {
					if (item.kind === "event") {
						const ev = item.e as EventRow;
						return (
							<div key={`ev-${ev.id}`} className="paper-card paper-grain ink-edge p-4 sm:p-5 flex items-start gap-3 sm:gap-4">
								<div className="text-lg sm:text-xl flex-shrink-0">📜</div>
								<div className="flex-1 min-w-0">
									<div className="text-[11px] sm:text-xs text-deepBrown/70 mb-1">{new Date(ev.created_at).toLocaleString()}</div>
									<div className="text-sm sm:text-base leading-relaxed">{renderEventLine(ev, players)}</div>
								</div>
							</div>
						);
					}
					const a = item.a as ActivityRow;
					const p = playerById(a.player_id);
					const v = votesByAct[a.id] || { legit: 0, sus: 0 };
					const pending = a.status === "pending";
					return (
						<div key={a.id} className="paper-card paper-grain ink-edge p-4 sm:p-5 flex flex-col gap-4 sm:gap-5">
							<div className="flex items-center gap-3">
								<div className="h-10 w-10 rounded-full overflow-hidden bg-tan border border-deepBrown/20 flex items-center justify-center">
									{p?.avatar_url ? <img src={p.avatar_url} alt={p?.name || "athlete"} className="h-full w-full object-cover" /> : <span className="text-xl">🏋️‍♂️</span>}
								</div>
								<div className="flex-1">
									<div className="poster-headline text-base leading-5">{(p?.name || "Unknown athlete").toUpperCase()}</div>
									<div className="text-[11px] text-deepBrown/70">{new Date(a.date).toLocaleString()}</div>
								</div>
								<StatusPill status={a.status as "pending" | "approved" | "rejected"} />
							</div>
							{a.caption ? <div className="text-sm">{a.caption}</div> : null}
							{a.photo_url ? (
								<button
									type="button"
									aria-label="Open full-size photo"
									className="relative w-full h-52 sm:h-56 md:h-64 rounded-xl overflow-hidden border border-deepBrown/20 bg-[#1a1512] group"
									onClick={() => setLightboxUrl(a.photo_url || null)}
								>
									<img
										src={signedUrlByAct[a.id] || a.photo_url}
										alt=""
										className="absolute inset-0 w-full h-full object-cover"
										loading="lazy"
										onError={() => resolveSignedUrl(a.id, a.photo_url || "")}
									/>
									<div className="absolute bottom-2 right-2 text-[12px] px-2 py-1 rounded-md bg-black/50 text-cream opacity-80 group-hover:opacity-100 transition">
										🔍 Tap to expand
									</div>
								</button>
							) : null}
							<div className="text-xs sm:text-sm text-deepBrown/80 border-t border-deepBrown/10 pt-3 sm:pt-4">
								<div className="flex flex-wrap items-center gap-1.5">
									<strong className="font-medium">{titleCase(a.type)}</strong>
									{a.duration_minutes && <span>{a.duration_minutes} min</span>}
									{a.duration_minutes && a.distance_km && <span>·</span>}
									{a.distance_km && <span>{a.distance_km} km</span>}
								</div>
							</div>
							<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4 text-xs sm:text-sm">
								<div className="flex flex-wrap items-center gap-1.5 text-deepBrown/80">
									{a.status === "approved" && (
										<>
											<span className="font-medium">Approved:</span>
											<span>{v.legit} legit</span>
											{v.sus > 0 && <span>· {v.sus} sus</span>}
										</>
									)}
									{a.status === "rejected" && (
										<>
											<span className="font-medium">Rejected:</span>
											<span>{v.sus} sus</span>
											{v.legit > 0 && <span>· {v.legit} legit</span>}
										</>
									)}
									{pending && (
										<>
											<span className="font-medium">Pending vote:</span>
											<span>{v.legit} legit</span>
											<span>· {v.sus} sus</span>
											{a.vote_deadline && <span className="text-deepBrown/60">· {timeLeft(a)} left</span>}
										</>
									)}
								</div>
								{canVote(a) && !a.decided_at ? (
									<div className="flex gap-2">
										{/* For approved activities, only show "Feels sus" initially. Once challenged (pending), show both buttons */}
										{a.status === "approved" && !v.mine ? (
											// Approved activity with no vote yet - only show "Feels sus" button
											<Button
												variant="secondary"
												size="sm"
												disabled={busy}
												onClick={() => vote(a.id, "sus")}
												title="Challenge this activity"
												className="normal-case"
											>
												Feels sus 🚩
											</Button>
										) : (
											// Pending activity or user has already voted - show both buttons
											<>
												<Button
													variant={v.mine === "legit" ? "primary" : "secondary"}
													size="sm"
													disabled={busy}
													onClick={() => vote(a.id, "legit")}
													title={v.mine === "legit" ? `You voted 'Count it'. Click to change.` : `Vote 'Count it'`}
													className="normal-case"
												>
													Count it ✅
												</Button>
												<Button
													variant={v.mine === "sus" ? "primary" : "secondary"}
													size="sm"
													disabled={busy}
													onClick={() => vote(a.id, "sus")}
													title={v.mine === "sus" ? `You voted 'Feels sus'. Click to change.` : `Vote 'Feels sus'`}
													className="normal-case"
												>
													Feels sus 🚩
												</Button>
											</>
										)}
										{/* Show "Remove vote" button if user has voted and activity is pending (challenged) */}
										{v.mine && a.status === "pending" && (
											<Button
												variant="secondary"
												size="sm"
												disabled={busy}
												onClick={() => vote(a.id, "remove")}
												title="Remove your vote to revert activity to approved"
												className="normal-case text-xs"
											>
												Remove vote
											</Button>
										)}
									</div>
								) : a.decided_at ? (
									<div className="text-[11px] text-deepBrown/50 italic">Voting closed</div>
								) : a.player_id === myPlayerId ? (
									<div className="text-[11px] text-deepBrown/50 italic">You can't vote on your own activity</div>
								) : !myPlayerId ? (
									<div className="text-[11px] text-deepBrown/50 italic">Sign in to vote</div>
								) : (players?.length || 0) <= 2 ? (
									<div className="text-[11px] text-deepBrown/50 italic">Voting requires 3+ players</div>
								) : null}
							</div>
							{isOwner ? (
								<div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 pt-3 sm:pt-4 border-t border-deepBrown/10">
									<span className="text-[11px] sm:text-xs text-deepBrown/70 font-medium uppercase tracking-wide whitespace-nowrap">Owner override:</span>
									<div className="flex gap-2 w-full sm:w-auto">
										<Button
											variant="secondary"
											size="sm"
											disabled={busy}
											onClick={() => overrideActivity(a.id, "approved")}
											className={`flex-1 sm:flex-none ${a.status === "approved" ? "bg-accent-primary/20 border-accent-primary" : ""}`}
											title={a.status === "approved" ? "Currently approved" : "Override to approve"}
										>
											APPROVE
										</Button>
										<Button
											variant="secondary"
											size="sm"
											disabled={busy}
											onClick={() => overrideActivity(a.id, "rejected")}
											className={`flex-1 sm:flex-none ${a.status === "rejected" ? "bg-accent-primary/20 border-accent-primary" : ""}`}
											title={a.status === "rejected" ? "Currently rejected" : "Override to reject"}
										>
											REJECT
										</Button>
									</div>
								</div>
							) : null}
							<ActivityComments activityId={a.id} />
						</div>
					);
				})}
				{items.length === 0 && <div className="text-deepBrown/70 text-sm">No posts yet.</div>}
			</div>
			<Lightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
		</div>
	);
}

function ActivityComments({ activityId }: { activityId: string }) {
	const [comments, setComments] = useState<Array<{ id: string; type: string; rendered: string; created_at: string }>>([]);
	useEffect(() => {
		(async () => {
			try {
				const res = await fetch(`/api/activity/${encodeURIComponent(activityId)}/comments`, { cache: "no-store" });
				if (!res.ok) return;
				const j = await res.json();
				setComments(j.comments ?? []);
			} catch { /* ignore */ }
		})();
	}, [activityId]);
	if (!comments.length) return null;
	return (
		<div className="mt-2 border-t border-deepBrown/20 pt-2 space-y-1">
			{comments.map(c => (
				<div key={c.id} className="text-[12px] text-deepBrown/90">
					{c.rendered}
					<span className="ml-2 text-[11px] text-deepBrown/60">{new Date(c.created_at).toLocaleString()}</span>
				</div>
			))}
		</div>
	);
}


function titleCase(s: string) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

function renderEventLine(ev: EventRow, players: PlayerLite[]) {
	const actor = ev.actor_player_id ? (players.find(p => p.id === ev.actor_player_id)?.name || "Unknown athlete") : "System";
	const target = ev.target_player_id ? (players.find(p => p.id === ev.target_player_id)?.name || "Unknown athlete") : "";
	if (ev.type === "ACTIVITY_LOGGED") return `${actor} posted a workout`;
	if (ev.type === "VOTE_RESULT") {
		const result = ev.payload?.result || "decision";
		return `Vote result: ${result.replace(/_/g, " ")} (${ev.payload?.legit ?? 0} legit · ${ev.payload?.sus ?? 0} sus)`;
	}
	if (ev.type === "OWNER_OVERRIDE_ACTIVITY") {
		return `${actor} set an activity to ${String(ev.payload?.newStatus || "").toUpperCase()}${target ? ` for ${target}` : ""}`;
	}
	if (ev.type === "OWNER_ADJUST_HEARTS") {
		const d = Number(ev.payload?.delta || 0);
		const sign = d > 0 ? "+" : "";
		return `${actor} adjusted hearts for ${target}: ${sign}${d}${ev.payload?.reason ? ` — ${ev.payload.reason}` : ""}`;
	}
	if (ev.type === "COMMENT") {
		// Render comment text directly (e.g., "The arena opens. Fight!")
		return ev.payload?.rendered || "Comment";
	}
	return `${actor || "System"}: ${ev.type}`;
}

function Lightbox({ url, onClose }: { url: string | null; onClose: () => void }) {
	if (!url) return null;
	return (
		<div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
			<div className="relative max-w-3xl w-full">
				<img src={url} alt="" className="w-full h-auto object-contain rounded-md" />
				<button className="absolute top-2 right-2 px-3 py-1.5 rounded-md bg-[#000]/70 text-cream text-xs" onClick={onClose}>
					Close
				</button>
			</div>
		</div>
	);
}
