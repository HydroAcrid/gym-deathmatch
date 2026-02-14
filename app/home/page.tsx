"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { IntroGuide } from "@/components/IntroGuide";
import { useLastLobbySnapshot } from "@/hooks/useLastLobby";
import { authFetch } from "@/lib/clientAuth";
import type { LiveLobbyResponse } from "@/types/api";
import { calculatePoints, compareByPointsDesc } from "@/lib/points";
import { LobbyCard } from "@/src/ui2/components/LobbyCard";
import { mapLobbyRowToCard } from "@/src/ui2/adapters/lobby";
import { LOBBY_INTERACTIONS_STORAGE_KEY, type LobbyInteractionsSnapshot } from "@/lib/localStorageKeys";

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

type HomeSnapshot = {
	rank: number | null;
	points: number;
	hearts: number;
	weekText: string;
	stageLabel: string;
	athleteCount: number;
};

function formatStageLabel(stage?: string | null, seasonStatus?: string | null): string {
	if (stage === "COMPLETED" || seasonStatus === "completed") return "COMPLETED";
	if (stage === "PRE_STAGE" || seasonStatus === "pending" || seasonStatus === "scheduled") return "PRE-STAGE";
	return "ACTIVE";
}

function formatWeekRemaining(weekEndMs: number, nowMs: number): string {
	if (!Number.isFinite(weekEndMs)) return "--";
	const diff = Math.max(0, weekEndMs - nowMs);
	const days = Math.floor(diff / (24 * 60 * 60 * 1000));
	const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
	if (days > 0) return `${days}D ${hours}H`;
	if (hours > 0) return `${hours}H`;
	const minutes = Math.max(1, Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000)));
	return `${minutes}M`;
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
		const entries = Object.entries(parsed as Record<string, unknown>).filter(
			([id, ts]) => typeof id === "string" && typeof ts === "string" && Number.isFinite(toMs(ts))
		);
		return Object.fromEntries(entries);
	} catch {
		return {};
	}
}

export default function HomePage() {
	const { user, isHydrated, signInWithGoogle } = useAuth();
	const lastLobby = useLastLobbySnapshot();
	const [isSigningIn, setIsSigningIn] = useState(false);
	const [liveData, setLiveData] = useState<LiveLobbyResponse | null>(null);
	const [liveLoading, setLiveLoading] = useState(false);
	const [allLobbies, setAllLobbies] = useState<LobbyRow[]>([]);
	const [interactionSnapshot, setInteractionSnapshot] = useState<LobbyInteractionsSnapshot>({});
	const [lobbiesLoading, setLobbiesLoading] = useState(false);
	const [nowMs] = useState<number>(() => Date.now());

	useEffect(() => {
		if (typeof window === "undefined") return;
		const read = () => {
			setInteractionSnapshot(
				readInteractionSnapshot(window.localStorage.getItem(LOBBY_INTERACTIONS_STORAGE_KEY))
			);
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

	const mySnapshot = useMemo<HomeSnapshot | null>(() => {
		if (!user?.id || !liveData?.lobby?.players?.length) return null;
		const players = liveData.lobby.players;
		const me = players.find((player) => player.userId === user.id);
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
				workouts: player.totalWorkouts ?? 0,
				streak: player.currentStreak ?? 0,
				longestStreak: player.longestStreak ?? player.currentStreak ?? 0,
			}))
			.sort(compareByPointsDesc);

		const rankIndex = standings.findIndex((entry) => entry.id === me.id);
		const rank = rankIndex >= 0 ? rankIndex + 1 : null;
		const nowMs = Date.now();
		const seasonStartMs = new Date(liveData.lobby.seasonStart).getTime();
		const seasonEndMs = new Date(liveData.lobby.seasonEnd).getTime();
		const weekMs = 7 * 24 * 60 * 60 * 1000;

		let weekText = "--";
		if (Number.isFinite(seasonStartMs) && Number.isFinite(seasonEndMs) && seasonEndMs > seasonStartMs) {
			const totalWeeks = Math.max(1, Math.ceil((seasonEndMs - seasonStartMs) / weekMs));
			const rawWeek = Math.ceil((nowMs - seasonStartMs) / weekMs);
			const currentWeek = Math.min(totalWeeks, Math.max(1, rawWeek));
			const weekEndMs = seasonStartMs + currentWeek * weekMs;
			weekText = `WEEK ${currentWeek}/${totalWeeks} • ${formatWeekRemaining(weekEndMs, nowMs)} LEFT`;
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
			weekText,
			stageLabel: formatStageLabel(liveData.stage, liveData.seasonStatus),
			athleteCount: players.length,
		};
	}, [liveData, user?.id]);

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
				<div className="container mx-auto max-w-3xl py-10 px-4">
					<div className="scoreboard-panel p-6 text-sm text-muted-foreground">Loading command hub...</div>
				</div>
			</div>
		);
	}

	if (!user) {
		return (
			<div className="min-h-screen">
				<div className="container mx-auto max-w-3xl py-6 px-4 sm:py-10 space-y-6">
					<div className="scoreboard-panel p-5 sm:p-6 space-y-4">
						<div className="font-display text-2xl sm:text-3xl tracking-widest text-primary">WELCOME TO THE ARENA</div>
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
								<button
									type="button"
									className="arena-badge px-4 py-3 text-center text-sm min-h-[48px] w-full"
								>
									VIEW TUTORIAL
								</button>
							</IntroGuide>
						</div>
						<div className="flex gap-3 flex-wrap pt-1">
							<Link href="/rules" className="arena-badge px-4 py-2">
								READ RULES
							</Link>
						</div>
					</div>
				</div>
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
							{mySnapshot?.stageLabel ? (
								<span className="arena-badge arena-badge-primary text-[10px]">{mySnapshot.stageLabel}</span>
							) : null}
						</div>

						{lastLobby?.id ? (
							<>
								<div className="font-display text-2xl tracking-widest text-primary">{lastLobby.name}</div>
								{liveLoading ? (
									<div className="text-xs text-muted-foreground">Syncing live snapshot...</div>
								) : mySnapshot ? (
									<div className="grid gap-2 sm:grid-cols-2">
										<div className="border-2 border-border bg-muted/20 px-3 py-2">
											<div className="text-[10px] font-display tracking-widest text-muted-foreground">YOUR RANK</div>
											<div className="font-display text-lg text-arena-gold">
												{mySnapshot.rank ? `#${mySnapshot.rank}` : "--"}
											</div>
											<div className="text-[10px] font-display tracking-widest text-muted-foreground">
												{mySnapshot.points} PTS
											</div>
										</div>
										<div className="border-2 border-border bg-muted/20 px-3 py-2">
											<div className="text-[10px] font-display tracking-widest text-muted-foreground">HEARTS</div>
											<div className="font-display text-lg text-foreground">{mySnapshot.hearts}/3</div>
											<div className="text-[10px] font-display tracking-widest text-muted-foreground">
												{mySnapshot.athleteCount} ATHLETES
											</div>
										</div>
										<div className="border-2 border-border bg-muted/20 px-3 py-2 sm:col-span-2">
											<div className="text-[10px] font-display tracking-widest text-muted-foreground">SEASON CLOCK</div>
											<div className="font-display text-sm tracking-wider text-foreground">{mySnapshot.weekText}</div>
										</div>
									</div>
								) : (
									<div className="text-xs text-muted-foreground">
										No live snapshot yet. Open the lobby to refresh current standings.
									</div>
								)}
								<div className="flex flex-wrap gap-2">
									<Link href={`/lobby/${encodeURIComponent(lastLobby.id)}`} className="arena-badge arena-badge-primary px-4 py-2">
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
						<Link href={lastLobby?.id ? `/lobby/${encodeURIComponent(lastLobby.id)}/history` : "/history"} className="arena-badge w-full justify-center px-4 py-2">
							HISTORY
						</Link>
							<p className="text-xs text-muted-foreground">
								Lobbies is your full directory and management view. This hub is your fast resume surface.
							</p>
						</div>
					</div>

					<div className="scoreboard-panel p-5 space-y-4">
						<div className="flex items-center justify-between gap-2">
							<div className="font-display text-lg tracking-widest text-foreground">QUICK SWITCH LOBBIES</div>
							<span className="text-xs text-muted-foreground font-display tracking-wider">
								{orderedLobbies.length} TOTAL
							</span>
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
				</div>
			</div>
		);
}
