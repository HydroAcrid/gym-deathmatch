"use client";

import { useEffect, useState } from "react";
import type { Lobby } from "@/types/game";
import { LobbyLayout } from "./LobbyLayout";
import { PreStageView } from "./PreStageView";
import { RouletteTransitionPanel } from "./RouletteTransitionPanel";
import { SeasonCompleteOverlay } from "./SeasonCompleteOverlay";
import { useLobbyLive } from "@/hooks/useLobbyLive";
import { useLobbyRealtime } from "@/hooks/useLobbyRealtime";
import { useAuth } from "./AuthProvider";
import { authFetch } from "@/lib/clientAuth";
import { hasSeenSpinReplay } from "@/lib/spinReplay";
import { SEASON_FINALE_SEEN_PREFIX } from "@/lib/localStorageKeys";

export function LobbySwitcher({ lobby: initialLobby }: { lobby: Lobby }) {
	const [overridePre, setOverridePre] = useState<boolean>(false);
	const [showDebugToggle, setShowDebugToggle] = useState(false);
	const [showSeasonFinale, setShowSeasonFinale] = useState(false);
	const [seasonFinaleInitialized, setSeasonFinaleInitialized] = useState(false);
	const [attemptedCompletedReload, setAttemptedCompletedReload] = useState(false);
	const { user } = useAuth();
	
	// Realtime & Live Data Hooks
	const { data: liveData, reload, loading, error } = useLobbyLive(initialLobby.id);
	useLobbyRealtime(initialLobby.id, { onChange: reload });
	const liveErrorStatus =
		typeof error === "object" && error !== null && "status" in error
			? Number((error as { status?: unknown }).status ?? 0)
			: 0;
	const showRejoinCta = !liveData && (liveErrorStatus === 401 || liveErrorStatus === 403);

	// Merge live data with initial data
	const lobby = liveData?.lobby || initialLobby;
	const liveStage = liveData?.stage;
	const liveSummary = liveData?.seasonSummary;
	const liveSeasonStatus = liveData?.seasonStatus;
	const effectiveSeasonStatus = liveSeasonStatus || lobby.status;
	const lobbyMode = lobby.mode;
	const lobbyOwnerUserId = (lobby as Lobby & { ownerUserId?: string | null }).ownerUserId ?? null;

	// Fallback poll for week status in challenge modes (every 5s)
	// This could be moved to realtime if we have a table for it, but sticking to polling for now as requested
	const [weekStatus, setWeekStatus] = useState<string | null>(null);
	const [pendingSpinReplay, setPendingSpinReplay] = useState<boolean>(false);
	const [punishmentsLoaded, setPunishmentsLoaded] = useState<boolean>(false);
	useEffect(() => {
		if (!String(lobby.mode || "").startsWith("CHALLENGE_")) return;
		let cancelled = false;
		async function load() {
			try {
				const res = await authFetch(`/api/lobby/${encodeURIComponent(lobby.id)}/punishments`, { cache: "no-store" });
				if (!res.ok || cancelled) return;
				const j = await res.json();
				if (!cancelled) {
					setWeekStatus(j.weekStatus || null);
					const spinId = j?.spinEvent?.spinId as string | undefined;
					if (spinId) {
						setPendingSpinReplay(!hasSeenSpinReplay(lobby.id, spinId));
					} else {
						setPendingSpinReplay(false);
					}
					setPunishmentsLoaded(true);
				}
			} catch {
				// ignore
			}
		}
		load();
		const id = setInterval(load, 5 * 1000);
		return () => {
			cancelled = true;
			clearInterval(id);
		};
	}, [lobby, lobby.id, lobbyMode, liveData?.fetchedAt]); // Re-check when live data updates

	useEffect(() => {
		setWeekStatus(null);
		setPendingSpinReplay(false);
		setPunishmentsLoaded(false);
	}, [lobby.id]);

	useEffect(() => {
		if (typeof window === "undefined") return;
		if (window.location.hostname === "localhost") {
			setShowDebugToggle(true);
		}
	}, []);

	function toggle() {
		setOverridePre((prev) => !prev);
	}

	const currentStage = liveStage || lobby.stage || (effectiveSeasonStatus === "completed" ? "COMPLETED" : effectiveSeasonStatus === "active" || effectiveSeasonStatus === "transition_spin" ? "ACTIVE" : "PRE_STAGE");
	const currentSummary = liveSummary || lobby.seasonSummary;
	const isCompletedSeason = currentStage === "COMPLETED" || effectiveSeasonStatus === "completed";
	const finaleSeasonNumber = Number(currentSummary?.seasonNumber ?? lobby.seasonNumber ?? 1);
	const finaleStorageKey = `${SEASON_FINALE_SEEN_PREFIX}:${lobby.id}:${finaleSeasonNumber}`;

	const shouldShowPre =
		(currentStage === "PRE_STAGE" ||
			(effectiveSeasonStatus &&
				effectiveSeasonStatus !== "active" &&
				effectiveSeasonStatus !== "transition_spin" &&
				effectiveSeasonStatus !== "completed")) ||
		overridePre;

	const isRouletteTransition = 
		effectiveSeasonStatus === "transition_spin" && 
		String(lobby.mode || "").startsWith("CHALLENGE_ROULETTE");
	const weekNeedsWheel =
		weekStatus == null ||
		weekStatus === "PENDING_PUNISHMENT" ||
		weekStatus === "PENDING_CONFIRMATION";
	const shouldShowTransitionPanel = isRouletteTransition && punishmentsLoaded && (pendingSpinReplay || weekNeedsWheel);

	useEffect(() => {
		setShowSeasonFinale(false);
		setSeasonFinaleInitialized(false);
		setAttemptedCompletedReload(false);
	}, [lobby.id, finaleSeasonNumber]);

	useEffect(() => {
		if (!isCompletedSeason || !currentSummary || seasonFinaleInitialized) return;
		if (typeof window === "undefined") return;
		let seen = false;
		try {
			seen = window.localStorage.getItem(finaleStorageKey) === "1";
		} catch {
			seen = false;
		}
		setShowSeasonFinale(!seen);
		setSeasonFinaleInitialized(true);
	}, [isCompletedSeason, currentSummary, seasonFinaleInitialized, finaleStorageKey]);

	useEffect(() => {
		if (!isCompletedSeason || currentSummary || loading || attemptedCompletedReload) return;
		setAttemptedCompletedReload(true);
		void reload();
	}, [isCompletedSeason, currentSummary, loading, attemptedCompletedReload, reload]);

	const closeSeasonFinale = () => {
		setShowSeasonFinale(false);
		if (typeof window === "undefined") return;
		try {
			window.localStorage.setItem(finaleStorageKey, "1");
		} catch {
			// ignore storage errors
		}
	};

	// Provide a scheduled start when we fake pre-stage so countdown renders
	const stagedLobby: Lobby = shouldShowPre && !lobby.scheduledStart
		? { ...lobby, status: effectiveSeasonStatus ?? "scheduled", scheduledStart: "2099-01-01T00:05:00.000Z" }
		: lobby;

		const ownerPlayer = (lobby.players || []).find(p => p.id === lobby.ownerId);
		const overlayIsOwner = Boolean(
			user?.id &&
			((lobbyOwnerUserId && user.id === lobbyOwnerUserId) ||
				(ownerPlayer?.userId && ownerPlayer.userId === user.id))
		);

		return (
			<div className="relative min-h-[400px] sm:min-h-[500px]">
				{showRejoinCta && !loading && (
					<div className="mx-auto my-8 max-w-xl scoreboard-panel p-6 sm:p-8 text-center">
						<div className="font-display text-xl tracking-widest text-primary">LOBBY ACCESS REQUIRED</div>
						<div className="mt-2 text-sm text-muted-foreground">
							Your membership link needs to be refreshed before this lobby can load.
						</div>
						<div className="mt-4 flex items-center justify-center gap-2">
							<button
								className="arena-badge arena-badge-primary px-4 py-2 text-xs"
								onClick={() => {
									const qs = typeof window !== "undefined" ? window.location.search : "";
									window.location.href = `/onboard/${encodeURIComponent(initialLobby.id)}${qs || ""}`;
								}}
							>
								Rejoin Lobby
							</button>
							<button className="arena-badge px-4 py-2 text-xs" onClick={() => reload()}>
								Retry
							</button>
						</div>
					</div>
				)}
				{showRejoinCta ? null : shouldShowTransitionPanel ? (
					<RouletteTransitionPanel lobby={lobby} />
				) : isCompletedSeason ? (
					<>
						{!currentSummary && !loading && (
							<div className="mx-auto mt-6 max-w-2xl scoreboard-panel p-6 text-center">
								<div className="font-display tracking-widest text-primary">SEASON FINALE PREPARING</div>
								<div className="mt-2 text-sm text-muted-foreground">
									Final standings are syncing. Reload if this takes longer than a few seconds.
								</div>
								<button className="mt-4 arena-badge px-4 py-2 text-xs" onClick={() => reload()}>
									Reload Finale
								</button>
							</div>
						)}
						{currentSummary && !showSeasonFinale && (
							<div className="container mx-auto px-3 sm:px-4 mt-4">
								<div className="scoreboard-panel p-3 sm:p-4 flex items-center justify-between gap-3">
									<div className="font-display tracking-wider text-sm sm:text-base">SEASON {finaleSeasonNumber} FINALE READY</div>
									<button
										className="arena-badge arena-badge-primary px-3 py-2 text-xs"
										onClick={() => setShowSeasonFinale(true)}
									>
										View Finale
									</button>
								</div>
							</div>
						)}
						<LobbyLayout lobby={lobby} liveData={liveData} onRefresh={reload} />
						{currentSummary && (
							<SeasonCompleteOverlay
								open={showSeasonFinale}
								onClose={closeSeasonFinale}
								lobbyId={lobby.id}
								seasonNumber={finaleSeasonNumber}
								mode={lobby.mode}
								seasonSummary={currentSummary}
								isOwner={overlayIsOwner}
								defaultWeekly={lobby.weeklyTarget ?? 3}
								defaultLives={lobby.initialLives ?? 3}
								defaultSeasonEnd={lobby.seasonEnd ?? new Date().toISOString()}
								ownerPlayerId={lobby.ownerId}
								onNextSeason={reload}
							/>
						)}
					</>
				) : shouldShowPre ? (
					<PreStageView lobby={stagedLobby} />
				) : (
					<LobbyLayout lobby={lobby} liveData={liveData} onRefresh={reload} />
				)}
			
			{/* Debug toggle */}
			{showDebugToggle && (
				<div className="fixed bottom-20 right-4 z-[100]">
					<button onClick={toggle} className="text-[10px] bg-black/50 text-white px-2 py-1 rounded">
						Toggle Pre
					</button>
				</div>
			)}
		</div>
	);
}
