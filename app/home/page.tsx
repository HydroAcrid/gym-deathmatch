"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { IntroGuide } from "@/components/IntroGuide";
import { WhatsNewDialog } from "@/components/WhatsNewDialog";
import { useLastLobbySnapshot } from "@/hooks/useLastLobby";
import { authFetch } from "@/lib/clientAuth";
import {
	HOME_COMPLIANCE_COLLAPSED_PREFIX,
	LOBBY_INTERACTIONS_STORAGE_KEY,
	WHATS_NEW_SEEN_RELEASE_KEY,
	type LobbyInteractionsSnapshot,
} from "@/lib/localStorageKeys";
import { calculatePoints, compareByPointsDesc } from "@/lib/points";
import { getLatestWhatsNewEntry, getWhatsNewData, type WhatsNewEntry } from "@/lib/whatsNew";
import { mapLobbyRowToCard } from "@/src/ui2/adapters/lobby";
import { LobbyCard } from "@/src/ui2/components/LobbyCard";
import type { LiveLobbyResponse, LobbyPunishmentsResponse } from "@/types/api";

type LobbyRow = {
	id: string;
	name: string;
	season_number: number;
	cash_pool: number;
	season_start?: string;
	season_end?: string;
	weekly_target?: number;
	initial_lives?: number;
	owner_user_id?: string;
	created_at?: string;
	status?: string;
	mode?: string;
	player_count?: number;
};

type ChallengeHighlight = {
	text: string;
	week?: number | null;
	weekStatus?: string | null;
	isError?: boolean;
};

type HomeSnapshotV2 = {
	rank: number | null;
	points: number;
	hearts: number;
	currentStreak: number;
	athleteCount: number;
	workoutsThisWeek: number;
	weeklyTarget: number;
	targetProgressPct: number;
	stageLabel: string;
	weekLabel: string;
	weekTimeLeftLabel: string;
	seasonClockText: string;
	modeLabel: string;
	modeFamily: "money" | "challenge";
	currentPot: number;
	weeklyAnte: number;
	attentionLine: string;
};

function formatStageLabel(stage?: string | null, seasonStatus?: string | null): string {
	if (stage === "COMPLETED" || seasonStatus === "completed") return "COMPLETED";
	if (
		stage === "PRE_STAGE" ||
		seasonStatus === "pending" ||
		seasonStatus === "scheduled" ||
		seasonStatus === "transition_spin"
	) {
		return "PRE-STAGE";
	}
	return "ACTIVE";
}

function formatModeLabel(mode?: string | null): string {
	return String(mode || "MONEY_SURVIVAL").replace(/_/g, " ");
}

function formatCurrency(value: number): string {
	return `$${Math.max(0, Number.isFinite(value) ? value : 0).toLocaleString()}`;
}

function formatWeekRemaining(weekEndMs: number, nowMs: number): string {
	if (!Number.isFinite(weekEndMs)) return "--";
	const diff = Math.max(0, weekEndMs - nowMs);
	const days = Math.floor(diff / (24 * 60 * 60 * 1000));
	const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
	if (days > 0) return `${days}D ${hours}H LEFT`;
	if (hours > 0) return `${hours}H LEFT`;
	const minutes = Math.max(1, Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000)));
	return `${minutes}M LEFT`;
}

function toMs(value?: string): number {
	if (!value) return 0;
	const ms = new Date(value).getTime();
	return Number.isFinite(ms) ? ms : 0;
}

function readInteractionSnapshot(raw: string | null): LobbyInteractionsSnapshot {
	if (!raw) return {};
	try {
		const parsed = JSON.parse(raw) as unknown;
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
		const entries: Array<[string, string]> = Object.entries(parsed as Record<string, unknown>).flatMap(
			([id, ts]) => (typeof ts === "string" && Number.isFinite(toMs(ts)) ? [[id, ts]] : [])
		);
		return Object.fromEntries(entries) as LobbyInteractionsSnapshot;
	} catch {
		return {};
	}
}

type WeekWindow = {
	currentWeek: number;
	totalWeeks: number;
	weekStartMs: number;
	weekEndMs: number;
	weekLabel: string;
	weekTimeLeftLabel: string;
};

function resolveWeekWindow(seasonStartIso?: string, seasonEndIso?: string): WeekWindow | null {
	const seasonStartMs = toMs(seasonStartIso);
	const seasonEndMs = toMs(seasonEndIso);
	if (!Number.isFinite(seasonStartMs) || !Number.isFinite(seasonEndMs) || seasonEndMs <= seasonStartMs) return null;
	const nowMs = Date.now();
	const weekMs = 7 * 24 * 60 * 60 * 1000;
	const totalWeeks = Math.max(1, Math.ceil((seasonEndMs - seasonStartMs) / weekMs));
	const rawWeek = Math.ceil((nowMs - seasonStartMs) / weekMs);
	const currentWeek = Math.min(totalWeeks, Math.max(1, rawWeek));
	const weekStartMs = seasonStartMs + (currentWeek - 1) * weekMs;
	const weekEndMs = weekStartMs + weekMs;
	return {
		currentWeek,
		totalWeeks,
		weekStartMs,
		weekEndMs,
		weekLabel: `WEEK ${currentWeek}/${totalWeeks}`,
		weekTimeLeftLabel: formatWeekRemaining(weekEndMs, nowMs),
	};
}

function resolveWorkoutsThisWeek(heartsTimeline: Array<{ weekStart: string; workouts: number }> | undefined, week: WeekWindow | null): number {
	if (!week || !Array.isArray(heartsTimeline) || heartsTimeline.length === 0) return 0;
	const nowMs = Date.now();
	const currentByRange = heartsTimeline.find((evt) => {
		const start = toMs(evt.weekStart);
		if (!Number.isFinite(start)) return false;
		const end = start + 7 * 24 * 60 * 60 * 1000;
		return nowMs >= start && nowMs < end;
	});
	if (currentByRange && Number.isFinite(currentByRange.workouts)) {
		return Math.max(0, currentByRange.workouts);
	}
	const indexed = heartsTimeline[week.currentWeek - 1];
	if (indexed && Number.isFinite(indexed.workouts)) {
		return Math.max(0, indexed.workouts);
	}
	return 0;
}

function deriveHomeSnapshotV2(liveData: LiveLobbyResponse | null, userId?: string): HomeSnapshotV2 | null {
	if (!userId || !liveData?.lobby?.players?.length) return null;
	const players = liveData.lobby.players;
	const me = players.find((player) => (player.userId ?? player.user_id ?? null) === userId);
	if (!me) return null;

	const standings = [...players]
		.map((player) => ({
			id: player.id,
			points: calculatePoints({
				workouts: player.totalWorkouts ?? 0,
				streak: player.currentStreak ?? 0,
				longestStreak: player.longestStreak ?? player.currentStreak ?? 0,
				penalties: 0,
			}),
		}))
		.sort(compareByPointsDesc);

	const rankIndex = standings.findIndex((entry) => entry.id === me.id);
	const rank = rankIndex >= 0 ? rankIndex + 1 : null;
	const stageLabel = formatStageLabel(liveData.stage, liveData.seasonStatus);
	const week = resolveWeekWindow(liveData.lobby.seasonStart, liveData.lobby.seasonEnd);
	const weeklyTarget = Math.max(1, liveData.lobby.weeklyTarget ?? 3);
	const workoutsThisWeek = resolveWorkoutsThisWeek(me.heartsTimeline, week);
	const targetProgressPct = Math.max(0, Math.min((workoutsThisWeek / weeklyTarget) * 100, 100));
	const targetRemaining = Math.max(0, weeklyTarget - workoutsThisWeek);
	const mode = String(liveData.lobby.mode ?? "MONEY_SURVIVAL");
	const modeFamily: HomeSnapshotV2["modeFamily"] = mode.startsWith("CHALLENGE_") ? "challenge" : "money";

	let attentionLine = "You’re safe this week.";
	if (stageLabel === "COMPLETED") {
		attentionLine = "Season complete. View final standings.";
	} else if (stageLabel === "PRE-STAGE") {
		attentionLine = "Season not started yet.";
	} else if (targetRemaining > 1) {
		attentionLine = `You are ${targetRemaining} workouts behind target this week.`;
	} else if (targetRemaining === 1) {
		attentionLine = "You are 1 workout behind target this week.";
	}

	return {
		rank,
		points: calculatePoints({
			workouts: me.totalWorkouts ?? 0,
			streak: me.currentStreak ?? 0,
			longestStreak: me.longestStreak ?? me.currentStreak ?? 0,
			penalties: 0,
		}),
		hearts: me.livesRemaining ?? 0,
		currentStreak: me.currentStreak ?? 0,
		athleteCount: players.length,
		workoutsThisWeek,
		weeklyTarget,
		targetProgressPct,
		stageLabel,
		weekLabel: week?.weekLabel ?? "--",
		weekTimeLeftLabel: week?.weekTimeLeftLabel ?? "--",
		seasonClockText: week ? `${week.weekLabel} • ${week.weekTimeLeftLabel}` : "--",
		modeLabel: formatModeLabel(mode),
		modeFamily,
		currentPot: liveData.lobby.cashPool ?? 0,
		weeklyAnte: liveData.lobby.weeklyAnte ?? 10,
		attentionLine,
	};
}

function HomepageCompliancePanel({ userId }: { userId?: string | null }) {
	const [collapsed, setCollapsed] = useState(false);
	const isSignedIn = !!userId;
	const storageKey = userId ? `${HOME_COMPLIANCE_COLLAPSED_PREFIX}:${userId}` : null;

	useEffect(() => {
		if (!isSignedIn || !storageKey || typeof window === "undefined") {
			setCollapsed(false);
			return;
		}
		const saved = window.localStorage.getItem(storageKey);
		setCollapsed(saved === "1");
	}, [isSignedIn, storageKey]);

	const toggleCollapsed = (next: boolean) => {
		setCollapsed(next);
		if (!storageKey || typeof window === "undefined") return;
		window.localStorage.setItem(storageKey, next ? "1" : "0");
	};

	return (
		<div className="scoreboard-panel p-4 sm:p-5 space-y-3">
			<div className="flex items-center justify-between gap-2">
				<div className="font-display text-sm tracking-widest text-primary">ABOUT THIS APP</div>
				{isSignedIn ? (
					<button
						type="button"
						onClick={() => toggleCollapsed(!collapsed)}
						className="arena-badge px-3 py-1.5 text-[10px]"
					>
						{collapsed ? "SHOW DETAILS" : "HIDE DETAILS"}
					</button>
				) : null}
			</div>
			{collapsed ? (
				<div className="flex flex-wrap items-center gap-2">
					<p className="text-xs sm:text-sm text-muted-foreground">
						We use your Google profile identity to manage your player account and lobby membership.
					</p>
					<Link href="/privacy" className="arena-badge px-4 py-2 text-xs">
						PRIVACY POLICY
					</Link>
				</div>
			) : (
				<>
					<p className="text-xs sm:text-sm text-muted-foreground">
						Gym Deathmatch tracks workouts, season standings, and challenge outcomes across your lobbies.
					</p>
					<p className="text-xs sm:text-sm text-muted-foreground">
						When you sign in with Google, we use your account identity (name/email/profile) to create your
						player profile and manage lobby membership.
					</p>
					<div className="pt-1">
						<Link href="/privacy" className="arena-badge px-4 py-2 text-xs">
							PRIVACY POLICY
						</Link>
					</div>
				</>
			)}
		</div>
	);
}

function LatestUpdatePanel({
	entry,
	onOpen,
}: {
	entry: WhatsNewEntry | null;
	onOpen: () => void;
}) {
	return (
		<div className="scoreboard-panel p-4 sm:p-5 space-y-3" id="whats-new">
			<div className="flex items-center justify-between gap-3">
				<div className="font-display text-sm tracking-widest text-primary">LATEST UPDATE</div>
				<button type="button" onClick={onOpen} className="arena-badge arena-badge-primary px-3 py-2 text-xs">
					WHAT&apos;S NEW
				</button>
			</div>
			{entry ? (
				<>
					<div className="flex items-center justify-between gap-2 flex-wrap">
						<div className="font-display text-sm sm:text-base tracking-wider text-foreground">{entry.title}</div>
						<span className="arena-badge arena-badge-primary text-[10px]">{entry.versionLabel}</span>
					</div>
					<ul className="space-y-1">
						{entry.bullets.slice(0, 3).map((bullet, idx) => (
							<li key={`${entry.releaseId}-${idx}`} className="text-xs sm:text-sm text-muted-foreground">
								• {bullet}
							</li>
						))}
					</ul>
				</>
			) : (
				<div className="text-xs sm:text-sm text-muted-foreground">No release notes available yet.</div>
			)}
		</div>
	);
}

export default function HomePage() {
	const { user, isHydrated, signInWithGoogle } = useAuth();
	const lastLobby = useLastLobbySnapshot();
	const [isSigningIn, setIsSigningIn] = useState(false);
	const [liveData, setLiveData] = useState<LiveLobbyResponse | null>(null);
	const [liveLoading, setLiveLoading] = useState(false);
	const [challengeHighlight, setChallengeHighlight] = useState<ChallengeHighlight | null>(null);
	const [allLobbies, setAllLobbies] = useState<LobbyRow[]>([]);
	const [interactionSnapshot, setInteractionSnapshot] = useState<LobbyInteractionsSnapshot>({});
	const [lobbiesLoading, setLobbiesLoading] = useState(false);
	const [nowMs] = useState<number>(() => Date.now());
	const [whatsNewOpen, setWhatsNewOpen] = useState(false);
	const whatsNewData = useMemo(() => getWhatsNewData(), []);
	const latestWhatsNew = useMemo(() => getLatestWhatsNewEntry(whatsNewData), [whatsNewData]);
	const homeSnapshot = useMemo(() => deriveHomeSnapshotV2(liveData, user?.id), [liveData, user?.id]);

	useEffect(() => {
		if (!isHydrated || typeof window === "undefined") return;
		const latestReleaseId = whatsNewData.latestReleaseId;
		if (!latestReleaseId) return;
		const seen = window.localStorage.getItem(WHATS_NEW_SEEN_RELEASE_KEY);
		if (seen !== latestReleaseId) setWhatsNewOpen(true);
	}, [isHydrated, whatsNewData]);

	function handleWhatsNewOpenChange(open: boolean) {
		setWhatsNewOpen(open);
		if (!open && typeof window !== "undefined" && whatsNewData.latestReleaseId) {
			window.localStorage.setItem(WHATS_NEW_SEEN_RELEASE_KEY, whatsNewData.latestReleaseId);
		}
	}

	useEffect(() => {
		if (typeof window === "undefined") return;
		const read = () => {
			setInteractionSnapshot(readInteractionSnapshot(window.localStorage.getItem(LOBBY_INTERACTIONS_STORAGE_KEY)));
		};
		read();
		const handle = () => read();
		window.addEventListener("storage", handle);
		window.addEventListener("gymdm:last-lobby", handle as EventListener);
		return () => {
			window.removeEventListener("storage", handle);
			window.removeEventListener("gymdm:last-lobby", handle as EventListener);
		};
	}, []);

	useEffect(() => {
		let cancelled = false;
		if (!isHydrated || !user || !lastLobby?.id) {
			setLiveData(null);
			setLiveLoading(false);
			return () => {
				cancelled = true;
			};
		}

		(async () => {
			setLiveLoading(true);
			try {
				const response = await authFetch(`/api/lobby/${encodeURIComponent(lastLobby.id)}/live`, {
					cache: "no-store",
				});
				if (!response.ok) {
					if (!cancelled) setLiveData(null);
					return;
				}
				const payload = (await response.json()) as LiveLobbyResponse;
				if (!cancelled) setLiveData(payload);
			} catch {
				if (!cancelled) setLiveData(null);
			} finally {
				if (!cancelled) setLiveLoading(false);
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [isHydrated, user, lastLobby?.id]);

	useEffect(() => {
		let cancelled = false;
		const mode = String(liveData?.lobby?.mode ?? lastLobby?.mode ?? "");
		if (!isHydrated || !user || !lastLobby?.id || !mode.startsWith("CHALLENGE_")) {
			setChallengeHighlight(null);
			return () => {
				cancelled = true;
			};
		}
		(async () => {
			try {
				const response = await authFetch(
					`/api/lobby/${encodeURIComponent(lastLobby.id)}/punishments`,
					{ cache: "no-store" }
				);
				if (!response.ok) {
					if (!cancelled) {
						setChallengeHighlight({
							text: "Challenge state unavailable right now.",
							isError: true,
						});
					}
					return;
				}
				const payload = (await response.json()) as LobbyPunishmentsResponse;
				if (cancelled) return;
				if (payload.active?.text) {
					setChallengeHighlight({
						text: payload.active.text,
						week: payload.active.week ?? payload.week,
						weekStatus: payload.weekStatus ?? payload.active.week_status ?? null,
					});
					return;
				}
				if (payload.weekStatus === "PENDING_PUNISHMENT") {
					setChallengeHighlight({
						text: "Awaiting punishment selection.",
						week: payload.week,
						weekStatus: payload.weekStatus,
					});
					return;
				}
				if (payload.weekStatus === "PENDING_CONFIRMATION") {
					setChallengeHighlight({
						text: "Punishment selected. Waiting for week start.",
						week: payload.week,
						weekStatus: payload.weekStatus,
					});
					return;
				}
				setChallengeHighlight({
					text: "Awaiting roulette spin.",
					week: payload.week,
					weekStatus: payload.weekStatus,
				});
			} catch {
				if (!cancelled) {
					setChallengeHighlight({
						text: "Challenge state unavailable right now.",
						isError: true,
					});
				}
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [isHydrated, user, lastLobby?.id, liveData?.lobby?.mode, lastLobby?.mode]);

	useEffect(() => {
		let cancelled = false;
		if (!isHydrated || !user?.id) {
			setAllLobbies([]);
			setLobbiesLoading(false);
			return () => {
				cancelled = true;
			};
		}

		(async () => {
			setLobbiesLoading(true);
			try {
				const response = await authFetch("/api/lobbies", { cache: "no-store" });
				const body = await response.json().catch(() => ({ lobbies: [] }));
				if (!response.ok) {
					if (!cancelled) setAllLobbies([]);
					return;
				}
				if (!cancelled) {
					const list = Array.isArray(body?.lobbies) ? (body.lobbies as LobbyRow[]) : [];
					setAllLobbies(list);
				}
			} catch {
				if (!cancelled) setAllLobbies([]);
			} finally {
				if (!cancelled) setLobbiesLoading(false);
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [isHydrated, user?.id]);

	const orderedLobbies = useMemo(() => {
		const interactionMsByLobby = new Map(
			Object.entries(interactionSnapshot).map(([id, iso]) => [id, toMs(iso)] as const)
		);
		return [...allLobbies].sort((a, b) => {
			if (lastLobby?.id) {
				if (a.id === lastLobby.id) return -1;
				if (b.id === lastLobby.id) return 1;
			}
			const interactionDiff = (interactionMsByLobby.get(b.id) ?? 0) - (interactionMsByLobby.get(a.id) ?? 0);
			if (interactionDiff !== 0) return interactionDiff;
			return toMs(b.created_at) - toMs(a.created_at);
		});
	}, [allLobbies, interactionSnapshot, lastLobby?.id]);

	function getDaysAgo(createdAt?: string): string | null {
		if (!createdAt) return null;
		const created = new Date(createdAt).getTime();
		if (!Number.isFinite(created)) return null;
		const diffMs = nowMs - created;
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
		if (diffDays <= 0) return "Today";
		if (diffDays === 1) return "1 day ago";
		return `${diffDays} days ago`;
	}

	async function handleGoogleSignIn() {
		if (isSigningIn) return;
		setIsSigningIn(true);
		try {
			await signInWithGoogle();
		} finally {
			setIsSigningIn(false);
		}
	}

	if (!isHydrated) {
		return (
			<div className="min-h-screen">
				<div className="container mx-auto max-w-3xl py-10 px-4 space-y-6">
					<div className="scoreboard-panel p-6 text-sm text-muted-foreground">Loading command hub...</div>
					<LatestUpdatePanel entry={latestWhatsNew} onOpen={() => setWhatsNewOpen(true)} />
					<HomepageCompliancePanel userId={user?.id} />
				</div>
				<WhatsNewDialog
					open={whatsNewOpen}
					onOpenChange={handleWhatsNewOpenChange}
					entry={latestWhatsNew}
					entries={whatsNewData.entries}
				/>
			</div>
		);
	}

	if (user && lastLobby?.id) {
		return (
			<div className="min-h-screen">
				<div className="container mx-auto max-w-3xl py-8 px-4 sm:py-10 space-y-6">
					<div className="scoreboard-panel p-5 sm:p-6 space-y-4">
						<div className="flex items-center justify-between gap-2 flex-wrap">
							<div className="arena-badge arena-badge-primary text-[10px]">LAST LOBBY SNAPSHOT</div>
							{homeSnapshot?.stageLabel ? (
								<div className="arena-badge text-[10px]">{homeSnapshot.stageLabel}</div>
							) : null}
						</div>

						<div className="font-display text-2xl sm:text-3xl tracking-widest leading-tight break-words text-primary">
							{lastLobby.name}
						</div>

						{liveLoading && !homeSnapshot ? (
							<div className="text-xs text-muted-foreground">Syncing live snapshot...</div>
						) : homeSnapshot ? (
							<>
								<div className="grid gap-2 sm:grid-cols-2">
									<div className="min-w-0 border-2 border-border bg-muted/20 px-3 py-2">
										<div className="text-[10px] font-display tracking-widest text-muted-foreground">SEASON CLOCK</div>
										<div className="font-display text-sm tracking-wider text-foreground break-words">
											{homeSnapshot.weekLabel}
										</div>
										<div className="text-[10px] font-display tracking-widest text-muted-foreground break-words">
											{homeSnapshot.weekTimeLeftLabel}
										</div>
									</div>
									<div className="min-w-0 border-2 border-border bg-muted/20 px-3 py-2">
										<div className="text-[10px] font-display tracking-widest text-muted-foreground">MODE</div>
										<div className="font-display text-sm tracking-wider text-foreground break-words [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical] overflow-hidden">
											{homeSnapshot.modeLabel}
										</div>
										<div className="text-[10px] font-display tracking-widest text-muted-foreground">
											{homeSnapshot.athleteCount} ATHLETES
										</div>
									</div>
									<div className="min-w-0 border-2 border-border bg-muted/20 px-3 py-2">
										<div className="text-[10px] font-display tracking-widest text-muted-foreground">YOUR STANDINGS</div>
										<div className="font-display text-lg text-arena-gold">
											{homeSnapshot.rank ? `#${homeSnapshot.rank}` : "--"}
										</div>
										<div className="text-[10px] font-display tracking-widest text-muted-foreground">
											{homeSnapshot.points} PTS
										</div>
									</div>
									<div className="min-w-0 border-2 border-border bg-muted/20 px-3 py-2">
										<div className="text-[10px] font-display tracking-widest text-muted-foreground">HEARTS & STREAK</div>
										<div className="font-display text-lg text-foreground">
											{homeSnapshot.hearts}/3 • {homeSnapshot.currentStreak}
										</div>
										<div className="text-[10px] font-display tracking-widest text-muted-foreground">CURRENT STREAK</div>
									</div>
									<div className="min-w-0 border-2 border-border bg-muted/20 px-3 py-2 sm:col-span-2">
										<div className="flex items-center justify-between gap-2 flex-wrap">
											<div className="text-[10px] font-display tracking-widest text-muted-foreground">TARGET PROGRESS</div>
											<div className="text-[10px] font-display tracking-widest text-foreground">
												{homeSnapshot.workoutsThisWeek}/{homeSnapshot.weeklyTarget}
											</div>
										</div>
										<div className="mt-2 h-2.5 w-full border border-border bg-muted/70 overflow-hidden">
											<div
												className="h-full transition-[width] duration-300"
												style={{
													width: `${homeSnapshot.targetProgressPct}%`,
													background:
														"linear-gradient(90deg, hsl(var(--primary) / 0.55), hsl(var(--primary) / 0.95))",
													boxShadow: "0 0 12px hsl(var(--primary) / 0.65)",
												}}
											/>
										</div>
									</div>
								</div>

								<div className="min-w-0 border-2 border-border bg-muted/10 px-3 py-3 space-y-1">
									<div className="text-[10px] font-display tracking-widest text-muted-foreground">
										{homeSnapshot.modeFamily === "money" ? "POT SNAPSHOT" : "CHALLENGE SNAPSHOT"}
									</div>
									{homeSnapshot.modeFamily === "money" ? (
										<div className="font-display text-sm tracking-wider text-foreground break-words [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical] overflow-hidden">
											Current pot {formatCurrency(homeSnapshot.currentPot)} • Ante{" "}
											{formatCurrency(homeSnapshot.weeklyAnte)}/WK
										</div>
									) : (
										<div
											className={`font-display text-sm tracking-wider break-words [display:-webkit-box] [-webkit-line-clamp:3] [-webkit-box-orient:vertical] overflow-hidden ${
												challengeHighlight?.isError ? "text-muted-foreground" : "text-foreground"
											}`}
										>
											{challengeHighlight?.text || "Awaiting roulette spin."}
											{challengeHighlight?.week ? ` • WEEK ${challengeHighlight.week}` : ""}
										</div>
									)}
								</div>

								<div className="border-2 border-primary/40 bg-primary/10 px-3 py-2">
									<div className="text-xs sm:text-sm text-foreground [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical] overflow-hidden">
										{homeSnapshot.attentionLine}
									</div>
								</div>
							</>
						) : (
							<div className="text-xs text-muted-foreground">
								No live snapshot yet. Open the lobby to refresh current standings.
							</div>
						)}

						<div className="flex gap-3 flex-wrap">
							<Link
								href={`/lobby/${encodeURIComponent(lastLobby.id)}`}
								className="arena-badge arena-badge-primary px-4 py-2"
							>
								OPEN NOW
							</Link>
							<Link href="/lobbies" className="arena-badge px-4 py-2">
								CHOOSE ANOTHER
							</Link>
							<Link href={`/lobby/${encodeURIComponent(lastLobby.id)}/history`} className="arena-badge px-4 py-2">
								RECENT ACTIVITY
							</Link>
						</div>
					</div>

					<LatestUpdatePanel entry={latestWhatsNew} onOpen={() => setWhatsNewOpen(true)} />
					<HomepageCompliancePanel userId={user.id} />
				</div>
				<WhatsNewDialog
					open={whatsNewOpen}
					onOpenChange={handleWhatsNewOpenChange}
					entry={latestWhatsNew}
					entries={whatsNewData.entries}
				/>
			</div>
		);
	}

	if (!user) {
		return (
			<div className="min-h-screen">
				<div className="container mx-auto max-w-3xl py-6 px-4 sm:py-10 space-y-6">
					<div className="scoreboard-panel p-5 sm:p-6 space-y-4">
						<div className="font-display text-2xl sm:text-3xl tracking-widest text-primary">
							WELCOME TO THE ARENA
						</div>
						<p className="text-sm text-muted-foreground">
							Start here on mobile: sign in, run the quick tutorial, then jump into your lobbies.
						</p>
						<div className="grid gap-3 sm:grid-cols-2">
							<button
								type="button"
								onClick={handleGoogleSignIn}
								disabled={isSigningIn}
								className="arena-badge arena-badge-primary px-4 py-3 text-center text-sm min-h-[48px] disabled:opacity-70"
							>
								{isSigningIn ? "CONNECTING..." : "CONTINUE WITH GOOGLE"}
							</button>
							<IntroGuide>
								<button type="button" className="arena-badge px-4 py-3 text-center text-sm min-h-[48px] w-full">
									VIEW TUTORIAL
								</button>
							</IntroGuide>
						</div>
						<div className="flex gap-3 flex-wrap pt-1">
							<Link href="/rules" className="arena-badge px-4 py-2">
								READ RULES
							</Link>
							<button type="button" onClick={() => setWhatsNewOpen(true)} className="arena-badge px-4 py-2">
								WHAT&apos;S NEW
							</button>
							<Link href="/privacy" className="arena-badge px-4 py-2">
								PRIVACY POLICY
							</Link>
						</div>
					</div>
					<LatestUpdatePanel entry={latestWhatsNew} onOpen={() => setWhatsNewOpen(true)} />
					<HomepageCompliancePanel />
				</div>
				<WhatsNewDialog
					open={whatsNewOpen}
					onOpenChange={handleWhatsNewOpenChange}
					entry={latestWhatsNew}
					entries={whatsNewData.entries}
				/>
			</div>
		);
	}

	return (
		<div className="min-h-screen">
			<div className="container mx-auto max-w-5xl py-6 px-4 sm:py-10 space-y-6">
				<div className="scoreboard-panel p-5 sm:p-6">
					<div className="font-display text-2xl sm:text-3xl tracking-widest text-primary">COMMAND HUB</div>
					<p className="mt-2 text-sm text-muted-foreground">
						Resume your arena fast, then jump to full lobby management when needed.
					</p>
				</div>

				<div className="grid gap-6 lg:grid-cols-3">
					<div className="scoreboard-panel p-5 space-y-4 lg:col-span-2">
						<div className="flex items-center justify-between gap-2">
							<div className="font-display text-lg tracking-widest text-foreground">CONTINUE LOBBY</div>
						</div>

						{lastLobby?.id ? (
							<>
								<div className="font-display text-2xl tracking-widest text-primary">{lastLobby.name}</div>
								{liveLoading ? (
									<div className="text-xs text-muted-foreground">Syncing live snapshot...</div>
								) : homeSnapshot ? (
									<div className="grid gap-2 sm:grid-cols-2">
										<div className="border-2 border-border bg-muted/20 px-3 py-2">
											<div className="text-[10px] font-display tracking-widest text-muted-foreground">YOUR RANK</div>
											<div className="font-display text-lg text-arena-gold">
												{homeSnapshot.rank ? `#${homeSnapshot.rank}` : "--"}
											</div>
											<div className="text-[10px] font-display tracking-widest text-muted-foreground">
												{homeSnapshot.points} PTS
											</div>
										</div>
										<div className="border-2 border-border bg-muted/20 px-3 py-2">
											<div className="text-[10px] font-display tracking-widest text-muted-foreground">HEARTS</div>
											<div className="font-display text-lg text-foreground">{homeSnapshot.hearts}/3</div>
											<div className="text-[10px] font-display tracking-widest text-muted-foreground">
												{homeSnapshot.athleteCount} ATHLETES
											</div>
										</div>
										<div className="border-2 border-border bg-muted/20 px-3 py-2 sm:col-span-2">
											<div className="text-[10px] font-display tracking-widest text-muted-foreground">SEASON CLOCK</div>
											<div className="font-display text-sm tracking-wider text-foreground">{homeSnapshot.seasonClockText}</div>
										</div>
									</div>
								) : (
									<div className="text-xs text-muted-foreground">
										No live snapshot yet. Open the lobby to refresh current standings.
									</div>
								)}
								<div className="flex flex-wrap gap-2">
									<Link
										href={`/lobby/${encodeURIComponent(lastLobby.id)}`}
										className="arena-badge arena-badge-primary px-4 py-2"
									>
										OPEN LOBBY
									</Link>
									<Link href={`/lobby/${encodeURIComponent(lastLobby.id)}/history`} className="arena-badge px-4 py-2">
										RECENT ACTIVITY
									</Link>
									<Link href="/lobbies" className="arena-badge px-4 py-2">
										VIEW ALL LOBBIES
									</Link>
								</div>
							</>
						) : (
							<>
								<p className="text-sm text-muted-foreground">
									No recent lobby yet. Browse your lobbies to pick one and start tracking.
								</p>
								<div className="flex flex-wrap gap-2">
									<Link href="/lobbies" className="arena-badge arena-badge-primary px-4 py-2">
										GO TO LOBBIES
									</Link>
								</div>
							</>
						)}
					</div>

					<div className="scoreboard-panel p-5 space-y-3">
						<div className="font-display text-base tracking-widest text-foreground">QUICK ROUTES</div>
						<Link href="/lobbies" className="arena-badge arena-badge-primary w-full justify-center px-4 py-2">
							LOBBIES
						</Link>
						<Link href="/rules" className="arena-badge w-full justify-center px-4 py-2">
							RULES
						</Link>
						<Link
							href={lastLobby?.id ? `/lobby/${encodeURIComponent(lastLobby.id)}/history` : "/history"}
							className="arena-badge w-full justify-center px-4 py-2"
						>
							HISTORY
						</Link>
						<button
							type="button"
							onClick={() => setWhatsNewOpen(true)}
							className="arena-badge w-full justify-center px-4 py-2"
						>
							WHAT&apos;S NEW
						</button>
						<p className="text-xs text-muted-foreground">
							Lobbies is your full directory and management view. This hub is your fast resume surface.
						</p>
					</div>
				</div>

				<LatestUpdatePanel entry={latestWhatsNew} onOpen={() => setWhatsNewOpen(true)} />

				<div className="scoreboard-panel p-5 space-y-4">
					<div className="flex items-center justify-between gap-2">
						<div className="font-display text-lg tracking-widest text-foreground">QUICK SWITCH LOBBIES</div>
						<span className="text-xs text-muted-foreground font-display tracking-wider">{orderedLobbies.length} TOTAL</span>
					</div>

					{lobbiesLoading ? (
						<div className="text-sm text-muted-foreground">Loading your lobby list...</div>
					) : orderedLobbies.length === 0 ? (
						<div className="text-sm text-muted-foreground">
							No joined lobbies yet. Create one or join from the lobbies directory.
						</div>
					) : (
						<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
							{orderedLobbies.map((lobby) => {
								const card = mapLobbyRowToCard(lobby, {
									userId: user?.id ?? undefined,
									createdAgo: getDaysAgo(lobby.created_at),
								});
								return <LobbyCard key={lobby.id} lobby={card} showLeave={false} />;
							})}
						</div>
					)}
				</div>

				<HomepageCompliancePanel userId={user.id} />

				<WhatsNewDialog
					open={whatsNewOpen}
					onOpenChange={handleWhatsNewOpenChange}
					entry={latestWhatsNew}
					entries={whatsNewData.entries}
				/>
			</div>
		</div>
	);
}
