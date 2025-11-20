"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { Lobby, Player } from "@/types/game";
import { LiveLobbyResponse } from "@/types/api";
import { motion } from "framer-motion";
import { Scoreboard } from "./Scoreboard";
import { PlayerCard } from "./PlayerCard";
import { useSearchParams } from "next/navigation";
import { useToast } from "./ToastProvider";
import { RecentFeed } from "./RecentFeed";
import { KoOverlay } from "./KoOverlay";
import { WinnerOverlay } from "./WinnerOverlay";
import { OwnerSettingsModal } from "./OwnerSettingsModal";
import { useAuth } from "./AuthProvider";
import { ChallengeHero } from "./ChallengeHero";
import { WeekSetup } from "./WeekSetup";

export function LobbyLayout({ 
	lobby, 
	liveData,
	onRefresh,
	onStageChange,
	onOwnerChange
}: { 
	lobby: Lobby;
	liveData?: LiveLobbyResponse | null;
	onRefresh?: () => void;
	onStageChange?: (stage: Lobby["stage"], summary: Lobby["seasonSummary"]) => void;
	onOwnerChange?: (isOwner: boolean) => void;
}) {
	// Derive state directly from props
	const players = lobby.players || [];
	const currentPot = typeof lobby.cashPool === "number" ? lobby.cashPool : 0;
	const seasonStatus = liveData?.seasonStatus ?? lobby.status;
	const stage = liveData?.stage ?? lobby.stage;
	const seasonSummary = liveData?.seasonSummary ?? lobby.seasonSummary;
	const koEvent = liveData?.koEvent;
	const mode = (lobby as any).mode;

	// Local UI state
	const [weekStatus, setWeekStatus] = useState<string | null>(null);
	const [activePunishment, setActivePunishment] = useState<{ text: string; week: number } | null>(null);
	const [showKo, setShowKo] = useState<boolean>(false);
	const [showWinner, setShowWinner] = useState<boolean>(false);
	const [me, setMe] = useState<string | null>(null);
	const [editOpen, setEditOpen] = useState(false);
	const { user } = useAuth();
	const toast = useToast();

	// Determine owner
	const isOwner = useMemo(() => {
		if (user?.id && (lobby as any).ownerUserId) return user.id === (lobby as any).ownerUserId;
		const ownerPlayer = players.find(p => p.id === lobby.ownerId);
		if (user?.id && ownerPlayer?.userId) return ownerPlayer.userId === user.id;
		return !!(lobby.ownerId && me && lobby.ownerId === me);
	}, [user?.id, (lobby as any).ownerUserId, lobby.ownerId, me, players]);
	
	// Notify parent of owner/stage status
	useEffect(() => {
		onOwnerChange?.(isOwner);
	}, [isOwner, onOwnerChange]);

	useEffect(() => {
		if (onStageChange && (stage || seasonSummary !== undefined)) {
			onStageChange(stage, seasonSummary);
		}
	}, [stage, seasonSummary, onStageChange]);

	// Show KO/Winner overlays when events arrive
	useEffect(() => {
		if (koEvent) {
			if (koEvent.winnerPlayerId) {
				setShowWinner(true);
			} else {
				setShowKo(true);
			}
		}
	}, [koEvent]);

	// Show connection errors
	useEffect(() => {
		if (liveData?.errors?.length) {
			const names: string[] = [];
			for (const err of liveData.errors) {
				const n = players.find((p: any) => p.id === err.playerId)?.name ?? err.playerId;
				names.push(n);
			}
			toast.push(`Some connections need attention: ${names.join(", ")}`);
		}
	}, [liveData?.errors, players, toast]);

	const search = useSearchParams();
	const stravaConnected = search.get("stravaConnected");
	const connectedPlayerId = search.get("playerId");
	const stravaError = search.get("stravaError");
	const joined = search.get("joined");

	const item = {
		hidden: { opacity: 0, y: 12, scale: 0.98 },
		show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4, ease: "easeOut" } }
	};

	// Load week status and active punishment for challenge modes (still polling separately for now)
	useEffect(() => {
		if (!String(mode || "").startsWith("CHALLENGE_")) return;
		let cancelled = false;
		async function load() {
			try {
				const res = await fetch(`/api/lobby/${encodeURIComponent(lobby.id)}/punishments`, { cache: "no-store" });
				if (!res.ok || cancelled) return;
				const j = await res.json();
				if (j.active && j.weekStatus) {
					setWeekStatus(j.weekStatus);
					setActivePunishment({ text: j.active.text, week: j.week });
				} else {
					setWeekStatus(null);
					setActivePunishment(null);
				}
			} catch { /* ignore */ }
		}
		load();
		const id = setInterval(load, 10 * 1000);
		return () => {
			cancelled = true;
			clearInterval(id);
		};
	}, [lobby.id, mode, liveData?.fetchedAt]);

	// Sync current user's player data from profile
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
							overwriteAll: true
						})
					});
					onRefresh?.();
				} catch { /* ignore */ }
			}
		})();
	}, [user?.id, players.length, lobby.id, onRefresh]);

	useEffect(() => {
		const meId = typeof window !== "undefined" ? localStorage.getItem("gymdm_playerId") : null;
		setMe(meId);
		// Force reload if strava params changed
		if (stravaConnected || stravaError) {
			onRefresh?.();
		}
	}, [stravaConnected, stravaError, onRefresh]);

	// Welcome toast after join
	useEffect(() => {
		if (joined === "1" && connectedPlayerId) {
			toast.push("Welcome! You joined the lobby.");
		}
	}, [joined, connectedPlayerId, toast]);

	return (
		<div className="mx-auto max-w-6xl">
			{/* Season header strip */}
			<div className="relative mb-2">
				<motion.div className="paper-card paper-grain ink-edge px-4 py-3 border-b-4" style={{ borderColor: "#E1542A" }}>
					<div className="flex flex-wrap items-center gap-3">
						<button
							aria-label="Share lobby"
							className="p-1 text-xs text-main dark:text-cream"
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
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
								<path d="M10 13a5 5 0 0 0 7.07 0l3.54-3.54a5 5 0 0 0-7.07-7.07L11 4" />
								<path d="M14 11a5 5 0 0 0-7.07 0L3.39 14.54a5 5 0 1 0 7.07 7.07L13 20" />
							</svg>
						</button>
						<div className="poster-headline text-2xl">{lobby.name.toUpperCase()}</div>
						<div className="text-sm text-deepBrown/70">SEASON {lobby.seasonNumber} · MODE: {mode || "MONEY_SURVIVAL"}</div>
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

			{/* Week Setup (PENDING_CONFIRMATION) for Challenge Roulette */}
			{String(mode || "").startsWith("CHALLENGE_") && weekStatus === "PENDING_CONFIRMATION" && activePunishment ? (
				<>
					<div className="mb-6">
						<WeekSetup
							lobbyId={lobby.id}
							week={activePunishment.week}
							punishmentText={activePunishment.text}
							mode={mode as any}
							challengeSettings={lobby.challengeSettings || null}
							players={players}
							isOwner={isOwner}
						/>
					</div>
					{/* Arena feed */}
					<div className="mb-6">
						<RecentFeed lobbyId={lobby.id} />
					</div>
				</>
			) : (
				<>
					{/* Money vs Challenge header blocks - hide countdown when completed */}
					{stage !== "COMPLETED" && (
						<>
							{String(mode || "").startsWith("MONEY_") ? (
								<div className="mb-4">
									<Scoreboard amount={currentPot} endIso={lobby.seasonEnd} />
								</div>
							) : (
								<div className="mb-4">
									<ChallengeHero
										lobbyId={lobby.id}
										mode={mode as any}
										challengeSettings={lobby.challengeSettings || null}
										seasonStart={lobby.seasonStart}
										seasonEnd={lobby.seasonEnd}
									/>
								</div>
							)}
						</>
					)}
					{/* Arena feed directly under pot */}
					<div className="mb-6">
						<RecentFeed lobbyId={lobby.id} />
					</div>
				</>
			)}

			{/* Player cards - hide during PENDING_CONFIRMATION, show in WeekSetup instead */}
			{!(String(mode || "").startsWith("CHALLENGE_") && weekStatus === "PENDING_CONFIRMATION") && (
				<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 items-stretch">
					{players.slice(0, 2).map((p) => (
						<motion.div key={p.id} variants={item} className="h-full">
							<PlayerCard player={p} lobbyId={lobby.id} mePlayerId={me ?? undefined as any} showReady={false} />
						</motion.div>
					))}
					{players.slice(2).map((p) => (
						<motion.div key={p.id} variants={item} className="h-full">
							<PlayerCard player={p} lobbyId={lobby.id} mePlayerId={me ?? undefined as any} showReady={false} />
						</motion.div>
					))}
				</div>
			)}
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
					onSaved={() => { setEditOpen(false); onRefresh?.(); }}
					hideTrigger
				/>
			)}
		</div>
	);
}
