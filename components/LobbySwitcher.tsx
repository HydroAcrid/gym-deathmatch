"use client";

import { useEffect, useState, useMemo } from "react";
import type { Lobby } from "@/types/game";
import { LobbyLayout } from "./LobbyLayout";
import { PreStageView } from "./PreStageView";
import { RouletteTransitionPanel } from "./RouletteTransitionPanel";
import { SeasonCompleteOverlay } from "./SeasonCompleteOverlay";
import { useLobbyLive } from "@/hooks/useLobbyLive";
import { useLobbyRealtime } from "@/hooks/useLobbyRealtime";

export function LobbySwitcher({ lobby: initialLobby }: { lobby: Lobby }) {
	const [overridePre, setOverridePre] = useState<boolean>(false);
	
	// Realtime & Live Data Hooks
	const { data: liveData, reload } = useLobbyLive(initialLobby.id);
	useLobbyRealtime(initialLobby.id, { onChange: reload });

	// Merge live data with initial data
	const lobby = liveData?.lobby || initialLobby;
	const liveStage = liveData?.stage;
	const liveSummary = liveData?.seasonSummary;
	const liveSeasonStatus = liveData?.seasonStatus;

	// Fallback poll for week status in challenge modes (every 5s)
	// This could be moved to realtime if we have a table for it, but sticking to polling for now as requested
	const [weekStatus, setWeekStatus] = useState<string | null>(null);
	useEffect(() => {
		if (!String((lobby as any).mode || "").startsWith("CHALLENGE_")) return;
		let cancelled = false;
		async function load() {
			try {
				const res = await fetch(`/api/lobby/${encodeURIComponent(lobby.id)}/punishments`, { cache: "no-store" });
				if (!res.ok || cancelled) return;
				const j = await res.json();
				if (!cancelled) {
					setWeekStatus(j.weekStatus || null);
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
		const v = localStorage.getItem("gymdm_view_override_pre");
		setOverridePre(v === "1");
	}, []);

	useEffect(() => {
		if (typeof window === "undefined") return;
		localStorage.setItem("gymdm_lastLobbyId", lobby.id);
	}, [lobby.id]);

	function toggle() {
		const next = !overridePre;
		setOverridePre(next);
		if (typeof window !== "undefined") {
			localStorage.setItem("gymdm_view_override_pre", next ? "1" : "0");
		}
	}

	const currentStage = liveStage || lobby.stage || (lobby.status === "completed" ? "COMPLETED" : lobby.status === "active" || lobby.status === "transition_spin" ? "ACTIVE" : "PRE_STAGE");
	const currentSummary = liveSummary || lobby.seasonSummary;

	const shouldShowPre =
		(currentStage === "PRE_STAGE" || (lobby.status && lobby.status !== "active" && lobby.status !== "transition_spin")) || overridePre;

	// If weekStatus is PENDING_CONFIRMATION, show LobbyLayout (which will show WeekSetup) instead of RouletteTransitionPanel
	const shouldShowTransitionPanel = 
		lobby.status === "transition_spin" && 
		String(lobby.mode || "").startsWith("CHALLENGE_ROULETTE") &&
		weekStatus !== "PENDING_CONFIRMATION";

	// Provide a scheduled start when we fake pre-stage so countdown renders
	const stagedLobby: Lobby = shouldShowPre && !lobby.scheduledStart
		? { ...lobby, status: lobby.status ?? "scheduled", scheduledStart: new Date(Date.now() + 5 * 60 * 1000).toISOString() }
		: lobby;

	return (
		<div className="relative">
			{
				shouldShowTransitionPanel ? (
					<RouletteTransitionPanel lobby={lobby} />
				) : shouldShowPre ? (
					<PreStageView lobby={stagedLobby} />
				) : currentStage === "COMPLETED" && currentSummary ? (
					<SeasonCompleteOverlay summary={currentSummary} lobby={lobby} />
				) : (
					<LobbyLayout 
						lobby={lobby} 
						liveData={liveData}
						onRefresh={reload}
					/>
				)
			}
			
			{/* Debug toggle */}
			{(typeof window !== "undefined" && window.location.hostname === "localhost") && (
				<div className="fixed bottom-20 right-4 z-[100]">
					<button onClick={toggle} className="text-[10px] bg-black/50 text-white px-2 py-1 rounded">
						Toggle Pre
					</button>
				</div>
			)}
		</div>
	);
}
