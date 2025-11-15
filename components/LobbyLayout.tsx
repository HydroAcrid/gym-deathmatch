"use client";

import { useMemo, useState } from "react";
import { Lobby, Player } from "@/types/game";
import { motion } from "framer-motion";
import { Scoreboard } from "./Scoreboard";
import { PlayerCard } from "./PlayerCard";
// import { InvitePlayerCard } from "./InvitePlayerCard";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useToast } from "./ToastProvider";
import { RecentFeed } from "./RecentFeed";
import { oneLinerFromActivity } from "@/lib/messages";
import { KoOverlay } from "./KoOverlay";
import { WinnerOverlay } from "./WinnerOverlay";
import { OwnerSettingsModal } from "./OwnerSettingsModal";
import { useAuth } from "./AuthProvider";
import { WeeklyPunishmentCard } from "./WeeklyPunishmentCard";
import { ChallengeHero } from "./ChallengeHero";

export function LobbyLayout({ lobby }: { lobby: Lobby }) {
	const [players, setPlayers] = useState<Player[]>(lobby.players);
	const [currentPot, setCurrentPot] = useState<number>(lobby.cashPool);
	const [seasonStatus, setSeasonStatus] = useState<"pending" | "scheduled" | "active" | "completed" | undefined>(lobby.status);
	const [koEvent, setKoEvent] = useState<any>(null);
	const [showKo, setShowKo] = useState<boolean>(false);
	const [showWinner, setShowWinner] = useState<boolean>(false);
	const [me, setMe] = useState<string | null>(null);
	const [editOpen, setEditOpen] = useState(false);
	const [mode, setMode] = useState<string | undefined>((lobby as any).mode);
	const { user } = useAuth();
	const isOwner = useMemo(() => {
		if (user?.id && (lobby as any).ownerUserId) return user.id === (lobby as any).ownerUserId;
		const ownerPlayer = players.find(p => p.id === lobby.ownerId);
		if (user?.id && ownerPlayer?.userId) return ownerPlayer.userId === user.id;
		return !!(lobby.ownerId && me && lobby.ownerId === me);
	}, [user?.id, (lobby as any).ownerUserId, lobby.ownerId, me, players]);
	const search = useSearchParams();
	const stravaConnected = search.get("stravaConnected");
	const connectedPlayerId = search.get("playerId");
	const stravaError = search.get("stravaError");
	const joined = search.get("joined");
	const container = {
		hidden: {},
		show: {
			transition: {
				staggerChildren: 0.08,
				delayChildren: 0.12
			}
		}
	};
	const item = {
		hidden: { opacity: 0, y: 12, scale: 0.98 },
		show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4, ease: "easeOut" } }
	};

	const banner = useMemo(() => {
		if (stravaConnected === "1" && connectedPlayerId) {
			const name = players.find(p => p.id === connectedPlayerId)?.name ?? "A player";
			return `${name} connected Strava ✅`;
		}
		if (stravaError === "1" && connectedPlayerId) {
			const name = players.find(p => p.id === connectedPlayerId)?.name ?? "A player";
			return `${name}: Strava connection failed. Please try again.`;
		}
		return null;
	}, [stravaConnected, stravaError, connectedPlayerId, players]);
	const toast = useToast();
	const [feedEvents, setFeedEvents] = useState<{ message: string; timestamp: string }[]>([]);

	const reloadLive = async () => {
		try {
			const res = await fetch(`/api/lobby/${encodeURIComponent(lobby.id)}/live`, { cache: "no-store" });
			if (!res.ok) return;
			const data = await res.json();
			if (data?.lobby?.players) {
				setPlayers(data.lobby.players);
				setFeedEvents(buildFeedFromPlayers(data.lobby.players));
				if (typeof data.lobby.cashPool === "number") setCurrentPot(data.lobby.cashPool);
			}
			if ((data?.lobby as any)?.mode) setMode((data.lobby as any).mode);
			setSeasonStatus(data.seasonStatus);
			if (data.koEvent) {
				setKoEvent(data.koEvent);
				if (data.koEvent.winnerPlayerId) {
					setShowWinner(true);
				} else {
					setShowKo(true);
				}
			}
			// show reconnect hint if there are errors
			if (data?.errors?.length) {
				const names: string[] = [];
				for (const err of data.errors) {
					const n = data.lobby.players.find((p: any) => p.id === err.playerId)?.name ?? err.playerId;
					names.push(n);
				}
				toast.push(`Some connections need attention: ${names.join(", ")}`);
			}
		} catch {
			// ignore
		}
	};

	useEffect(() => {
		let ignore = false;
		const meId = typeof window !== "undefined" ? localStorage.getItem("gymdm_playerId") : null;
		setMe(meId);
		async function loadLive() {
			if (ignore) return;
			await reloadLive();
		}
		loadLive();
		// re-fetch after connect or error banners too
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [lobby.id, stravaConnected, stravaError]);
	// periodic refresh to keep feed fresh
	useEffect(() => {
		const id = setInterval(() => { reloadLive(); }, 12 * 60 * 1000);
		return () => clearInterval(id);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [lobby.id]);
	// Allow children to request refresh (e.g., after manual log)
	useEffect(() => {
		function handler() { reloadLive(); }
		if (typeof window !== "undefined") window.addEventListener("gymdm:refresh-live", handler as any);
		return () => { if (typeof window !== "undefined") window.removeEventListener("gymdm:refresh-live", handler as any); };
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);
	// Welcome toast after join
	useEffect(() => {
		if (joined === "1" && connectedPlayerId) {
			toast.push("Welcome! You joined the lobby.");
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [joined, connectedPlayerId]);
	// Remember last visited lobby for user home
	useEffect(() => {
		if (typeof window !== "undefined") {
			localStorage.setItem("gymdm_lastLobbyId", lobby.id);
		}
	}, [lobby.id]);

	return (
		<div className="mx-auto max-w-6xl">
			{/* Season header strip */}
			<div className="relative mb-2">
				<motion.div className="paper-card paper-grain ink-edge px-4 py-3 border-b-4" style={{ borderColor: "#E1542A" }}>
					<div className="flex flex-wrap items-center gap-3">
						<button
							aria-label="Share lobby"
							className="p-1 text-xs"
							onClick={async () => {
								if (typeof window === "undefined") return;
								const shareUrl = `${window.location.origin}/onboard/${lobby.id}`;
								const ownerName = players.find(p => p.id === lobby.ownerId)?.name || "Your friend";
								const text = `${ownerName} is inviting you to the Deathmatch — ${lobby.name}. Join now:`;
								try {
									if (navigator.share) {
										await navigator.share({
											title: "Gym Deathmatch",
											text: text,
											url: shareUrl
										});
										return;
									}
								} catch {
									// fallthrough to clipboard
								}
								navigator.clipboard?.writeText(shareUrl);
								toast.push("Invite link copied");
							}}
						>
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
								<path d="M10 13a5 5 0 0 0 7.07 0l3.54-3.54a5 5 0 0 0-7.07-7.07L11 4" />
								<path d="M14 11a5 5 0 0 0-7.07 0L3.39 14.54a5 5 0 1 0 7.07 7.07L13 20" />
							</svg>
						</button>
						<div className="poster-headline text-2xl">{lobby.name.toUpperCase()}</div>
						<div className="text-sm text-deepBrown/70">SEASON {lobby.seasonNumber} · MODE: {mode || (lobby as any).mode || "MONEY_SURVIVAL"}</div>
						<div className="ml-auto">
							{isOwner && (
								<button className="btn-secondary px-3 py-2 rounded-md text-xs" onClick={() => setEditOpen(true)}>
									Edit
								</button>
							)}
						</div>
					</div>
				</motion.div>
				
			</div>
			

			<div className="header-divider-glow mb-3" />

			{/* Money vs Challenge header blocks */}
			{String((lobby as any).mode || "").startsWith("MONEY_") ? (
				<div className="mb-4">
					<Scoreboard amount={currentPot} endIso={lobby.seasonEnd} />
				</div>
			) : (
				<div className="mb-4">
					<ChallengeHero
						lobbyId={lobby.id}
						mode={(lobby as any).mode as any}
						challengeSettings={lobby.challengeSettings || null}
						seasonEnd={lobby.seasonEnd}
					/>
				</div>
			)}
			{/* Arena feed directly under pot */}
			<div className="mb-6">
				<RecentFeed lobbyId={lobby.id} />
			</div>
			{/* Weekly punishment card shows only during ACTIVE challenge weeks */}
			{String((lobby as any).mode || "").startsWith("CHALLENGE_") && seasonStatus === "active" && (
				<div className="mb-6">
					<WeeklyPunishmentCard lobbyId={lobby.id} seasonStart={lobby.seasonStart} isOwner={isOwner} />
				</div>
			)}

			<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 items-stretch">
				{players.slice(0, 2).map((p) => (
					<motion.div key={p.id} variants={item} className="h-full">
						<PlayerCard player={p} lobbyId={lobby.id} mePlayerId={me ?? undefined as any} />
					</motion.div>
				))}
				{players.slice(2).map((p) => (
					<motion.div key={p.id} variants={item} className="h-full">
						<PlayerCard player={p} lobbyId={lobby.id} mePlayerId={me ?? undefined as any} />
					</motion.div>
				))}
				{/* Invite flow is now handled via share/onboarding; manual add card removed */}
			</div>
			{/* Strava reconnect banner removed – Strava is optional now */}
			<KoOverlay
				open={seasonStatus === "completed" && !!koEvent && showKo}
				onClose={() => setShowKo(false)}
				lobbyId={lobby.id}
				loserName={players.find(p => p.id === koEvent?.loserPlayerId)?.name || "Player"}
				loserAvatar={players.find(p => p.id === koEvent?.loserPlayerId)?.avatarUrl}
				pot={currentPot}
			/>
			<WinnerOverlay
				open={seasonStatus === "completed" && !!koEvent?.winnerPlayerId && showWinner}
				onClose={() => setShowWinner(false)}
				winnerName={players.find(p => p.id === koEvent?.winnerPlayerId)?.name || "Player"}
				winnerAvatar={players.find(p => p.id === koEvent?.winnerPlayerId)?.avatarUrl || undefined}
				pot={currentPot}
				lobbyId={lobby.id}
			/>
			{/* Owner Celebrate Again button */}
			{isOwner && seasonStatus === "completed" && !!koEvent?.winnerPlayerId && (
				<div className="fixed bottom-3 right-3 z-[90]">
					<button className="btn-secondary px-3 py-2 rounded-md text-xs" onClick={() => setShowWinner(true)}>
						Celebrate again
					</button>
				</div>
			)}
			{isOwner && (
				<OwnerSettingsModal
					open={editOpen}
					onClose={() => setEditOpen(false)}
					lobbyId={lobby.id}
					defaultWeekly={lobby.weeklyTarget ?? 3}
					defaultLives={lobby.initialLives ?? 3}
					defaultSeasonEnd={lobby.seasonEnd}
					defaultInitialPot={(lobby as any).initialPot ?? 0}
					defaultWeeklyAnte={(lobby as any).weeklyAnte ?? 10}
					defaultScalingEnabled={(lobby as any).scalingEnabled ?? false}
					defaultPerPlayerBoost={(lobby as any).perPlayerBoost ?? 0}
					onSaved={() => { setEditOpen(false); reloadLive(); }}
					hideTrigger
				/>
			)}
		</div>
	);
}

// (inline OwnerSettings removed; replaced by OwnerSettingsModal)

function buildFeedFromPlayers(players: any[]) {
	const evs: { message: string; timestamp: string }[] = [];
	for (const p of players) {
		const name = p.name || "Player";
		for (const a of (p.recentActivities ?? [])) {
			evs.push({
				message: `${name}: ${a.durationMinutes}m ${readableType(a.type)} — ${a.name}`,
				timestamp: a.startDate
			});
		}
		for (const e of (p.events ?? [])) {
			evs.push({
				message: e.met ? `${name} hit weekly target (${e.count}) ✅` : `${name} missed target (${e.count}) 💀`,
				timestamp: e.weekStart
			});
		}
	}
	evs.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
	// last 24h only, keep up to 5
	const day = 24 * 60 * 60 * 1000;
	const now = Date.now();
	const recent = evs.filter(e => now - new Date(e.timestamp).getTime() <= day);
	return (recent.length ? recent : evs).slice(0, 5);
}

function readableType(t: string) {
	const s = (t || "").toLowerCase();
	if (s.includes("run")) return "run 🏃";
	if (s.includes("ride") || s.includes("bike")) return "ride 🚴";
	if (s.includes("swim")) return "swim 🏊";
	if (s.includes("walk")) return "walk 🚶";
	if (s.includes("hike")) return "hike 🥾";
	return "session 💪";
}
