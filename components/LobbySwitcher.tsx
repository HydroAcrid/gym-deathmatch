"use client";

import { useEffect, useState, useMemo } from "react";
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

export function LobbySwitcher({ lobby: initialLobby }: { lobby: Lobby }) {
	const [overridePre, setOverridePre] = useState<boolean>(false);
	const [showDebugToggle, setShowDebugToggle] = useState(false);
	const { user } = useAuth();
	
	// Realtime & Live Data Hooks
	const { data: liveData, reload, loading } = useLobbyLive(initialLobby.id);
	useLobbyRealtime(initialLobby.id, { onChange: reload });

	// Merge live data with initial data
	const lobby = liveData?.lobby || initialLobby;
	const liveStage = liveData?.stage;
	const liveSummary = liveData?.seasonSummary;
	const liveSeasonStatus = liveData?.seasonStatus;
	const effectiveSeasonStatus = liveSeasonStatus || lobby.status;

	// Fallback poll for week status in challenge modes (every 5s)
	// This could be moved to realtime if we have a table for it, but sticking to polling for now as requested
	const [weekStatus, setWeekStatus] = useState<string | null>(null);
	const [pendingSpinReplay, setPendingSpinReplay] = useState<boolean>(false);
	useEffect(() => {
		if (!String((lobby as any).mode || "").startsWith("CHALLENGE_")) return;
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
				}
			} catch { /* ignore */ }
		}
		load();
		const id = setInterval(load, 5 * 1000);
		return () => {
			cancelled = true;
			clearInterval(id);
		};
	}, [lobby.id, (lobby as any).mode, liveData?.fetchedAt]); // Re-check when live data updates

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

	const shouldShowPre =
		(currentStage === "PRE_STAGE" || (effectiveSeasonStatus && effectiveSeasonStatus !== "active" && effectiveSeasonStatus !== "transition_spin")) || overridePre;

	// If weekStatus is PENDING_CONFIRMATION, show LobbyLayout (which will show WeekSetup) instead of RouletteTransitionPanel
	const shouldShowTransitionPanel = 
		effectiveSeasonStatus === "transition_spin" && 
		String(lobby.mode || "").startsWith("CHALLENGE_ROULETTE") &&
		(weekStatus !== "PENDING_CONFIRMATION" || pendingSpinReplay);

	// Provide a scheduled start when we fake pre-stage so countdown renders
	const stagedLobby: Lobby = shouldShowPre && !lobby.scheduledStart
		? { ...lobby, status: effectiveSeasonStatus ?? "scheduled", scheduledStart: new Date(Date.now() + 5 * 60 * 1000).toISOString() }
		: lobby;

		const ownerPlayer = (lobby.players || []).find(p => p.id === lobby.ownerId);
		const overlayIsOwner = Boolean(
			user?.id &&
			(((lobby as any).ownerUserId && user.id === (lobby as any).ownerUserId) ||
				(ownerPlayer?.userId && ownerPlayer.userId === user.id))
		);

		return (
			<div className="relative min-h-[400px] sm:min-h-[500px]">
				{loading && !liveData && (
					<div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-[#120b07]/90 backdrop-blur-sm text-foreground">
						<div className="w-16 h-16 border-4 border-border/20 border-t-primary rounded-full animate-spin" />
						<div className="text-sm sm:text-base tracking-[0.2em] uppercase">Loading lobby</div>
						<div className="text-[11px] text-muted-foreground">Pulling live arena data…</div>
					</div>
				)}
				{
					shouldShowTransitionPanel ? (
						<RouletteTransitionPanel lobby={lobby} />
					) : shouldShowPre ? (
						<PreStageView lobby={stagedLobby} />
					) : currentStage === "COMPLETED" && currentSummary ? (
						<SeasonCompleteOverlay
							lobbyId={lobby.id}
							seasonNumber={lobby.seasonNumber ?? 1}
							mode={lobby.mode}
							seasonSummary={currentSummary}
							isOwner={overlayIsOwner}
							defaultWeekly={lobby.weeklyTarget ?? 3}
							defaultLives={lobby.initialLives ?? 3}
							defaultSeasonEnd={lobby.seasonEnd ?? new Date().toISOString()}
							ownerPlayerId={lobby.ownerId}
							onNextSeason={reload}
						/>
					) : (
						<LobbyLayout 
							lobby={lobby} 
						liveData={liveData}
						onRefresh={reload}
					/>
				)
			}
			
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
