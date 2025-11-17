"use client";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";

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

	async function reloadActivities(lid: string = lobbyId) {
		if (!lid) return;
		// Prefer server API (validates membership with service key) to avoid client RLS pitfalls
		const me = user?.id || "";
		const res = await fetch(`/api/lobby/${encodeURIComponent(lid)}/history`, {
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
			if (user?.id) {
				const mine = (prows ?? []).find((p: any) => (p as any).user_id === user.id);
				setMyPlayerId(mine?.id ?? null);
			}
			// owner: we don't return owner_user_id here; leave owner tools unchanged (we keep previous logic)
			// fetch votes client-side for convenience
			const supabase = (await import("@/lib/supabaseBrowser")).getBrowserSupabase();
			if (supabase && acts.length) {
				const ids = acts.map((a: any) => a.id);
				const { data: allVotes } = await supabase.from("activity_votes").select("*").in("activity_id", ids);
				const map: Record<string, { legit: number; sus: number; mine?: "legit" | "sus" }> = {};
				for (const id of ids) map[id] = { legit: 0, sus: 0 };
				for (const v of (allVotes ?? [])) {
					if (!map[v.activity_id]) map[v.activity_id] = { legit: 0, sus: 0 };
					if (v.choice === "legit") map[v.activity_id].legit++;
					if (v.choice === "sus") map[v.activity_id].sus++;
					if (v.voter_player_id === myPlayerId) map[v.activity_id].mine = v.choice;
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
		// Disable voting for very small lobbies (<=2 players)
		if ((players?.length || 0) <= 2) return false;
		if (!myPlayerId || a.player_id === myPlayerId) return false;
		if (a.status !== "pending") return false;
		if (a.vote_deadline && new Date(a.vote_deadline).getTime() < Date.now()) return false;
		return true;
	}
	function timeLeft(a: ActivityRow) {
		if (!a.vote_deadline) return "";
		const ms = new Date(a.vote_deadline).getTime() - Date.now();
		if (ms <= 0) return "0h";
		const h = Math.floor(ms / 3600000);
		const m = Math.floor((ms % 3600000) / 60000);
		return `${h}h ${m}m`;
	}

	async function vote(activityId: string, choice: "legit" | "sus") {
		if (!myPlayerId) return;
		setBusy(true);
		try {
			await fetch(`/api/activities/${encodeURIComponent(activityId)}/vote`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ voterPlayerId: myPlayerId, choice })
			});
			await reloadActivities();
		} finally { setBusy(false); }
	}

	async function overrideActivity(activityId: string, newStatus: "approved" | "rejected") {
		if (!ownerPlayerId) return;
		setBusy(true);
		try {
			await fetch(`/api/activities/${encodeURIComponent(activityId)}/override`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ ownerPlayerId, newStatus })
			});
			await reloadActivities();
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
		<div className="mx-auto max-w-4xl">
			<div className="paper-card paper-grain ink-edge p-5 mb-6 border-b-4" style={{ borderColor: "#E1542A" }}>
				<div className="poster-headline text-lg">HISTORY</div>
				<div className="text-deepBrown/70 text-xs">Manual posts and decisions • Lobby: {lobbyName || lobbyId}</div>
			</div>

			{isOwner ? (
				<div className="paper-card paper-grain ink-edge p-4 mb-6">
					<div className="poster-headline text-base mb-2">Owner tools</div>
					<div className="flex flex-col sm:flex-row gap-2 items-start">
						<select value={adjustTarget} onChange={e => setAdjustTarget(e.target.value)} className="px-2 py-2 rounded-md border border-deepBrown/40 bg-cream">
							<option value="">Select athlete</option>
							{players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
						</select>
						<div className="flex gap-2">
							<button className="btn-secondary px-3 py-2 rounded-md" disabled={!adjustTarget || busy} onClick={() => adjustHearts(1)}>+1 heart</button>
							<button className="px-3 py-2 rounded-md border border-deepBrown/30" disabled={!adjustTarget || busy} onClick={() => adjustHearts(-1)}>-1 heart</button>
						</div>
						<div className="text-[11px] text-deepBrown/70">Logged publicly in history.</div>
					</div>
				</div>
			) : null}

			<div className="flex flex-col gap-4">
				{items.map(item => {
					if (item.kind === "event") {
						const ev = item.e as EventRow;
						return (
							<div key={`ev-${ev.id}`} className="paper-card paper-grain ink-edge p-4 flex items-start gap-3">
								<div className="text-lg">📜</div>
								<div className="flex-1">
									<div className="text-[11px] text-deepBrown/70">{new Date(ev.created_at).toLocaleString()}</div>
									<div className="text-sm">{renderEventLine(ev, players)}</div>
								</div>
							</div>
						);
					}
					const a = item.a as ActivityRow;
					const p = playerById(a.player_id);
					const v = votesByAct[a.id] || { legit: 0, sus: 0 };
					const pending = a.status === "pending";
					return (
						<div key={a.id} className="paper-card paper-grain ink-edge p-4 flex flex-col gap-3">
							<div className="flex items-center gap-3">
								<div className="h-10 w-10 rounded-full overflow-hidden bg-tan border border-deepBrown/20 flex items-center justify-center">
									{p?.avatar_url ? <img src={p.avatar_url} alt={p?.name || "athlete"} className="h-full w-full object-cover" /> : <span className="text-xl">🏋️‍♂️</span>}
								</div>
								<div className="flex-1">
									<div className="poster-headline text-base leading-5">{(p?.name || "Unknown athlete").toUpperCase()}</div>
									<div className="text-[11px] text-deepBrown/70">{new Date(a.date).toLocaleString()}</div>
								</div>
								<StatusBadge status={a.status as any} />
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
							<div className="text-[12px] text-deepBrown/80 border-t border-deepBrown/10 pt-2 flex items-center justify-between">
								<div>
									<strong className="mr-2">{titleCase(a.type)}</strong>
									{a.duration_minutes ? `${a.duration_minutes} min` : ""}{a.duration_minutes && a.distance_km ? " · " : ""}{a.distance_km ? `${a.distance_km} km` : ""}
								</div>
							</div>
							<div className="flex items-center justify-between text-[12px]">
								<div>{pending ? "Pending vote · " : a.status === "approved" ? "Approved · " : "Rejected · "}{v.legit} legit · {v.sus} sus {pending && a.vote_deadline ? `· ${timeLeft(a)} left` : ""}</div>
								{pending && canVote(a) ? (
									<div className="flex gap-2">
										<button className={`px-3 py-1.5 rounded-md text-xs ${v.mine === "legit" ? "btn-vintage" : "border border-deepBrown/30"}`} disabled={busy} onClick={() => vote(a.id, "legit")}>
											Count it ✅
										</button>
										<button className={`px-3 py-1.5 rounded-md text-xs ${v.mine === "sus" ? "btn-vintage" : "border border-deepBrown/30"}`} disabled={busy} onClick={() => vote(a.id, "sus")}>
											Feels sus 🚩
										</button>
									</div>
								) : null}
							</div>
							{isOwner && pending ? (
								<div className="flex items-center gap-2 pt-1">
									<span className="text-[11px] text-deepBrown/70">Owner override:</span>
									<button className="px-3 py-1.5 rounded-md border border-deepBrown/30 text-xs" disabled={busy} onClick={() => overrideActivity(a.id, "approved")}>Approve</button>
									<button className="px-3 py-1.5 rounded-md border border-deepBrown/30 text-xs" disabled={busy} onClick={() => overrideActivity(a.id, "rejected")}>Reject</button>
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

function StatusBadge({ status }: { status: "pending" | "approved" | "rejected" }) {
	if (status === "approved") return <span className="px-2 py-1 rounded-md text-[10px] bg-[#2b6b2b] text-cream">Approved ✅</span>;
	if (status === "rejected") return <span className="px-2 py-1 rounded-md text-[10px] bg-[#6b2b2b] text-cream">Rejected 🚫</span>;
	return <span className="px-2 py-1 rounded-md text-[10px] border border-deepBrown/30">Pending vote</span>;
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
