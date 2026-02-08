"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { Lobby } from "@/types/game";
import { LiveLobbyResponse } from "@/types/api";
import { motion } from "framer-motion";
import { PlayerCard } from "./PlayerCard";
import { useSearchParams } from "next/navigation";
import { useToast } from "./ToastProvider";
import { KoOverlay } from "./KoOverlay";
import { WinnerOverlay } from "./WinnerOverlay";
import { OwnerSettingsModal } from "./OwnerSettingsModal";
import { useAuth } from "./AuthProvider";
import { ChallengeHero } from "./ChallengeHero";
import { WeekSetup } from "./WeekSetup";
import { LAST_LOBBY_STORAGE_KEY } from "@/lib/localStorageKeys";
import { PeriodSummaryOverlay } from "./PeriodSummaryOverlay";
import { ActiveSeasonHeader } from "@/src/ui2/components/ActiveSeasonHeader";
import { LiveFeed } from "@/src/ui2/components/LiveFeed";
import { PotStakesPanel } from "@/src/ui2/components/PotStakesPanel";
import { HeartsStatusBoard, type AthleteHeartStatus } from "@/src/ui2/components/HeartsStatusBoard";
import { Standings, type Standing } from "@/src/ui2/components/Standings";
import { HostControls } from "@/src/ui2/components/HostControls";
import { WeeklyCycleIndicator } from "@/src/ui2/components/WeeklyCycleIndicator";
import { Button } from "@/src/ui2/ui/button";

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
	const modeLabel = String(mode || "MONEY_SURVIVAL").replace(/_/g, " ");
	const isMoneyMode = String(mode || "").startsWith("MONEY_");
	const isChallengeMode = String(mode || "").startsWith("CHALLENGE_");
	const ownerName = players.find((p) => p.id === lobbyData.ownerId)?.name || "Host";
	const weeklyAnte = (lobbyData as any).weeklyAnte ?? 10;

	const potGameMode = (() => {
		const key = String(mode || "").toUpperCase();
		if (key.includes("LAST_MAN")) return "last_man_standing";
		if (key.includes("ROULETTE")) return "roulette";
		if (key.includes("CUMULATIVE")) return "cumulative";
		return "survival";
	})() as "survival" | "last_man_standing" | "roulette" | "cumulative";

	// Local UI state
	const [weekStatus, setWeekStatus] = useState<string | null>(null);
	const [activePunishment, setActivePunishment] = useState<{ text: string; week: number } | null>(null);
	const [showKo, setShowKo] = useState<boolean>(false);
	const [showWinner, setShowWinner] = useState<boolean>(false);
	const [editOpen, setEditOpen] = useState(false);
	const { user } = useAuth();
	const toast = useToast();
	const [periodSummary, setPeriodSummary] = useState<any | null>(null);
	const [summaryOpen, setSummaryOpen] = useState(false);
	const [summaryPeriod, setSummaryPeriod] = useState<"daily"|"weekly">("daily");
	const [summarySeenKey, setSummarySeenKey] = useState<string | null>(null);
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

	// Period summary overlay (daily/weekly)
	useEffect(() => {
		if (!user?.id || !lobbyData?.id) return;
		const keyDaily = `period-summary-daily-${lobbyData.id}`;
		const keyWeekly = `period-summary-weekly-${lobbyData.id}`;
		const today = new Date();
		const pad = (n: number) => String(n).padStart(2, "0");
		const dayKey = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
		const weekKey = (() => {
			const d = new Date(today);
			const dow = d.getDay();
			const diff = d.getDate() - dow + (dow === 0 ? -6 : 1);
			d.setDate(diff);
			return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
		})();
		const seenDaily = typeof window !== "undefined" ? localStorage.getItem(keyDaily) : null;
		const seenWeekly = typeof window !== "undefined" ? localStorage.getItem(keyWeekly) : null;
		const shouldShowWeekly = seenWeekly !== weekKey;
		const shouldShowDaily = seenDaily !== dayKey;
		if (!shouldShowWeekly && !shouldShowDaily) return;

		(async () => {
			try {
				const headers: Record<string, string> = {};
				if (user?.id) headers["x-user-id"] = user.id;
				const res = await fetch(`/api/lobby/${encodeURIComponent(lobbyData.id)}/summary`, { cache: "no-store", headers });
				if (!res.ok) return;
				const j = await res.json();
				const data = j.summary;
				if (!data) return;

				// Fallback: if hearts missing, derive from current live data
				const livePlayers = ((liveData as any)?.players ?? liveData?.lobby?.players ?? lobbyData.players ?? []) as any[];
				if ((!data.hearts || (data.heartsDebug?.playerCount ?? 0) === 0) && livePlayers.length > 0) {
					const lives = livePlayers.map((p: any) => ({
						name: p.name ?? "Athlete",
						lives: p.livesRemaining ?? p.lives_remaining ?? 0
					}));
					const max = Math.max(...lives.map(l => l.lives));
					const min = Math.min(...lives.map(l => l.lives));
					const leaders = lives.filter(l => l.lives === max).map(l => l.name);
					const low = lives.filter(l => l.lives === min).map(l => l.name);
					data.hearts = { leaders, low, max, min };
					data.heartsDebug = {
						playerCount: lives.length,
						leadersRaw: lives.filter(l => l.lives === max),
						lowRaw: lives.filter(l => l.lives === min)
					};
				}

				setPeriodSummary(data);
				if (shouldShowWeekly && data.weekly) {
					setSummaryPeriod("weekly");
					setSummaryOpen(true);
					setSummarySeenKey(`${keyWeekly}|${weekKey}`);
				} else if (shouldShowDaily && data.daily) {
					setSummaryPeriod("daily");
					setSummaryOpen(true);
					setSummarySeenKey(`${keyDaily}|${dayKey}`);
				}
			} catch {
				// ignore
			}
		})();
	}, [user?.id, lobbyData?.id, liveData?.lobby?.players?.length]);

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

	// Build hearts status data from live players
	const heartsData: AthleteHeartStatus[] = players.map((p) => {
		const initials = (p.name || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
		const hearts = typeof p.livesRemaining === "number" ? p.livesRemaining : (lobbyData.initialLives ?? 3);
		const maxHearts = lobbyData.initialLives ?? 3;
		const weeklyProgress = p.totalWorkouts ?? 0; // TODO(INTEGRATION): wire to weekly workouts count
		const weeklyTarget = lobbyData.weeklyTarget ?? 3;
		const status: "safe" | "at_risk" | "eliminated" = hearts <= 0 ? "eliminated" : hearts === 1 ? "at_risk" : "safe";
		return { name: p.name, initials, hearts, maxHearts, weeklyTarget, weeklyProgress, status };
	});

	// Build standings data from live players
	const standingsData: Standing[] = players
		.filter(p => (p.livesRemaining ?? 1) > 0)
		.sort((a, b) => (b.totalWorkouts ?? 0) - (a.totalWorkouts ?? 0))
		.map((p, i) => ({
			rank: i + 1,
			athleteName: p.name,
			workouts: p.totalWorkouts ?? 0,
			streak: p.currentStreak ?? 0,
			penalties: 0, // TODO(INTEGRATION): wire to penalty count
			points: (p.totalWorkouts ?? 0) + (p.currentStreak ?? 0),
		}));

	// Calculate week info for cycle indicator
	const seasonStartDate = lobbyData.seasonStart ? new Date(lobbyData.seasonStart) : new Date();
	const seasonEndDate = lobbyData.seasonEnd ? new Date(lobbyData.seasonEnd) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
	const totalWeeks = Math.max(1, Math.ceil((seasonEndDate.getTime() - seasonStartDate.getTime()) / (7 * 24 * 60 * 60 * 1000)));
	const currentWeek = Math.max(1, Math.min(totalWeeks, Math.ceil((Date.now() - seasonStartDate.getTime()) / (7 * 24 * 60 * 60 * 1000))));
	const weekEndDate = new Date(seasonStartDate.getTime() + currentWeek * 7 * 24 * 60 * 60 * 1000);

	// Determine host controls match status
	const matchStatus: "AWAITING_HOST" | "ARMED" | "ACTIVE" | "COMPLETED" = 
		stage === "COMPLETED" || seasonStatus === "completed" ? "COMPLETED" :
		stage === "ACTIVE" || seasonStatus === "active" ? "ACTIVE" :
		"AWAITING_HOST";

	return (
		<div className="min-h-screen">
			<div className="container mx-auto px-4 py-8 space-y-8">
				<ActiveSeasonHeader
					seasonName={lobbyData.name}
					seasonNumber={lobbyData.seasonNumber}
					gameMode={modeLabel}
					hostName={ownerName}
					athleteCount={players.length}
				/>

				{/* Weekly Cycle Indicator */}
				{stage !== "COMPLETED" && (
					<WeeklyCycleIndicator
						currentWeek={currentWeek}
						totalWeeks={totalWeeks}
						weekEndDate={weekEndDate}
						resetDay="MONDAY"
					/>
				)}

				<div className="flex flex-wrap items-center gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={async () => {
							if (typeof window === "undefined") return;
							const shareUrl = `${window.location.origin}/onboard/${lobbyData.id}`;
							const text = `${ownerName} is inviting you to the Deathmatch — ${lobbyData.name}. Join now:`;
							try {
								if (navigator.share) {
									await navigator.share({
										title: "Gym Deathmatch",
										text: text,
										url: shareUrl,
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
						Share Lobby
					</Button>
					{isOwner && (
						<Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
							Edit Lobby
						</Button>
					)}
				</div>

				{isChallengeMode && weekStatus === "PENDING_CONFIRMATION" && activePunishment ? (
					<div className="space-y-6">
						<WeekSetup
							lobbyId={lobbyData.id}
							week={activePunishment.week}
							punishmentText={activePunishment.text}
							mode={mode as any}
							challengeSettings={lobbyData.challengeSettings || null}
							players={players}
							isOwner={isOwner}
						/>
						<LiveFeed lobbyId={lobbyData.id} />
					</div>
				) : (
					<div className="grid lg:grid-cols-3 gap-6">
						<div className="lg:col-span-2 space-y-6">
							{/* Hearts & Status Board - Arena-style */}
							<HeartsStatusBoard athletes={heartsData} />

							{/* Live Feed */}
							<LiveFeed lobbyId={lobbyData.id} />

							{/* Player Cards Grid */}
							{!(isChallengeMode && weekStatus === "PENDING_CONFIRMATION") && (
								<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 items-stretch">
									{players.map((p) => (
										<motion.div key={p.id} variants={item} className="h-full">
											<PlayerCard
												player={p}
												lobbyId={lobbyData.id}
												mePlayerId={myPlayerId || undefined}
												showReady={false}
											/>
										</motion.div>
									))}
								</div>
							)}
						</div>
						<div className="space-y-6">
							{/* Pot & Stakes Panel */}
							{stage !== "COMPLETED" && isMoneyMode && (
								<div className="space-y-3">
									<PotStakesPanel currentPot={potAmount} weeklyAnte={weeklyAnte} gameMode={potGameMode} />
									{isOwner && (
										<Button
											variant="arenaPrimary"
											size="sm"
											onClick={async () => {
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
														body: JSON.stringify({ targetPot: target }),
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
										>
											Update Pot
										</Button>
									)}
								</div>
							)}

							{/* Standings Panel */}
							{standingsData.length > 0 && (
								<Standings standings={standingsData} />
							)}

							{/* Challenge Mode Hero */}
							{stage !== "COMPLETED" && isChallengeMode && (
								<ChallengeHero
									lobbyId={lobbyData.id}
									mode={mode as any}
									challengeSettings={lobbyData.challengeSettings || null}
									seasonStart={lobbyData.seasonStart}
									seasonEnd={lobbyData.seasonEnd}
								/>
							)}

							{/* Host Controls */}
							{isOwner && (
								<HostControls
									isHost={isOwner}
									matchStatus={matchStatus}
									onSettings={() => setEditOpen(true)}
									onEndSeason={async () => {
										if (!confirm("Are you sure you want to end this season early?")) return;
										try {
											const res = await fetch(`/api/lobby/${encodeURIComponent(lobbyData.id)}/end-season`, {
												method: "POST",
												headers: { "Content-Type": "application/json", "x-user-id": user?.id || "" },
											});
											if (res.ok) {
												toast.push("Season ended");
												onRefresh?.();
											} else {
												toast.push("Failed to end season");
											}
										} catch {
											toast.push("Failed to end season");
										}
									}}
								/>
							)}
						</div>
					</div>
				)}
			</div>
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
			<PeriodSummaryOverlay
				open={summaryOpen}
				onClose={() => {
					setSummaryOpen(false);
					if (summarySeenKey && typeof window !== "undefined") {
						const [k, v] = summarySeenKey.split("|");
						if (k && v) localStorage.setItem(k, v);
					}
				}}
				data={periodSummary}
				period={summaryPeriod}
			/>
			{/* Owner Celebrate Again button */}
			{isOwner && seasonStatus === "completed" && !!koEvent?.winnerPlayerId && (
				<div className="fixed bottom-3 right-3 z-[90]">
					<button className="arena-badge arena-badge-primary px-3 py-2 text-xs" onClick={() => setShowWinner(true)}>
						CELEBRATE AGAIN
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
