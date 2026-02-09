"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ToastProvider";
import { Button } from "@/src/ui2/ui/button";
import { Input } from "@/src/ui2/ui/input";
import { Textarea } from "@/src/ui2/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/src/ui2/ui/select";
import { PhotoLightbox } from "@/src/ui2/components/PhotoLightbox";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { authFetch } from "@/lib/clientAuth";

type PlayerLite = {
	id: string;
	name: string;
	avatar_url?: string | null;
	user_id?: string | null;
};

type ActivityRow = {
	id: string;
	lobby_id: string;
	player_id: string;
	player_snapshot?: PlayerLite | null;
	player_name?: string | null;
	player_avatar_url?: string | null;
	player_user_id?: string | null;
	date: string;
	type: string;
	duration_minutes: number | null;
	distance_km: number | null;
	caption: string | null;
	notes?: string | null;
	photo_url: string | null;
	status: string;
	vote_deadline: string | null;
	decided_at: string | null;
	created_at?: string | null;
};

type EventRow = {
	id: string;
	lobby_id: string;
	actor_player_id: string | null;
	target_player_id: string | null;
	actor_snapshot?: PlayerLite | null;
	target_snapshot?: PlayerLite | null;
	actor_name?: string | null;
	target_name?: string | null;
	type: string;
	payload: any;
	created_at: string;
};

type CommentRow = {
	id: string;
	type: string;
	rendered: string;
	created_at: string;
	primary_player_id?: string | null;
};

export default function LobbyHistoryPage({ params }: { params: Promise<{ lobbyId: string }> }) {
	const [lobbyId, setLobbyId] = useState<string>("");
	const [players, setPlayers] = useState<PlayerLite[]>([]);
	const [ownerPlayerId, setOwnerPlayerId] = useState<string | null>(null);
	const [ownerUserId, setOwnerUserId] = useState<string | null>(null);
	const [activities, setActivities] = useState<ActivityRow[]>([]);
	const [votesByAct, setVotesByAct] = useState<Record<string, { legit: number; sus: number; mine?: "legit" | "sus" }>>({});
	const { user, isHydrated } = useAuth();
	const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
	const [adjustTarget, setAdjustTarget] = useState<string>("");
	const [busy, setBusy] = useState(false);
	const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
	const [historyEvents, setHistoryEvents] = useState<EventRow[]>([]);
	const [lobbyName, setLobbyName] = useState<string>("");
const [signedUrlByAct, setSignedUrlByAct] = useState<Record<string, string>>({});
const toast = useToast();
const [currentPot, setCurrentPot] = useState<number | null>(null);
const [potInput, setPotInput] = useState<string>("");
	const isOwnerUser = ownerUserId && user?.id === ownerUserId;

		const reloadActivities = useCallback(async (lid: string = lobbyId) => {
		if (!lid) return;
		if (!isHydrated || !user?.id) return;
		try {
			const res = await authFetch(`/api/lobby/${encodeURIComponent(lid)}/history?t=${Date.now()}`, {
				cache: "no-store"
			});
			if (!res.ok) {
				setActivities([]);
				setHistoryEvents([]);
				setVotesByAct({});
				return;
			}
			const data = await res.json();
			const rawActivities = (data?.activities ?? []) as any[];
				const normalizedActivities: ActivityRow[] = rawActivities.map((a: any) => ({
					...a,
					player_id: a.player_id ?? a.playerId,
					player_snapshot: a.player_snapshot ?? a.playerSnapshot ?? null,
					player_name: a.player_name ?? a.playerName ?? a.player_snapshot?.name ?? null,
					player_avatar_url: a.player_avatar_url ?? a.playerAvatarUrl ?? a.player_snapshot?.avatar_url ?? null,
					player_user_id: a.player_user_id ?? a.playerUserId ?? a.player_snapshot?.user_id ?? null,
					date: a.date ?? a.createdAt ?? a.created_at ?? "",
					duration_minutes: a.duration_minutes ?? a.duration ?? null,
					distance_km: a.distance_km ?? a.distance ?? null,
					caption: a.caption ?? null,
					notes: a.notes ?? null,
					photo_url: a.photo_url ?? a.imageUrl ?? null,
					vote_deadline: a.vote_deadline ?? a.voteDeadline ?? null,
					decided_at: a.decided_at ?? a.decidedAt ?? null
				}));
				const playerRows = (data?.players ?? []) as any[];
				const normalizedPlayers: PlayerLite[] = playerRows.map((p: any) => ({
					id: p.id,
					name: p.name,
					avatar_url: p.avatar_url ?? p.avatarUrl ?? null,
					user_id: p.user_id ?? p.userId ?? null
				}));
				const snapshotPlayers: PlayerLite[] = [];
				for (const act of normalizedActivities) {
					if (act.player_snapshot && !normalizedPlayers.some(p => p.id === act.player_snapshot?.id)) {
						snapshotPlayers.push(act.player_snapshot);
					}
				}
				const lobbyRow = data?.lobby as any;
				setLobbyName(lobbyRow?.name || lid);
				setOwnerUserId(lobbyRow?.owner_user_id ?? lobbyRow?.ownerUserId ?? null);
				if (typeof lobbyRow?.cash_pool === "number") {
					setCurrentPot(lobbyRow.cash_pool);
					setPotInput(String(lobbyRow.cash_pool));
				}

				const comments = (data?.comments ?? []) as CommentRow[];
				const commentEvents: EventRow[] = comments.map(c => ({
					id: c.id,
					lobby_id: lid,
					actor_player_id: c.primary_player_id || null,
					actor_name: c.primary_player_id ? normalizedPlayers.find(p => p.id === c.primary_player_id)?.name ?? null : null,
					target_player_id: null,
					type: "COMMENT",
					payload: { rendered: c.rendered, commentType: c.type },
					created_at: c.created_at
				}));
				const rawEvents = ((data?.events ?? []) as EventRow[]).map(ev => {
					const evAny = ev as any;
					return {
						...ev,
						actor_snapshot: ev.actor_snapshot ?? evAny.actorSnapshot ?? null,
						target_snapshot: ev.target_snapshot ?? evAny.targetSnapshot ?? null,
						actor_name: ev.actor_name ?? ev.actor_snapshot?.name ?? null,
						target_name: ev.target_name ?? ev.target_snapshot?.name ?? null
					};
				});
				for (const ev of rawEvents) {
					if (ev.actor_snapshot && !normalizedPlayers.some(p => p.id === ev.actor_snapshot?.id)) {
						snapshotPlayers.push(ev.actor_snapshot);
					}
					if (ev.target_snapshot && !normalizedPlayers.some(p => p.id === ev.target_snapshot?.id)) {
						snapshotPlayers.push(ev.target_snapshot);
					}
				}
				const mergedPlayers = [...normalizedPlayers];
				for (const snap of snapshotPlayers) {
					if (snap && !mergedPlayers.some(p => p.id === snap.id)) mergedPlayers.push(snap);
				}
				setActivities(normalizedActivities);
				setPlayers(mergedPlayers);

				const combinedEvents = ([...rawEvents, ...commentEvents] as EventRow[]).sort(
					(a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
				);
			setHistoryEvents(combinedEvents);

			const ownerId = data?.ownerPlayerId as string | null | undefined;
			if (ownerId) {
				setOwnerPlayerId(ownerId);
			} else if (data?.ownerUserId && user?.id && data.ownerUserId === user.id) {
				const ownerPlayer = normalizedPlayers.find(p => p.user_id === user.id);
				if (ownerPlayer) setOwnerPlayerId(ownerPlayer.id);
			}

			const myPlayer = (data?.myPlayerId as string | null | undefined) ?? normalizedPlayers.find(p => p.user_id === user?.id)?.id ?? null;
			setMyPlayerId(myPlayer);
			setVotesByAct(data?.votes ?? {});
		} catch (e) {
			console.error("history reload error", e);
		}
	}, [lobbyId, user?.id, isHydrated]);

	useEffect(() => {
		(async () => {
			const { lobbyId } = await params;
			setLobbyId(lobbyId);
		})();
	}, [params]);

	useEffect(() => {
		if (!lobbyId) return;
		if (!isHydrated || !user?.id) return;
		reloadActivities(lobbyId);
	}, [lobbyId, isHydrated, user?.id, reloadActivities]);

	useEffect(() => {
		function onRefresh() {
			reloadActivities();
		}
		if (typeof window !== "undefined") window.addEventListener("gymdm:refresh-live", onRefresh as any);
		return () => {
			if (typeof window !== "undefined") window.removeEventListener("gymdm:refresh-live", onRefresh as any);
		};
	}, [reloadActivities]);

	useAutoRefresh(() => {
		reloadActivities();
	}, 30000, [reloadActivities]);

	useEffect(() => {
		if (!lobbyId) return;

		let votesChannel: any = null;
		let activitiesChannel: any = null;
		let isSubscribed = true;

		(async () => {
			const supabase = (await import("@/lib/supabaseBrowser")).getBrowserSupabase();
			if (!supabase || !isSubscribed) return;

			votesChannel = supabase
				.channel(`activity-votes-${lobbyId}-${Date.now()}`)
				.on(
					"postgres_changes",
					{
						event: "*",
						schema: "public",
						table: "activity_votes"
					},
					() => {
						if (!isSubscribed) return;
						reloadActivities();
					}
				)
				.subscribe();

			activitiesChannel = supabase
				.channel(`manual-activities-${lobbyId}-${Date.now()}`)
				.on(
					"postgres_changes",
					{
						event: "UPDATE",
						schema: "public",
						table: "manual_activities",
						filter: `lobby_id=eq.${lobbyId}`
					},
					() => {
						if (!isSubscribed) return;
						reloadActivities();
					}
				)
				.subscribe();
		})();

		return () => {
			isSubscribed = false;
			(async () => {
				const supabase = (await import("@/lib/supabaseBrowser")).getBrowserSupabase();
				if (supabase) {
					if (votesChannel) await supabase.removeChannel(votesChannel);
					if (activitiesChannel) await supabase.removeChannel(activitiesChannel);
				}
			})();
		};
	}, [lobbyId, reloadActivities]);

		function playerById(id: string) {
			return players.find(p => p.id === id);
		}

		function playerForActivity(activity: ActivityRow) {
			if (!activity.player_id) return activity.player_snapshot ?? null;
			const existing = playerById(activity.player_id);
			if (existing) return existing;
			if (activity.player_snapshot) return activity.player_snapshot;
			const fallback: PlayerLite = {
				id: activity.player_id,
				name: activity.player_name ?? "Unknown athlete",
				avatar_url: activity.player_avatar_url ?? null,
				user_id: activity.player_user_id ?? undefined
			};
			return fallback;
		}

	function canVote(a: ActivityRow) {
		if (a.decided_at) return false;
		if ((players?.length || 0) <= 2) return false;
		if (!myPlayerId || a.player_id === myPlayerId) return false;
		if (a.status === "pending") {
			if (a.vote_deadline && new Date(a.vote_deadline).getTime() < Date.now()) return false;
			return true;
		}
		if (a.status === "approved" && !a.decided_at) return true;
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
			const data = await res.json().catch(() => ({ ok: true }));
			if (choice === "remove") {
				if (data.reverted === true) toast?.push?.("Challenge cancelled. Activity reverted to approved ✅");
				else toast?.push?.("Your vote was removed.");
			} else {
				const current = votesByAct[activityId];
				const isChangingVote = current?.mine && current.mine !== choice;
				if (choice === "legit") toast?.push?.(isChangingVote ? "Changed vote to ✅ Looks good" : "Voted ✅ Looks good");
				else toast?.push?.(isChangingVote ? "Changed vote to 🚩 Challenge" : "Voted 🚩 Challenge");
			}
			setVotesByAct({});
			await reloadActivities();
			setTimeout(() => {
				setVotesByAct({});
				reloadActivities();
			}, 300);
		} catch (e) {
			console.error("Vote error", e);
			toast?.push?.(`Failed to ${choice === "remove" ? "remove vote" : "vote"}. Please try again.`);
		} finally {
			setBusy(false);
		}
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
			setVotesByAct({});
			await reloadActivities();
			setTimeout(() => {
				setVotesByAct({});
				reloadActivities();
			}, 300);
		} catch (e) {
			console.error("Override error", e);
			toast?.push?.("Failed to override. Please try again.");
		} finally {
			setBusy(false);
		}
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
		} finally {
			setBusy(false);
		}
	}

	const isOwner = ownerPlayerId && myPlayerId && ownerPlayerId === myPlayerId;

	const items = useMemo(() => {
		const arr: Array<{ kind: "post" | "event"; createdAt: string; a?: ActivityRow; e?: EventRow }> = [];
		for (const a of activities as ActivityRow[]) arr.push({ kind: "post", createdAt: (a.created_at || a.date) as string, a });
		for (const e of historyEvents as EventRow[]) arr.push({ kind: "event", createdAt: e.created_at as string, e });
		arr.sort((x, y) => new Date(y.createdAt).getTime() - new Date(x.createdAt).getTime());
		return arr;
	}, [activities, historyEvents]);

	async function resolveSignedUrl(activityId: string, publicUrl: string) {
		try {
			const supabase = (await import("@/lib/supabaseBrowser")).getBrowserSupabase();
			if (!supabase || !publicUrl) return;
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

	if (!isHydrated) {
		return (
			<div className="min-h-screen flex items-center justify-center text-muted-foreground">
				Loading...
			</div>
		);
	}
	if (!user) {
		return (
			<div className="min-h-screen flex items-center justify-center text-muted-foreground">
				Please sign in to view history.
			</div>
		);
	}

	return (
		<div className="min-h-screen">
			<div className="container mx-auto px-4 sm:px-6 lg:px-8 pb-8 space-y-6">
				<div className="scoreboard-panel p-5 sm:p-6 text-center relative overflow-hidden">
					<div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />
					<div className="relative z-10 space-y-2">
						<div className="font-display text-xl sm:text-2xl tracking-widest text-primary">
							HISTORY LOG
						</div>
						<div className="text-xs sm:text-sm text-muted-foreground">
							Manual posts and decisions • Lobby: {lobbyName || lobbyId}
						</div>
					</div>
				</div>

				{isOwner ? (
					<div className="scoreboard-panel p-4 sm:p-5">
						<div className="font-display text-sm sm:text-base tracking-widest text-primary mb-3">
							OWNER TOOLS
						</div>
						<div className="flex flex-col md:flex-row gap-3 items-start md:items-center flex-wrap">
							<div className="w-full md:w-64">
								<Select value={adjustTarget} onValueChange={setAdjustTarget}>
									<SelectTrigger className="bg-input border-border">
										<SelectValue placeholder="Select athlete" />
									</SelectTrigger>
									<SelectContent>
										{players.map((p) => (
											<SelectItem key={p.id} value={p.id}>
												{p.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className="flex gap-2 w-full md:w-auto">
								<Button variant="secondary" size="sm" className="flex-1 md:flex-none" disabled={!adjustTarget || busy} onClick={() => adjustHearts(1)}>
									+1 HEART
								</Button>
								<Button variant="secondary" size="sm" className="flex-1 md:flex-none" disabled={!adjustTarget || busy} onClick={() => adjustHearts(-1)}>
									-1 HEART
								</Button>
							</div>
							<div className="text-[11px] sm:text-xs text-muted-foreground w-full md:w-auto">
								Logged publicly in history.
							</div>
							{typeof currentPot === "number" && (
								<div className="flex items-center gap-2 w-full md:w-auto">
									<label className="text-[11px] sm:text-xs text-muted-foreground uppercase tracking-wider">
										Pot
									</label>
									<Input
										type="number"
										className="bg-input border-border w-full md:w-28 text-sm"
										value={potInput}
										onChange={(e) => setPotInput(e.target.value)}
										onBlur={async () => {
											if (!user?.id) return;
											const val = Number(potInput);
											if (!Number.isFinite(val) || val < 0) {
												toast?.push?.("Enter a non-negative number.");
												setPotInput(String(currentPot));
												return;
											}
											if (val === currentPot) return;
											setBusy(true);
											try {
												const res = await authFetch(`/api/lobby/${encodeURIComponent(lobbyId)}/pot`, {
													method: "POST",
													headers: { "Content-Type": "application/json" },
													body: JSON.stringify({ targetPot: val }),
												});
												const data = await res.json().catch(() => ({}));
												if (!res.ok) {
													toast?.push?.(data.error || "Failed to update pot");
													setPotInput(String(currentPot));
													return;
												}
												setCurrentPot(val);
												setPotInput(String(val));
												toast?.push?.("Pot updated");
												reloadActivities();
											} catch {
												toast?.push?.("Failed to update pot");
												setPotInput(String(currentPot));
											} finally {
												setBusy(false);
											}
										}}
									/>
								</div>
							)}
						</div>
					</div>
				) : null}

			<div className="flex flex-col gap-5">
				{items.map((item) => {
					if (item.kind === "event") {
						const ev = item.e as EventRow;
						return (
							<div key={`ev-${ev.id}`} className="scoreboard-panel p-4 flex items-start gap-3 sm:gap-4 relative">
								<div className="arena-badge arena-badge-primary text-[10px]">LOG</div>
								<div className="flex-1 min-w-0">
									<div className="text-[11px] sm:text-xs text-muted-foreground mb-1">
										{new Date(ev.created_at).toLocaleString()}
									</div>
									<div className="text-sm sm:text-base leading-relaxed">{renderEventLine(ev, players)}</div>
								</div>
								{isOwner && (
									<button
										className="absolute top-2 right-2 text-[12px] text-muted-foreground hover:text-destructive"
										onClick={async () => {
											try {
												const res = await authFetch(`/api/history-events/${encodeURIComponent(ev.id)}`, {
													method: "DELETE",
												});
												if (!res.ok) {
													const j = await res.json().catch(() => ({}));
													toast?.push?.(j.error || "Failed to delete");
													return;
												}
												setHistoryEvents((prev) => prev.filter((e) => e.id !== ev.id));
											} catch {
												toast?.push?.("Failed to delete");
											}
										}}
										title="Remove"
									>
										✕
									</button>
								)}
							</div>
						);
					}

					const a = item.a as ActivityRow;
					const p = playerForActivity(a);
					const v = votesByAct[a.id] || { legit: 0, sus: 0 };
					const pending = a.status === "pending";
					const statusMap: Record<string, { label: string; className: string }> = {
						approved: {
							label: "APPROVED",
							className: "bg-[hsl(var(--status-online))]/20 text-[hsl(var(--status-online))] border-[hsl(var(--status-online))]/40",
						},
						pending: {
							label: "PENDING",
							className: "bg-primary/20 text-primary border-primary/40",
						},
						rejected: {
							label: "REJECTED",
							className: "bg-destructive/20 text-destructive border-destructive/40",
						},
					};
					const statusInfo = statusMap[a.status] || statusMap.pending;
					const resolvedPhotoUrl = signedUrlByAct[a.id] || a.photo_url || null;

					return (
						<div key={a.id} className="scoreboard-panel overflow-hidden">
							<div className="p-4 border-b border-border flex items-center gap-3">
								<div className="h-10 w-10 border-2 border-border bg-muted flex items-center justify-center overflow-hidden">
									{p?.avatar_url ? (
										<img src={p.avatar_url} alt={p?.name || "athlete"} className="h-full w-full object-cover" />
									) : (
										<span className="font-display text-sm text-primary">
											{getInitials(p?.name)}
										</span>
									)}
								</div>
								<div className="flex-1 min-w-0">
									<div className="font-display text-sm sm:text-base tracking-wider text-primary truncate">
										{(p?.name || "Unknown athlete").toUpperCase()}
									</div>
									<div className="text-[11px] text-muted-foreground">
										{new Date(a.date).toLocaleString()}
									</div>
								</div>
								<div className={`px-2 py-1 text-[10px] font-display tracking-wider border ${statusInfo.className}`}>
									{statusInfo.label}
								</div>
							</div>

							<div className="p-4 space-y-3">
								{a.caption ? <div className="text-sm">{a.caption}</div> : null}
								{a.notes ? <div className="text-sm text-muted-foreground whitespace-pre-wrap">{a.notes}</div> : null}
							</div>

							{resolvedPhotoUrl ? (
								<button
									type="button"
									aria-label="Open full-size photo"
									className="relative w-full h-52 sm:h-56 md:h-64 overflow-hidden border-y border-border bg-muted/20 group"
									onClick={() => setLightboxUrl(resolvedPhotoUrl)}
								>
									<img
										src={resolvedPhotoUrl}
										alt=""
										className="absolute inset-0 w-full h-full object-cover"
										loading="lazy"
										onError={() => resolveSignedUrl(a.id, a.photo_url || "")}
									/>
									<div className="absolute bottom-2 right-2 text-[10px] px-2 py-1 arena-badge arena-badge-primary opacity-90 group-hover:opacity-100 transition">
										TAP TO EXPAND
									</div>
								</button>
							) : null}

							<div className="p-4 border-t border-border text-xs sm:text-sm">
								<div className="flex flex-wrap items-center gap-1.5">
									<span className="arena-badge text-[10px]">{titleCase(a.type)}</span>
									{a.duration_minutes && <span>{a.duration_minutes} min</span>}
									{a.duration_minutes && a.distance_km && <span>·</span>}
									{a.distance_km && <span>{a.distance_km} km</span>}
								</div>
							</div>

							<div className="p-4 border-t border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs sm:text-sm">
								<div className="flex flex-wrap items-center gap-1.5 text-muted-foreground">
									{a.status === "approved" && (
										<>
											<span className="font-display">Approved:</span>
											<span>{v.legit} legit</span>
											{v.sus > 0 && <span>· {v.sus} sus</span>}
										</>
									)}
									{a.status === "rejected" && (
										<>
											<span className="font-display">Rejected:</span>
											<span>{v.sus} sus</span>
											{v.legit > 0 && <span>· {v.legit} legit</span>}
										</>
									)}
									{pending && (
										<>
											<span className="font-display">Pending vote:</span>
											<span>{v.legit} legit</span>
											<span>· {v.sus} sus</span>
											{a.vote_deadline && <span>· {timeLeft(a)} left</span>}
										</>
									)}
								</div>
								{canVote(a) && !a.decided_at ? (
									<div className="flex gap-2 flex-wrap">
										{a.status === "approved" && !v.mine ? (
											<Button
												variant="outline"
												size="sm"
												disabled={busy}
												onClick={() => vote(a.id, "sus")}
												className="h-9"
											>
												Feels sus
											</Button>
										) : (
											<>
												<Button
													variant={v.mine === "legit" ? "arenaPrimary" : "outline"}
													size="sm"
													disabled={busy}
													onClick={() => vote(a.id, "legit")}
													className="h-9"
												>
													Count it
												</Button>
												<Button
													variant={v.mine === "sus" ? "arenaPrimary" : "outline"}
													size="sm"
													disabled={busy}
													onClick={() => vote(a.id, "sus")}
													className="h-9"
												>
													Feels sus
												</Button>
											</>
										)}
										{v.mine && a.status === "pending" && (
											<Button
												variant="ghost"
												size="sm"
												disabled={busy}
												onClick={() => vote(a.id, "remove")}
												className="h-9"
											>
												Remove vote
											</Button>
										)}
									</div>
								) : a.decided_at ? (
									<div className="text-[11px] text-muted-foreground italic">Voting closed</div>
								) : a.player_id === myPlayerId ? (
									<div className="text-[11px] text-muted-foreground italic">You can't vote on your own activity</div>
								) : !myPlayerId ? (
									<div className="text-[11px] text-muted-foreground italic">Sign in to vote</div>
								) : (players?.length || 0) <= 2 ? (
									<div className="text-[11px] text-muted-foreground italic">Voting requires 3+ players</div>
								) : null}
							</div>

							{isOwner ? (
								<div className="p-4 border-t border-border">
									<div className="text-[11px] uppercase tracking-widest text-primary mb-2">
										Owner override
									</div>
									<div className="flex gap-2">
										<Button
											variant="secondary"
											size="sm"
											disabled={busy}
											onClick={() => overrideActivity(a.id, "approved")}
											className="flex-1"
										>
											APPROVE
										</Button>
										<Button
											variant="destructive"
											size="sm"
											disabled={busy}
											onClick={() => overrideActivity(a.id, "rejected")}
											className="flex-1"
										>
											REJECT
										</Button>
									</div>
								</div>
							) : null}

							<div className="p-4 border-t border-border">
								<ActivityComments
									activityId={a.id}
									lobbyId={lobbyId}
									myPlayerId={myPlayerId}
									ownerUserId={ownerUserId}
								/>
							</div>
						</div>
					);
				})}
				{items.length === 0 && <div className="text-muted-foreground text-sm">No posts yet.</div>}
			</div>

			{lightboxUrl && (
				<PhotoLightbox open={Boolean(lightboxUrl)} onClose={() => setLightboxUrl(null)} imageUrl={lightboxUrl} />
			)}
		</div>
	</div>
	);
}

type PostComment = {
	id: string;
	lobbyId: string;
	activityId: string;
	parentId: string | null;
	threadRootId: string | null;
	body: string;
	createdAt: string;
	authorPlayerId: string;
	authorName: string | null;
	authorAvatarUrl?: string | null;
};

function ActivityComments({ activityId, lobbyId, myPlayerId, ownerUserId }: { activityId: string; lobbyId: string; myPlayerId: string | null; ownerUserId: string | null }) {
	const { user } = useAuth();
	const toast = useToast();
	const [comments, setComments] = useState<PostComment[]>([]);
	const [loading, setLoading] = useState(false);
	const [newBody, setNewBody] = useState("");
	const [replyOpen, setReplyOpen] = useState<Record<string, boolean>>({});
	const [replyText, setReplyText] = useState<Record<string, string>>({});
	const [submittingId, setSubmittingId] = useState<string | null>(null);

	const loadComments = useCallback(async () => {
		if (!user?.id) return;
		setLoading(true);
		try {
			const res = await authFetch(`/api/activity/${encodeURIComponent(activityId)}/comments`, {
				cache: "no-store"
			});
			if (!res.ok) throw new Error("Failed");
			const j = await res.json();
			setComments(j.comments ?? []);
		} catch {
			toast?.push?.("Unable to load comments right now.");
		} finally {
			setLoading(false);
		}
	}, [activityId, user?.id, toast]);

	useEffect(() => {
		loadComments();
	}, [loadComments]);

	async function submit(body: string, parentId: string | null) {
		if (!user?.id) {
			toast?.push?.("Sign in to comment.");
			return;
		}
		const trimmed = body.trim();
		if (!trimmed) return;
		setSubmittingId(parentId || "root");
		try {
			const res = await authFetch(`/api/activity/${encodeURIComponent(activityId)}/comments`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ body: trimmed, parentId })
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) {
				toast?.push?.(data.error || "Failed to post comment.");
				return;
			}
			if (parentId) {
				setReplyText(prev => ({ ...prev, [parentId]: "" }));
				setReplyOpen(prev => ({ ...prev, [parentId]: false }));
			} else {
				setNewBody("");
			}
			if (data.comment) {
				setComments(prev => [...prev, data.comment as PostComment]);
			} else {
				loadComments();
			}
		} catch {
			toast?.push?.("Failed to post comment.");
		} finally {
			setSubmittingId(null);
		}
	}

	async function remove(commentId: string) {
		if (!user?.id) {
			toast?.push?.("Sign in to delete comments.");
			return;
		}
		try {
			const res = await authFetch(`/api/comments/${encodeURIComponent(commentId)}`, {
				method: "DELETE",
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) {
				toast?.push?.(data.error || "Failed to delete");
				return;
			}
			setComments(prev => prev.filter(c => c.id !== commentId));
		} catch {
			toast?.push?.("Failed to delete");
		}
	}

	const topLevel = comments.filter(c => !c.parentId);
	const repliesByParent = comments.reduce<Record<string, PostComment[]>>((acc, c) => {
		if (c.parentId) {
			if (!acc[c.parentId]) acc[c.parentId] = [];
			acc[c.parentId].push(c);
		}
		return acc;
	}, {});

const canComment = Boolean(user?.id && myPlayerId);

	const renderComment = (c: PostComment, level: number) => {
		const children = repliesByParent[c.id] || [];
		const canDelete = (myPlayerId && c.authorPlayerId === myPlayerId) || (ownerUserId && ownerUserId === user?.id);
		const leftPad = Math.min(level * 12, 48);
		return (
			<div key={c.id} className={`space-y-2 ${level > 0 ? "border-l border-border pl-3" : ""}`} style={{ marginLeft: leftPad ? `${leftPad}px` : undefined }}>
				<div className="flex gap-2">
					<div className="h-8 w-8 overflow-hidden bg-muted border border-border flex items-center justify-center">
						{c.authorAvatarUrl ? <img src={c.authorAvatarUrl} alt={c.authorName ?? "author"} className="h-full w-full object-cover" /> : <span className="text-[10px]">💬</span>}
					</div>
					<div className="flex-1 min-w-0">
						<div className="flex items-center gap-2 text-[12px] text-muted-foreground">
							<span className="font-display text-primary">{c.authorName || "Athlete"}</span>
							<span className="text-muted-foreground">{new Date(c.createdAt).toLocaleString()}</span>
						</div>
						<div className="text-sm text-foreground whitespace-pre-wrap">{c.body}</div>
						<div className="flex items-center gap-3 mt-1 text-[12px] text-muted-foreground">
							{canComment && (
								<button
									className="hover:text-foreground"
									onClick={() => setReplyOpen(prev => ({ ...prev, [c.id]: !prev[c.id] }))}
								>
									Reply
								</button>
							)}
							{canDelete && (
								<button className="hover:text-destructive" onClick={() => remove(c.id)}>
									Delete
								</button>
							)}
						</div>
						{replyOpen[c.id] && canComment && (
							<div className="mt-2 space-y-1">
								<Textarea
									className="bg-input border-border text-sm"
									rows={2}
									value={replyText[c.id] ?? ""}
									maxLength={500}
									placeholder="Write a reply..."
									onChange={e => setReplyText(prev => ({ ...prev, [c.id]: e.target.value }))}
								/>
								<div className="flex gap-2">
									<Button
										variant="secondary"
										size="sm"
										disabled={submittingId !== null}
										onClick={() => submit(replyText[c.id] ?? "", c.id)}
									>
										{submittingId ? "Posting..." : "Reply"}
									</Button>
									<Button variant="secondary" size="sm" onClick={() => setReplyOpen(prev => ({ ...prev, [c.id]: false }))}>
										Cancel
									</Button>
								</div>
							</div>
						)}
					</div>
				</div>
				{children.length > 0 && (
					<div className="space-y-2">
						{children.map(child => renderComment(child, level + 1))}
					</div>
				)}
			</div>
		);
	};

	return (
		<div className="space-y-3">
			<div className="text-[11px] uppercase font-display tracking-widest text-muted-foreground">
				Comments {comments.length ? `(${comments.length})` : ""}
			</div>
			{!canComment && <div className="text-[12px] text-muted-foreground">Sign in and join this lobby to comment.</div>}

			{topLevel.length === 0 && loading && <div className="text-[12px] text-muted-foreground">Loading comments…</div>}
			{topLevel.length === 0 && !loading && canComment && (
				<div className="text-[12px] text-muted-foreground">No comments yet — be the first.</div>
			)}

			{topLevel.map(c => renderComment(c, 0))}

			{canComment && (
				<div className="space-y-2">
					<Textarea
						className="bg-input border-border text-sm"
						rows={3}
						value={newBody}
						maxLength={500}
						placeholder="Add a comment..."
						onChange={e => setNewBody(e.target.value)}
					/>
					<div className="flex justify-end">
						<Button variant="secondary" size="sm" disabled={submittingId !== null} onClick={() => submit(newBody, null)}>
							{submittingId ? "Posting..." : "Post comment"}
						</Button>
					</div>
				</div>
			)}
		</div>
	);
}

function titleCase(s: string) {
	return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function getInitials(name?: string | null) {
	if (!name) return "AA";
	const parts = name.trim().split(/\s+/).filter(Boolean);
	if (parts.length === 0) return "AA";
	if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
	return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function renderEventLine(ev: EventRow, players: PlayerLite[]) {
	const actor =
		ev.actor_player_id
			? players.find(p => p.id === ev.actor_player_id)?.name || ev.actor_snapshot?.name || ev.actor_name || "Unknown athlete"
			: ev.actor_snapshot?.name || ev.actor_name || "System";
	const target =
		ev.target_player_id
			? players.find(p => p.id === ev.target_player_id)?.name || ev.target_snapshot?.name || ev.target_name || "Unknown athlete"
			: ev.target_snapshot?.name || ev.target_name || "";
	if (ev.type === "ACTIVITY_LOGGED") return `${actor} posted a workout`;
	if (ev.type === "VOTE_RESULT") {
		const result = ev.payload?.result || "decision";
		return `Vote result: ${result.replace(/_/g, " ")} (${ev.payload?.legit ?? 0} legit · ${ev.payload?.sus ?? 0} sus)`;
	}
	if (ev.type === "WEEKLY_TARGET_MET") {
		const wk = ev.payload?.weeklyTarget ?? "target";
		const cnt = ev.payload?.workouts ?? "?";
		const name = ev.target_name || players.find(p => p.id === ev.target_player_id)?.name || "Athlete";
		return `${name} met weekly target: ${cnt}/${wk}`;
	}
	if (ev.type === "WEEKLY_TARGET_MISSED") {
		const wk = ev.payload?.weeklyTarget ?? "target";
		const cnt = ev.payload?.workouts ?? "?";
		const name = ev.target_name || players.find(p => p.id === ev.target_player_id)?.name || "Athlete";
		return `${name} missed weekly target: ${cnt}/${wk}`;
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
		return ev.payload?.rendered || "Comment";
	}
	return `${actor || "System"}: ${ev.type}`;
}
