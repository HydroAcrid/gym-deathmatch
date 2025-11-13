"use client";

import { useEffect, useState } from "react";
import type { Lobby } from "@/types/game";
import { LobbyLayout } from "./LobbyLayout";
import { PreStageView } from "./PreStageView";
import { RouletteTransitionPanel } from "./RouletteTransitionPanel";

export function LobbySwitcher({ lobby }: { lobby: Lobby }) {
	const [overridePre, setOverridePre] = useState<boolean>(false);

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

	function toggle() {
		const next = !overridePre;
		setOverridePre(next);
		if (typeof window !== "undefined") {
			localStorage.setItem("gymdm_view_override_pre", next ? "1" : "0");
		}
	}

	const shouldShowPre =
		(lobby.status && lobby.status !== "active" && lobby.status !== "transition_spin") || overridePre;

	// Provide a scheduled start when we fake pre-stage so countdown renders
	const stagedLobby: Lobby = shouldShowPre && !lobby.scheduledStart
		? { ...lobby, status: lobby.status ?? "scheduled", scheduledStart: new Date(Date.now() + 5 * 60 * 1000).toISOString() }
		: lobby;

	return (
		<div className="relative">
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
			{shouldShowPre ? (
				<PreStageView lobby={stagedLobby} />
			) : (lobby.status === "transition_spin" && String(lobby.mode || "").startsWith("CHALLENGE_ROULETTE")) ? (
				<RouletteTransitionPanel lobby={lobby} />
			) : (
				<LobbyLayout lobby={lobby} />
			)}
		</div>
	);
}


