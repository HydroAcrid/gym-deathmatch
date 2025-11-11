"use client";
import { useEffect, useState } from "react";
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

	useEffect(() => {
		(async () => {
			const { lobbyId } = await params;
			setLobbyId(lobbyId);
			const supabase = (await import("@/lib/supabaseBrowser")).getBrowserSupabase();
			if (!supabase) return;
			const [{ data: prows }, { data: lrow }] = await Promise.all([
				supabase.from("player").select("*").eq("lobby_id", lobbyId),
				supabase.from("lobby").select("*").eq("id", lobbyId).maybeSingle()
			]);
			setPlayers((prows ?? []) as any);
			setOwnerPlayerId((lrow as any)?.owner_id ?? null);
			if (user?.id) {
				const mine = (prows ?? []).find((p: any) => p.user_id === user.id);
				setMyPlayerId(mine?.id ?? null);
			}
			await reloadActivities(lobbyId);
		})();
	}, [params, user?.id]);

	async function reloadActivities(lid: string = lobbyId) {
		const supabase = (await import("@/lib/supabaseBrowser")).getBrowserSupabase();
		if (!supabase || !lid) return;
		const { data: acts } = await supabase
			.from("manual_activities")
			.select("*")
			.eq("lobby_id", lid)
			.order("created_at", { ascending: false })
			.limit(50);
		setActivities((acts ?? []) as any);
		// history events
		const { data: evs } = await supabase.from("history_events").select("*").eq("lobby_id", lid).order("created_at", { ascending: false }).limit(50);
		setHistoryEvents((evs ?? []) as any);
		const ids = (acts ?? []).map((a: any) => a.id);
		if (!ids.length) { setVotesByAct({}); return; }
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
	}

	function playerById(id: string) { return players.find(p => p.id === id); }
	function canVote(a: ActivityRow) {
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

	// Merge posts and system events into a single feed
	const combined = [...(activities as any[]).map(a => ({ kind: "post" as const, createdAt: a.created_at || a.date, a })), ...(historyEvents as any[]).map(e => ({ kind: "event" as const, createdAt: e.created_at, e }))].sort((x, y) => new Date(y.createdAt).getTime() - new Date(x.createdAt).getTime());

	return (
		<div className="mx-auto max-w-6xl">
			<div className="paper-card paper-grain ink-edge p-5 mb-6 border-b-4" style={{ borderColor: "#E1542A" }}>
				<div className="poster-headline text-lg">HISTORY</div>
				<div className="text-deepBrown/70 text-xs">Manual posts and decisions • Lobby: {lobbyId}</div>
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

			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				{combined.map(item => {
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
								<div className="h-10 w-10 rounded-md overflow-hidden bg-tan border border-deepBrown/20">
									{p?.avatar_url ? <img src={p.avatar_url} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full flex items-center justify-center text-xl">🏋️</div>}
								</div>
								<div className="flex-1">
									<div className="poster-headline text-base leading-5">{p?.name?.toUpperCase() || "ATHLETE"}</div>
									<div className="text-[11px] text-deepBrown/70">{new Date(a.date).toLocaleString()}</div>
								</div>
								<StatusBadge status={a.status as any} />
							</div>
							{a.photo_url ? (
								<div className="rounded-md overflow-hidden border border-deepBrown/20 cursor-zoom-in" onClick={() => setLightboxUrl(a.photo_url || null)}>
									<img src={a.photo_url} alt="" className="w-full object-cover max-h-[280px]" />
								</div>
							) : null}
							{a.caption ? <div className="text-sm">{a.caption}</div> : null}
							<div className="text-[12px] text-deepBrown/80">
								<strong className="mr-2">{titleCase(a.type)}</strong>
								{a.duration_minutes ? `${a.duration_minutes} min` : ""}{a.duration_minutes && a.distance_km ? " · " : ""}{a.distance_km ? `${a.distance_km} km` : ""}
							</div>
							<div className="flex items-center justify-between text-[12px]">
								<div>{v.legit} legit · {v.sus} sus {pending && a.vote_deadline ? `· ${timeLeft(a)} left` : ""}</div>
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
						</div>
					);
				})}
				{combined.length === 0 && <div className="text-deepBrown/70 text-sm">No posts yet.</div>}
			</div>
			<Lightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
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
	const actor = ev.actor_player_id ? players.find(p => p.id === ev.actor_player_id)?.name : "System";
	const target = ev.target_player_id ? players.find(p => p.id === ev.target_player_id)?.name : "";
	if (ev.type === "ACTIVITY_LOGGED") {
		return `${actor} logged an activity`;
	}
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
