"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { Lobby } from "@/types/game";
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
import { LAST_LOBBY_STORAGE_KEY } from "@/lib/localStorageKeys";

type LobbyLayoutProps = {
	lobby: Lobby;
	liveData?: LiveLobbyResponse | null;
	onRefresh?: () => void;
	onStageChange?: (stage: Lobby["stage"], summary: Lobby["seasonSummary"] | undefined) => void;
	onOwnerChange?: (isOwner: boolean) => void;
};

export function LobbyLayout(props: LobbyLayoutProps) {
	const lobbyData = props.lobby;
	const liveData = props.liveData;
	const onRefresh = props.onRefresh;
	const onStageChange = props.onStageChange;
	const onOwnerChange = props.onOwnerChange;
	// Derive state directly from props
	const players = lobbyData.players || [];
	const currentPot = typeof lobbyData.cashPool === "number" ? lobbyData.cashPool : 0;
	const seasonStatus = liveData?.seasonStatus ?? lobbyData.status;
	const stage = liveData?.stage ?? lobbyData.stage;
	const seasonSummary = liveData?.seasonSummary ?? lobbyData.seasonSummary;
	const koEvent = liveData?.koEvent;
	const mode = (lobbyData as any).mode;
	const modeValue = mode ?? null;

	// Local UI state
	const [weekStatus, setWeekStatus] = useState<string | null>(null);
	const [activePunishment, setActivePunishment] = useState<{ text: string; week: number } | null>(null);
	const [showKo, setShowKo] = useState<boolean>(false);
	const [showWinner, setShowWinner] = useState<boolean>(false);
	const [editOpen, setEditOpen] = useState(false);
	const { user } = useAuth();
	const toast = useToast();
	const [potAmount, setPotAmount] = useState<number>(currentPot);

	// Determine owner
	const myPlayerId = useMemo(() => {
		if (!user?.id) return null;
		const mine = players.find(p => (p as any).userId === user.id);
		return mine ? mine.id : null;
	}, [players, user?.id]);

	const isOwner = useMemo(() => {
		if (user?.id && (lobbyData as any).ownerUserId) return user.id === (lobbyData as any).ownerUserId;
		const ownerPlayer = players.find(p => p.id === lobbyData.ownerId);
		if (user?.id && ownerPlayer?.userId) return ownerPlayer.userId === user.id;
		return !!(lobbyData.ownerId && myPlayerId && lobbyData.ownerId === myPlayerId);
	}, [user?.id, (lobbyData as any).ownerUserId, lobbyData.ownerId, players, myPlayerId]);

	useEffect(() => {
		setPotAmount(currentPot);
	}, [currentPot]);
	
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
				const res = await fetch(`/api/lobby/${encodeURIComponent(lobbyData.id)}/punishments`, { cache: "no-store" });
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
	}, [lobbyData.id, mode, liveData?.fetchedAt]);

	// Remember this lobby locally so Home can resume it
	useEffect(() => {
		if (typeof window === "undefined") return;
		try {
			const snapshot = {
				id: lobbyData.id,
				name: lobbyData.name,
				mode: modeValue,
				updatedAt: new Date().toISOString()
			};
			window.localStorage.setItem(LAST_LOBBY_STORAGE_KEY, JSON.stringify(snapshot));
			window.dispatchEvent(new CustomEvent("gymdm:last-lobby"));
		} catch {
			// ignore storage errors (private mode, etc.)
		}
	}, [lobbyData.id, lobbyData.name, modeValue]);

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
	}, [user?.id, players.length, lobbyData.id, onRefresh]);

	useEffect(() => {
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
								const shareUrl = `${window.location.origin}/onboard/${lobbyData.id}`;
								const ownerName = players.find(p => p.id === lobbyData.ownerId)?.name || "Your friend";
								const text = `${ownerName} is inviting you to the Deathmatch — ${lobbyData.name}. Join now:`;
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
						<div className="poster-headline text-2xl">{lobbyData.name.toUpperCase()}</div>
						<div className="text-sm text-deepBrown/70">SEASON {lobbyData.seasonNumber} · MODE: {mode || "MONEY_SURVIVAL"}</div>
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
							lobbyId={lobbyData.id}
							week={activePunishment.week}
							punishmentText={activePunishment.text}
							mode={mode as any}
							challengeSettings={lobbyData.challengeSettings || null}
							players={players}
							isOwner={isOwner}
						/>
					</div>
					{/* Arena feed */}
					<div className="mb-6">
						<RecentFeed lobbyId={lobbyData.id} />
					</div>
				</>
			) : (
				<>
					{/* Money vs Challenge header blocks - hide countdown when completed */}
					{stage !== "COMPLETED" && (
						<>
							{String(mode || "").startsWith("MONEY_") ? (
								<div className="mb-4">
									<Scoreboard
										amount={potAmount}
										endIso={lobbyData.seasonEnd}
										canEdit={isOwner}
										onEdit={async () => {
											if (!isOwner || !user?.id) return;
											const input = window.prompt("Set pot amount", String(potAmount));
											if (input === null) return;
											const target = Number(input);
											if (!Number.isFinite(target) || target < 0) {
												toast.push("Enter a valid non-negative number.");
												return;
											}
											try {
												const res = await fetch(`/api/lobby/${encodeURIComponent(lobbyData.id)}/pot`, {
													method: "POST",
													headers: { "Content-Type": "application/json", "x-user-id": user.id },
													body: JSON.stringify({ targetPot: target })
												});
												const data = await res.json().catch(() => ({}));
												if (!res.ok) {
													toast.push(data.error || "Failed to update pot");
													return;
												}
												setPotAmount(target);
												toast.push("Pot updated");
												onRefresh?.();
											} catch {
												toast.push("Failed to update pot");
											}
										}}
									/>
								</div>
							) : (
								<div className="mb-4">
									<ChallengeHero
										lobbyId={lobbyData.id}
										mode={mode as any}
										challengeSettings={lobbyData.challengeSettings || null}
										seasonStart={lobbyData.seasonStart}
										seasonEnd={lobbyData.seasonEnd}
									/>
								</div>
							)}
						</>
					)}
					{/* Arena feed directly under pot */}
					<div className="mb-6">
						<RecentFeed lobbyId={lobbyData.id} />
					</div>
				</>
			)}

			{/* Player cards - hide during PENDING_CONFIRMATION, show in WeekSetup instead */}
			{!(String(mode || "").startsWith("CHALLENGE_") && weekStatus === "PENDING_CONFIRMATION") && (
				<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 items-stretch">
					{players.slice(0, 2).map((p) => (
						<motion.div key={p.id} variants={item} className="h-full">
								<PlayerCard player={p} lobbyId={lobbyData.id} mePlayerId={myPlayerId || undefined} showReady={false} />
						</motion.div>
					))}
					{players.slice(2).map((p) => (
						<motion.div key={p.id} variants={item} className="h-full">
								<PlayerCard player={p} lobbyId={lobbyData.id} mePlayerId={myPlayerId || undefined} showReady={false} />
						</motion.div>
					))}
				</div>
			)}
			{/* Strava reconnect banner removed – Strava is optional now */}
			<KoOverlay
				open={seasonStatus === "completed" && !!koEvent && showKo}
				onClose={() => setShowKo(false)}
				lobbyId={lobbyData.id}
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
				lobbyId={lobbyData.id}
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
						lobbyId={lobbyData.id}
						ownerPlayerId={lobbyData.ownerId}
						defaultWeekly={lobbyData.weeklyTarget ?? 3}
					defaultLives={lobbyData.initialLives ?? 3}
					defaultSeasonEnd={lobbyData.seasonEnd}
					defaultInitialPot={(lobbyData as any).initialPot ?? 0}
					defaultWeeklyAnte={(lobbyData as any).weeklyAnte ?? 10}
					defaultScalingEnabled={(lobbyData as any).scalingEnabled ?? false}
					defaultPerPlayerBoost={(lobbyData as any).perPlayerBoost ?? 0}
					onSaved={() => { setEditOpen(false); onRefresh?.(); }}
					hideTrigger
				/>
			)}
		</div>
	);
}
