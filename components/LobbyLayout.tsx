"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { Lobby } from "@/types/game";
import { LiveLobbyResponse } from "@/types/api";
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
import { HeartsStatusBoard, type AthleteHeartStatus } from "@/src/ui2/components/HeartsStatusBoard";
import { Standings, type Standing } from "@/src/ui2/components/Standings";
import { HostControls } from "@/src/ui2/components/HostControls";
import { WeeklyCycleIndicator } from "@/src/ui2/components/WeeklyCycleIndicator";
import { Button } from "@/src/ui2/ui/button";
import { authFetch } from "@/lib/clientAuth";
import { calculatePoints, compareByPointsDesc, POINTS_FORMULA_TEXT } from "@/lib/points";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/src/ui2/ui/dialog";
import { ManualActivityModal } from "./ManualActivityModal";

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

	// Local UI state
	const [weekStatus, setWeekStatus] = useState<string | null>(null);
	const [activePunishment, setActivePunishment] = useState<{
		text: string;
		week: number;
		createdBy?: string | null;
	} | null>(null);
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
	const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
	const [openManual, setOpenManual] = useState(false);

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
				const res = await authFetch(`/api/lobby/${encodeURIComponent(lobbyData.id)}/summary`, { cache: "no-store" });
				if (!res.ok) return;
				const j = await res.json();
				const data = j.summary;
				if (!data) return;

				// Keep hearts summary aligned with the latest live player projection.
				const livePlayers = ((liveData as any)?.players ?? liveData?.lobby?.players ?? lobbyData.players ?? []) as any[];
				if (livePlayers.length > 0) {
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
				if (livePlayers.length > 0) {
					const leaderboard = [...livePlayers]
						.map((p: any) => {
							const workouts = Number(p.totalWorkouts ?? 0);
							const streak = Number(p.currentStreak ?? 0);
							return {
								name: p.name ?? "Athlete",
								workouts,
								streak,
								points: calculatePoints({ workouts, streak })
							};
						})
						.sort(compareByPointsDesc)
						.slice(0, 3);
					data.points = {
						formula: `Season ${POINTS_FORMULA_TEXT.toLowerCase()}`,
						leaderboard
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

	// Load week status and active punishment for challenge modes (still polling separately for now)
	useEffect(() => {
		if (!String(mode || "").startsWith("CHALLENGE_")) return;
		let cancelled = false;
			async function load() {
				try {
					const res = await authFetch(`/api/lobby/${encodeURIComponent(lobbyData.id)}/punishments`, { cache: "no-store" });
					if (!res.ok || cancelled) return;
					const j = await res.json();
				if (j.active && j.weekStatus) {
					setWeekStatus(j.weekStatus);
					setActivePunishment({
						text: j.active.text,
						week: j.week,
						createdBy: j.active.created_by ?? null
					});
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
						await authFetch("/api/user/sync", {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({
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
		const weeklyTarget = lobbyData.weeklyTarget ?? 3;
		const weeklyProgress = (() => {
			const timeline = Array.isArray(p.heartsTimeline) ? p.heartsTimeline : [];
			if (!timeline.length) return 0;
			const seasonStartRaw = lobbyData.seasonStart;
			if (!seasonStartRaw) {
				return timeline[timeline.length - 1]?.workouts ?? 0;
			}
			const seasonStart = new Date(seasonStartRaw);
			if (Number.isNaN(seasonStart.getTime())) {
				return timeline[timeline.length - 1]?.workouts ?? 0;
			}
			const msPerDay = 24 * 60 * 60 * 1000;
			const msPerWeek = 7 * msPerDay;
			const seasonStartMidnight = new Date(seasonStart.getFullYear(), seasonStart.getMonth(), seasonStart.getDate()).getTime();
			const now = new Date();
			const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
			const weekIndex = Math.max(0, Math.floor((nowMidnight - seasonStartMidnight) / msPerWeek));
			const event = timeline[weekIndex] ?? timeline[timeline.length - 1];
			return event?.workouts ?? 0;
		})();
		const status: "safe" | "at_risk" | "eliminated" = hearts <= 0 ? "eliminated" : hearts === 1 ? "at_risk" : "safe";
		return {
			id: p.id,
			name: p.name,
			initials,
			avatarUrl: p.avatarUrl || null,
			hearts,
			maxHearts,
			weeklyTarget,
			weeklyProgress,
			status,
			totalWorkouts: p.totalWorkouts ?? 0,
			currentStreak: p.currentStreak ?? 0,
			averageWorkoutsPerWeek: p.averageWorkoutsPerWeek ?? 0,
			longestStreak: p.longestStreak ?? 0,
			quip: p.quip ?? "",
		};
	});

	// Build standings data from live players
	const standingsData: Standing[] = players
		.filter(p => (p.livesRemaining ?? 1) > 0)
		.map((p) => {
			const workouts = p.totalWorkouts ?? 0;
			const streak = p.currentStreak ?? 0;
			const penalties = 0;
			return {
				athleteName: p.name,
				avatarUrl: p.avatarUrl || null,
				workouts,
				streak,
				penalties,
				points: calculatePoints({ workouts, streak, penalties }),
			};
		})
		.sort(compareByPointsDesc)
		.map((standing, i) => ({ ...standing, rank: i + 1 }));

	const activePunishmentMeta = useMemo(() => {
		if (!activePunishment) return null;
		const from = players.find((p) => {
			const createdBy = activePunishment.createdBy || "";
			return p.id === createdBy || ((p as any).userId && (p as any).userId === createdBy);
		});
		return {
			text: activePunishment.text,
			week: activePunishment.week,
			submittedByName: from?.name ?? null,
			submittedByAvatarUrl: from?.avatarUrl ?? null
		};
	}, [activePunishment, players]);

	const selectedPlayer = selectedPlayerId ? players.find((p) => p.id === selectedPlayerId) ?? null : null;

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
					currentPot={potAmount}
					weeklyAnte={weeklyAnte}
					showMoneyInfo={isMoneyMode && stage !== "COMPLETED"}
					seasonStart={lobbyData.seasonStart}
					seasonEnd={lobbyData.seasonEnd}
					showCountdown={stage !== "COMPLETED"}
					showChallengeInfo={mode === "CHALLENGE_ROULETTE" && stage !== "COMPLETED"}
					challengePunishment={activePunishmentMeta}
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
					{myPlayerId && stage !== "COMPLETED" && (
						<Button variant="arenaPrimary" size="sm" onClick={() => setOpenManual(true)}>
							Log Workout
						</Button>
					)}
					<Button
						variant="outline"
						size="sm"
						onClick={async () => {
							if (typeof window === "undefined") return;
							if (lobbyData.inviteEnabled === false) {
								toast.push("Invites are disabled. Enable them in Edit Lobby.");
								return;
							}
							let inviteToken: string | null = null;
							try {
								const accessRes = await authFetch(`/api/lobby/${encodeURIComponent(lobbyData.id)}/access-state`, { cache: "no-store" });
								if (accessRes.ok) {
									const accessData = await accessRes.json();
									inviteToken = typeof accessData?.inviteToken === "string" ? accessData.inviteToken : null;
								}
							} catch {
								// fallback to non-token link below
							}
							if (lobbyData.inviteTokenRequired === true && !inviteToken) {
								toast.push("Unable to generate secure invite link right now.");
								return;
							}
							const tokenQuery = inviteToken ? `?t=${encodeURIComponent(inviteToken)}` : "";
							const shareUrl = `${window.location.origin}/onboard/${lobbyData.id}${tokenQuery}`;
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
					{isOwner && isMoneyMode && stage !== "COMPLETED" && (
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
									const res = await authFetch(`/api/lobby/${encodeURIComponent(lobbyData.id)}/pot`, {
										method: "POST",
										headers: { "Content-Type": "application/json" },
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
					<div className="space-y-6">
						<LiveFeed lobbyId={lobbyData.id} />

						<div className="grid lg:grid-cols-3 gap-6">
						<div className="lg:col-span-2 space-y-6">
							{/* Hearts & Status Board - Arena-style */}
							<HeartsStatusBoard
								athletes={heartsData}
								onAthleteSelect={(athleteId) => setSelectedPlayerId(athleteId)}
							/>
						</div>
						<div className="space-y-6">
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
										isOwner={isOwner}
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
											const res = await authFetch(`/api/lobby/${encodeURIComponent(lobbyData.id)}/end-season`, {
												method: "POST",
												headers: { "Content-Type": "application/json" },
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
					</div>
				)}
			</div>
			<Dialog open={!!selectedPlayer} onOpenChange={(open) => { if (!open) setSelectedPlayerId(null); }}>
				<DialogContent className="w-[95vw] max-w-3xl p-4 sm:p-6 border-2">
					<DialogHeader className="sr-only">
						<DialogTitle>
							{selectedPlayer ? `${selectedPlayer.name} athlete details` : "Athlete details"}
						</DialogTitle>
						<DialogDescription>Full athlete card with workout logging and profile stats.</DialogDescription>
					</DialogHeader>
					{selectedPlayer && (
						<PlayerCard
							player={selectedPlayer}
							lobbyId={lobbyData.id}
							mePlayerId={myPlayerId || undefined}
							showReady={false}
						/>
					)}
				</DialogContent>
			</Dialog>
			{myPlayerId && (
				<ManualActivityModal
					open={openManual}
					onClose={() => setOpenManual(false)}
					lobbyId={lobbyData.id}
					onSaved={() => {
						setOpenManual(false);
						onRefresh?.();
					}}
				/>
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
