"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Lobby, Player } from "@/types/game";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Countdown } from "./Countdown";
import { CountdownHero } from "./CountdownHero";
import { useAuth } from "./AuthProvider";
import { OwnerSettingsModal } from "./OwnerSettingsModal";
import { StatusBadge } from "./StatusBadge";

export function PreStageView({ lobby }: { lobby: Lobby }) {
	const router = useRouter();
	const [me, setMe] = useState<string | null>(null);
	const { user } = useAuth();
	const [ownerUserId, setOwnerUserId] = useState<string | null>(null);
	const [editOpen, setEditOpen] = useState(false);
	const [profileName, setProfileName] = useState<string>("");
	const [profileAvatar, setProfileAvatar] = useState<string>("");
	const [profileLocation, setProfileLocation] = useState<string>("");
	const [profileQuip, setProfileQuip] = useState<string>("");
	const [players, setPlayers] = useState(lobby.players);
	useEffect(() => {
		if (typeof window !== "undefined") {
			setMe(localStorage.getItem("gymdm_playerId"));
		}
	}, []);
	const isOwner = useMemo(() => {
		// Prefer owner_user_id when present
		if (user?.id && lobby.ownerUserId) return user.id === lobby.ownerUserId;
		// Fallback: auth user matches owner player's user_id, or legacy playerId check
		if (user?.id && ownerUserId) return user.id === ownerUserId;
		return !!(lobby.ownerId && me && lobby.ownerId === me);
	}, [lobby.ownerId, lobby.ownerUserId, me, user?.id, ownerUserId]);

	// Fetch owner's user_id for robust checks
	useEffect(() => {
		(async () => {
			try {
				const supabase = (await import("@/lib/supabaseBrowser")).getBrowserSupabase();
				if (!supabase || !lobby.ownerId) return;
				const { data } = await supabase.from("player").select("user_id").eq("id", lobby.ownerId).maybeSingle();
				if (data?.user_id) setOwnerUserId(data.user_id as string);
			} catch {
				// ignore
			}
		})();
	}, [lobby.ownerId]);

	function isoToLocalInput(iso?: string | null) {
		if (!iso) return "";
		const d = new Date(iso);
		const pad = (n: number) => String(n).padStart(2, "0");
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
	}
	const [scheduleAt, setScheduleAt] = useState<string>(isoToLocalInput(lobby.scheduledStart ?? ""));
	const [lobbyStatus, setLobbyStatus] = useState<string | undefined>(lobby.status);
	const [scheduledStart, setScheduledStart] = useState<string | null | undefined>(lobby.scheduledStart);
	
	const reloadLobby = async () => {
		try {
			const res = await fetch(`/api/lobby/${encodeURIComponent(lobby.id)}/live`, { cache: "no-store" });
			if (!res.ok) return;
			const data = await res.json();
			if (data?.lobby) {
				setPlayers(data.lobby.players || []);
				if (data.seasonStatus) setLobbyStatus(data.seasonStatus);
			}
		} catch { /* ignore */ }
	};

	const schedule = async () => {
		await fetch(`/api/lobby/${encodeURIComponent(lobby.id)}/stage`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				status: "scheduled",
				scheduledStart: scheduleAt ? new Date(scheduleAt).toISOString() : null
			})
		});
		setLobbyStatus("scheduled");
		setScheduledStart(scheduleAt ? new Date(scheduleAt).toISOString() : null);
		await reloadLobby();
	};
	const startNow = async () => {
		await fetch(`/api/lobby/${encodeURIComponent(lobby.id)}/stage`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ startNow: true })
		});
		// Status will change to active, which will cause LobbySwitcher to show LobbyLayout
		setTimeout(() => router.refresh(), 500);
	};
	const cancelSchedule = async () => {
		await fetch(`/api/lobby/${encodeURIComponent(lobby.id)}/stage`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ status: "pending", scheduledStart: null })
		});
		setLobbyStatus("pending");
		setScheduledStart(null);
		await reloadLobby();
	};

	// Load profile basics for quick-join
	useEffect(() => {
		(async () => {
			try {
				if (!user?.id) return;
				const res = await fetch(`/api/user/profile?userId=${encodeURIComponent(user.id)}`, { cache: "no-store" });
				if (!res.ok) return;
				const j = await res.json();
				if (j?.name) setProfileName(j.name);
				if (j?.avatarUrl) setProfileAvatar(j.avatarUrl);
				if (j?.location) setProfileLocation(j.location);
				if (j?.quip) setProfileQuip(j.quip);
			} catch { /* ignore */ }
		})();
	}, [user?.id]);

	const iHaveAPlayer = useMemo(() => {
		if (!profileName) return players.length > 0; // conservative
		return players.some(p => (p.name || "").toLowerCase() === profileName.toLowerCase());
	}, [players, profileName]);

	async function addMeToLobby() {
		if (!user?.id) return;
		// derive a stable-ish player id slug
		const emailName = (user.email || "").split("@")[0];
		const base = (profileName || emailName || user.id).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
		const id = base || user.id;
		await fetch(`/api/lobby/${encodeURIComponent(lobby.id)}/invite`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				id,
				name: profileName || emailName || "Me",
				avatarUrl: profileAvatar || null,
				location: profileLocation || null,
				quip: profileQuip || null,
				userId: user.id
			})
		});
		localStorage.setItem("gymdm_playerId", id);
		router.refresh();
	}

	// Sync current user's player data from profile when component loads or players change
	const syncedRef = useRef<string | null>(null);
	useEffect(() => {
		(async () => {
			if (!user?.id || !players.length) return;
			// Find current user's player in this lobby
			const myPlayer = players.find(p => (p as any).userId === user.id);
			if (myPlayer && syncedRef.current !== myPlayer.id) {
				syncedRef.current = myPlayer.id;
				// Sync this player's data from user_profile and refresh
				try {
					await fetch("/api/user/sync", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							userId: user.id,
							playerId: myPlayer.id,
							overwriteAll: true // Always sync from profile to ensure quip/location are current
						})
					});
					// Refresh players list to show updated data
					await reloadLobby();
				} catch { /* ignore */ }
			}
		})();
	}, [user?.id, players.length]); // Sync when user or player count changes

	// Load live statuses (Strava connected, etc.) and poll for updates
	useEffect(() => {
		let cancelled = false;
		async function refresh() {
			if (cancelled || document.hidden) return;
			try {
				const res = await fetch(`/api/lobby/${encodeURIComponent(lobby.id)}/live`, { cache: "no-store" });
				if (!res.ok) return;
				const data = await res.json();
				if (!cancelled && data?.lobby?.players) {
					setPlayers(data.lobby.players || []);
					if (data.seasonStatus) setLobbyStatus(data.seasonStatus);
					if (data?.lobby?.scheduledStart !== undefined) setScheduledStart(data.lobby.scheduledStart);
				}
			} catch { /* ignore */ }
		}
		refresh();
		const id = setInterval(refresh, 10 * 1000); // Poll every 10 seconds
		const handleVisibilityChange = () => {
			if (!document.hidden) refresh();
		};
		document.addEventListener("visibilitychange", handleVisibilityChange);
		return () => {
			cancelled = true;
			clearInterval(id);
			document.removeEventListener("visibilitychange", handleVisibilityChange);
		};
	}, [lobby.id]);

	return (
		<div className="mx-auto max-w-6xl">
			<motion.div className="paper-card paper-grain ink-edge px-4 py-3 border-b-4 mb-3 flex items-center justify-between" style={{ borderColor: "#E1542A" }}
				initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
				<div className="flex items-center gap-3">
					<div className="poster-headline text-xl">DEATHMATCH STAGE · SEASON {lobby.seasonNumber} – {lobby.name.toUpperCase()}</div>
				</div>
				{isOwner && (
					<div className="flex items-center gap-2">
						<button
							aria-label="Share lobby"
							className="p-1 text-xs text-main dark:text-cream"
							onClick={async () => {
								const shareUrl = `${window.location.origin}/onboard/${lobby.id}`;
								const ownerName = lobby.players.find(p => p.id === lobby.ownerId)?.name || "Your friend";
								const text = `${ownerName} is inviting you to the Deathmatch — ${lobby.name}. Join now:`;
								try {
									if (navigator.share) {
										await navigator.share({ title: "Gym Deathmatch", text, url: shareUrl });
										return;
									}
								} catch { /* ignore */ }
								await navigator.clipboard?.writeText(shareUrl);
								alert("Invite link copied");
							}}
						>
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
								<path d="M10 13a5 5 0 0 0 7.07 0l3.54-3.54a5 5 0 0 0-7.07-7.07L11 4" />
								<path d="M14 11a5 5 0 0 0-7.07 0L3.39 14.54a5 5 0 1 0 7.07 7.07L13 20" />
							</svg>
						</button>
						<button className="px-3 py-1.5 rounded-md border border-deepBrown/30 text-xs hover:bg-cream/10"
							onClick={() => setEditOpen(true)}>
							Edit
						</button>
					</div>
				)}
			</motion.div>
			{isOwner && (
				<OwnerSettingsModal
					open={editOpen}
					onClose={() => setEditOpen(false)}
					lobbyId={lobby.id}
					defaultWeekly={lobby.weeklyTarget ?? 3}
					defaultLives={lobby.initialLives ?? 3}
					defaultSeasonEnd={lobby.seasonEnd}
					onSaved={() => { setEditOpen(false); reloadLobby(); }}
					hideTrigger
				/>
			)}

			{/* Hero Countdown */}
			<div className="mb-6">
				{lobbyStatus === "scheduled" && scheduledStart ? (
					<CountdownHero
						lobbyId={lobby.id}
						targetIso={scheduledStart || undefined}
						seasonLabel={`SEASON ${lobby.seasonNumber} – ${lobby.name.toUpperCase()}`}
						hostName={players.find(p => p.id === lobby.ownerId)?.name}
						numAthletes={players.length}
					/>
				) : (
					<div className="paper-card paper-grain ink-edge p-6 text-center stage-backdrop">
						<div className="poster-headline text-2xl md:text-3xl mb-2">AWAITING HOST</div>
						<div className="text-deepBrown/80 text-sm">Waiting for host to arm the Deathmatch…</div>
					</div>
				)}
			</div>

			{/* Owner Controls */}
			{isOwner && (
				<div className="paper-card paper-grain ink-edge p-4 mb-6">
					<div className="poster-headline text-base mb-2">HOST CONTROLS</div>
					<div className="flex flex-col gap-3 md:flex-row md:items-end">
						<button onClick={startNow} className="btn-vintage px-4 py-3 rounded-md w-full md:w-auto md:flex-1">Start Deathmatch now</button>
						<div className="w-full md:w-auto md:flex-1">
							<div className="text-[11px] text-muted mb-1">Or schedule a start time:</div>
							<input
								type="datetime-local"
								value={scheduleAt}
								onChange={(e) => setScheduleAt(e.target.value)}
								className="w-full bg-main text-main border border-strong rounded-md px-2 py-2"
							/>
						</div>
						<button onClick={schedule} className="btn-secondary px-4 py-3 rounded-md w-full md:w-auto md:flex-1">Schedule start</button>
					</div>
					<div className="mt-3 flex flex-col sm:flex-row gap-2">
						{lobbyStatus === "scheduled" && (
							<button onClick={cancelSchedule} className="px-3 py-2 rounded-md border border-strong text-xs flex-1">
								Cancel scheduled start
							</button>
						)}
						{user && !iHaveAPlayer && (
							<button onClick={addMeToLobby} className="btn-secondary px-3 py-2 rounded-md flex-1">Add me to this lobby</button>
						)}
					</div>
				</div>
			)}

			{/* Athletes on deck */}
			<div className="paper-card paper-grain ink-edge p-4">
				<div className="poster-headline text-base mb-3">ATHLETES ON DECK 🏋️‍♂️</div>
				<motion.div
					initial="hidden"
					animate="show"
					variants={{
						hidden: {},
						show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } }
					}}
					className="grid grid-cols-1 md:grid-cols-2 gap-3"
				>
					{players.map((p) => (
						<motion.div
							key={p.id}
							variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
							className="relative bg-cream rounded-md p-3 border border-deepBrown/20 flex items-center gap-3"
						>
							{/* Underlighting glow */}
							<div className="absolute inset-x-4 -bottom-2 h-3 rounded-full blur-md" style={{ background: "radial-gradient(ellipse at center, rgba(225,84,42,0.35), rgba(0,0,0,0))" }} />
							<div className="relative h-12 w-12 rounded-full overflow-hidden bg-tan border border-deepBrown/30">
								{p.avatarUrl ? (
									/* Use native img to avoid next/image layout constraints in cards */
									<img src={p.avatarUrl} alt={`${p.name} avatar`} className="h-full w-full object-cover" />
								) : (
									<div className="h-full w-full flex items-center justify-center text-xl">🏋️</div>
								)}
							</div>
							<div className="flex-1">
								<div className="poster-headline text-base leading-4">{p.name.toUpperCase()}</div>
								<div className="text-[11px] text-deepBrown/70">{p.location || "—"}</div>
								{p.quip && <div className="text-[11px] text-deepBrown/80 mt-0.5 italic truncate">“{p.quip}”</div>}
							</div>
							<div className="text-xs text-deepBrown/80 whitespace-nowrap">{p.currentStreak}-day streak</div>
							{p.isStravaConnected ? (
								<StatusBadge status="online" className="ml-2" />
							) : me === p.id ? (
								<a className="ml-2 px-2 py-0.5 rounded text-[10px] underline"
									href={`/api/strava/authorize?playerId=${encodeURIComponent(p.id)}&lobbyId=${encodeURIComponent(lobby.id)}`}>
									Connect Strava
								</a>
							) : (
								<StatusBadge status="offline" className="ml-2" />
							)}
						</motion.div>
					))}
				</motion.div>
			</div>
		</div>
	);
}


