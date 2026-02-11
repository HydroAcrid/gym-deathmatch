"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Lobby, Player } from "@/types/game";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { OwnerSettingsModal } from "./OwnerSettingsModal";
import { Button } from "@/src/ui2/ui/button";
import { Input } from "@/src/ui2/ui/input";
import { CountdownTimer } from "@/src/ui2/components/CountdownTimer";
import { AthleteCard } from "@/src/ui2/components/AthleteCard";
import { authFetch } from "@/lib/clientAuth";
import { toIsoFromLocalDateTimeInput, toLocalDateTimeInputValue } from "@/lib/datetime";

export function PreStageView({ lobby }: { lobby: Lobby }) {
	const router = useRouter();
	const { user } = useAuth();
	const [ownerUserId, setOwnerUserId] = useState<string | null>(null);
	const [editOpen, setEditOpen] = useState(false);
	const [profileName, setProfileName] = useState<string>("");
	const [profileAvatar, setProfileAvatar] = useState<string>("");
	const [profileLocation, setProfileLocation] = useState<string>("");
	const [profileQuip, setProfileQuip] = useState<string>("");
	const [players, setPlayers] = useState(lobby.players);
	const isOwner = useMemo(() => {
		const ownerPlayer = players.find(p => p.id === lobby.ownerId);
		// Prefer owner_user_id when present
		if (user?.id && lobby.ownerUserId) return user.id === lobby.ownerUserId;
		// Fallback: auth user matches owner player's user_id, or legacy playerId check
		if (user?.id && ownerUserId) return user.id === ownerUserId;
		if (user?.id && ownerPlayer?.userId) return user.id === ownerPlayer.userId;
		return false;
	}, [players, lobby.ownerId, lobby.ownerUserId, user?.id, ownerUserId]);

	const me = useMemo(() => {
		if (!user?.id) return null;
		const myPlayer = players.find(p => (p as any).userId === user.id);
		return myPlayer?.id ?? null;
	}, [players, user?.id]);

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

	const [scheduleAt, setScheduleAt] = useState<string>(toLocalDateTimeInputValue(lobby.scheduledStart ?? ""));
	const [lobbyStatus, setLobbyStatus] = useState<string | undefined>(lobby.status);
	const [scheduledStart, setScheduledStart] = useState<string | null | undefined>(lobby.scheduledStart);
	const [readySaving, setReadySaving] = useState(false);
	
	const reloadLobby = async () => {
		try {
			const res = await authFetch(`/api/lobby/${encodeURIComponent(lobby.id)}/live`, { cache: "no-store" });
			if (!res.ok) return;
			const data = await res.json();
			if (data?.lobby) {
				setPlayers(data.lobby.players || []);
				if (data.seasonStatus) setLobbyStatus(data.seasonStatus);
			}
		} catch { /* ignore */ }
	};

	const schedule = async () => {
		const scheduledStartIso = toIsoFromLocalDateTimeInput(scheduleAt);
		await authFetch(`/api/lobby/${encodeURIComponent(lobby.id)}/stage`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				status: "scheduled",
				scheduledStart: scheduledStartIso
			})
		});
		setLobbyStatus("scheduled");
		setScheduledStart(scheduledStartIso);
		await reloadLobby();
	};
	const startNow = async () => {
		const res = await authFetch(`/api/lobby/${encodeURIComponent(lobby.id)}/stage`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ startNow: true })
		});
		if (res.ok) {
			// For roulette mode, status changes to transition_spin, so wait a bit longer for the update
			// For other modes, status changes to active
			setTimeout(() => router.refresh(), 1000);
		}
	};
	const cancelSchedule = async () => {
		await authFetch(`/api/lobby/${encodeURIComponent(lobby.id)}/stage`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ status: "pending", scheduledStart: null })
		});
		setLobbyStatus("pending");
		setScheduledStart(null);
		await reloadLobby();
	};

	const setMyReadyState = async (nextReady: boolean) => {
		if (!me || readySaving) return;
		setReadySaving(true);
		try {
			await authFetch(`/api/lobby/${encodeURIComponent(lobby.id)}/ready`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ ready: nextReady }),
			});
			await reloadLobby();
		} finally {
			setReadySaving(false);
		}
	};

	// Load profile basics for quick-join
	useEffect(() => {
		(async () => {
			try {
				if (!user?.id) return;
				const res = await authFetch(`/api/user/profile`, { cache: "no-store" });
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
		await authFetch(`/api/lobby/${encodeURIComponent(lobby.id)}/invite`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				id,
				name: profileName || emailName || "Me",
				avatarUrl: profileAvatar || null,
				location: profileLocation || null,
				quip: profileQuip || null
			})
		});
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
					await authFetch("/api/user/sync", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							playerId: myPlayer.id,
							overwriteAll: true // Always sync from profile to ensure quip/location are current
						})
					});
					// Refresh players list to show updated data
					await reloadLobby();
				} catch { /* ignore */ }
			}
		})();
	}, [user?.id, players.length, lobby.id]); // Sync when user, player count, or lobby changes

	// Load live statuses (Strava connected, etc.) and poll for updates
	useEffect(() => {
		let cancelled = false;
		async function refresh() {
			if (cancelled || document.hidden) return;
			try {
				const res = await authFetch(`/api/lobby/${encodeURIComponent(lobby.id)}/live`, { cache: "no-store" });
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

	const readyCount = players.filter((p) => !!p.ready).length;
	const allReady = players.length > 0 && readyCount === players.length;

	return (
		<div className="min-h-screen">
			<div className="container mx-auto px-4 py-8 space-y-8">
				<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<p className="font-mono text-xs text-primary uppercase tracking-widest">Pre-Stage</p>
						<h1 className="font-display text-4xl font-black uppercase tracking-tight">
							{lobby.name}
						</h1>
						<p className="font-mono text-muted-foreground">Season {lobby.seasonNumber}</p>
					</div>
					<div className="flex items-center gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={async () => {
								if (lobby.inviteEnabled === false) {
									alert("Invites are disabled. Enable them in Edit Lobby.");
									return;
								}
								let inviteToken: string | null = null;
								try {
									const accessRes = await authFetch(`/api/lobby/${encodeURIComponent(lobby.id)}/access-state`, { cache: "no-store" });
									if (accessRes.ok) {
										const accessData = await accessRes.json();
										inviteToken = typeof accessData?.inviteToken === "string" ? accessData.inviteToken : null;
									}
								} catch {
									// fallback to non-token link below
								}
								if (lobby.inviteTokenRequired === true && !inviteToken) {
									alert("Unable to generate secure invite link right now.");
									return;
								}
								const tokenQuery = inviteToken ? `?t=${encodeURIComponent(inviteToken)}` : "";
								const shareUrl = `${window.location.origin}/onboard/${lobby.id}${tokenQuery}`;
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
							Share
						</Button>
						{isOwner && (
							<Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
								Edit
							</Button>
						)}
					</div>
				</div>

				{isOwner && (
					<OwnerSettingsModal
						open={editOpen}
						onClose={() => setEditOpen(false)}
						lobbyId={lobby.id}
						ownerPlayerId={lobby.ownerId}
						defaultWeekly={lobby.weeklyTarget ?? 3}
						defaultLives={lobby.initialLives ?? 3}
						defaultSeasonEnd={lobby.seasonEnd}
						onSaved={() => { setEditOpen(false); reloadLobby(); }}
						hideTrigger
					/>
				)}

				{lobbyStatus === "scheduled" && scheduledStart ? (
					<CountdownTimer
						targetDate={new Date(scheduledStart)}
						label="SEASON STARTS IN"
						sublabel={`${players.length} ATHLETES`}
					/>
				) : (
					<div className="arena-panel p-6 text-center">
						<p className="font-display text-2xl uppercase text-muted-foreground">Awaiting Host</p>
					</div>
				)}

				{isOwner && (
					<div className="arena-panel p-4 space-y-4">
						<div className="flex items-center justify-between">
							<h2 className="font-display text-base tracking-widest">HOST CONTROLS</h2>
							<span className="arena-badge arena-badge-primary text-[10px]">RESTRICTED</span>
						</div>
						<div className="space-y-3">
							<Button variant="arenaPrimary" className="w-full h-12 touch-target-lg" onClick={startNow}>
								Start Deathmatch now
							</Button>
							<div className="grid md:grid-cols-3 gap-3">
									<Input
										type="datetime-local"
										value={scheduleAt}
										onChange={(e) => setScheduleAt(e.target.value)}
										className="arena-datetime-input h-11 box-border"
									/>
								<Button variant="outline" onClick={schedule} className="h-11 touch-target">
									Schedule start
								</Button>
								{lobbyStatus === "scheduled" ? (
									<Button variant="destructive" onClick={cancelSchedule} className="h-11 touch-target">
										Cancel schedule
									</Button>
								) : null}
							</div>
							{user && !iHaveAPlayer && (
								<Button variant="outline" className="w-full h-11 touch-target" onClick={addMeToLobby}>
									Add me to this lobby
								</Button>
							)}
						</div>
						<div className="arena-warning">
							<p className="text-[10px] sm:text-xs text-destructive uppercase tracking-wider leading-relaxed font-display">
								Host actions are final. Once commenced, the Deathmatch cannot be reversed.
							</p>
						</div>
					</div>
				)}

				<section>
					<div className="mb-4 flex items-center justify-between gap-3">
						<h2 className="font-display text-xl uppercase tracking-wider">Athletes on Deck</h2>
						<div className={`arena-badge text-[10px] ${allReady ? "arena-badge-primary" : ""}`}>
							{readyCount}/{players.length} READY
						</div>
					</div>
					<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
						{players.map((p) => (
							<AthleteCard
								key={p.id}
								name={p.name}
								location={p.location}
								avatarUrl={p.avatarUrl}
								ready={!!p.ready}
								isMe={me === p.id}
								readyBusy={readySaving && me === p.id}
								onToggleReady={me === p.id ? () => setMyReadyState(!p.ready) : undefined}
								stravaConnected={!!p.isStravaConnected}
								quip={p.quip}
								actionLabel={
									!p.isStravaConnected && me === p.id ? "Connect Strava" : undefined
								}
								actionHref={
									!p.isStravaConnected && me === p.id
										? `/api/strava/authorize?playerId=${encodeURIComponent(p.id)}&lobbyId=${encodeURIComponent(lobby.id)}`
										: undefined
								}
							/>
						))}
					</div>
				</section>
			</div>
		</div>
	);
}
