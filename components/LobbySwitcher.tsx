"use client";

import { useEffect, useState, useMemo } from "react";
import type { Lobby } from "@/types/game";
import { LobbyLayout } from "./LobbyLayout";
import { PreStageView } from "./PreStageView";
import { RouletteTransitionPanel } from "./RouletteTransitionPanel";
import { SeasonCompleteOverlay } from "./SeasonCompleteOverlay";

export function LobbySwitcher({ lobby }: { lobby: Lobby }) {
	const [overridePre, setOverridePre] = useState<boolean>(false);
	const [weekStatus, setWeekStatus] = useState<string | null>(null);
	const [stage, setStage] = useState<Lobby["stage"]>(lobby.stage);
	const [seasonSummary, setSeasonSummary] = useState(lobby.seasonSummary);
	const [isOwner, setIsOwner] = useState(false);

	useEffect(() => {
		if (typeof window === "undefined") return;
		const v = localStorage.getItem("gymdm_view_override_pre");
		setOverridePre(v === "1");
	}, []);

	// Always remember last visited lobby, regardless of which sub-view is shown
	useEffect(() => {
		if (typeof window === "undefined") return;
		localStorage.setItem("gymdm_lastLobbyId", lobby.id);
	}, [lobby.id]);

	// Check weekStatus for challenge modes to determine if we should show WeekSetup
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
		// Load immediately, then poll
		load();
		const id = setInterval(load, 5 * 1000); // Poll every 5 seconds
		return () => {
			cancelled = true;
			clearInterval(id);
		};
	}, [lobby.id, (lobby as any).mode]);

	function toggle() {
		const next = !overridePre;
		setOverridePre(next);
		if (typeof window !== "undefined") {
			localStorage.setItem("gymdm_view_override_pre", next ? "1" : "0");
		}
	}

	// Poll for stage updates
	useEffect(() => {
		let cancelled = false;
		async function load() {
			try {
				const res = await fetch(`/api/lobby/${encodeURIComponent(lobby.id)}/live`, { cache: "no-store" });
				if (!res.ok || cancelled) return;
				const data = await res.json();
				if (!cancelled && data) {
					if (data.stage) setStage(data.stage);
					if (data.seasonSummary !== undefined) setSeasonSummary(data.seasonSummary);
				}
			} catch { /* ignore */ }
		}
		load();
		const id = setInterval(load, 10 * 1000); // Poll every 10 seconds
		return () => {
			cancelled = true;
			clearInterval(id);
		};
	}, [lobby.id]);

	const currentStage = stage || lobby.stage || (lobby.status === "completed" ? "COMPLETED" : lobby.status === "active" || lobby.status === "transition_spin" ? "ACTIVE" : "PRE_STAGE");
	const currentSummary = seasonSummary || lobby.seasonSummary;

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
			{/* Always render LobbyLayout to get isOwner, but conditionally show overlay */}
			{currentStage === "COMPLETED" ? (
				<>
					{/* Show a minimal layout behind the overlay */}
					<div className="opacity-30 pointer-events-none">
						<LobbyLayout 
							lobby={lobby} 
							onStageChange={(s, summary) => { 
								setStage(s); 
								setSeasonSummary(summary); 
							}}
							onOwnerChange={setIsOwner}
						/>
					</div>
					{/* Season Complete Overlay */}
					{currentSummary && (
						<SeasonCompleteOverlay
							lobbyId={lobby.id}
							seasonNumber={lobby.seasonNumber}
							mode={lobby.mode}
							seasonSummary={currentSummary}
							isOwner={isOwner}
							defaultWeekly={lobby.weeklyTarget ?? 3}
							defaultLives={lobby.initialLives ?? 3}
							defaultSeasonEnd={lobby.seasonEnd}
							onNextSeason={() => {
								// Refresh the page to show pre-stage
								if (typeof window !== "undefined") window.location.reload();
							}}
						/>
					)}
				</>
			) : shouldShowPre ? (
				<PreStageView lobby={stagedLobby} />
			) : shouldShowTransitionPanel ? (
				<RouletteTransitionPanel lobby={lobby} />
			) : (
				<LobbyLayout 
					lobby={lobby} 
					onStageChange={(s, summary) => { 
						setStage(s); 
						setSeasonSummary(summary); 
					}}
					onOwnerChange={setIsOwner}
				/>
			)}
			{lobby.id === "kevin-nelly" && (
				<div className="fixed right-3 bottom-3 z-40">
					<button
						className="btn-secondary px-3 py-2 rounded-md text-xs"
						onClick={toggle}
						title="Toggle pre-show/active view (dev)"
					>
						{shouldShowPre ? "Show Active View" : "Show Pre‑Show"}
					</button>
				</div>
			)}
		</div>
	);
}


