"use client";

import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useAuth } from "./AuthProvider";
import type { Lobby, Player, GameMode, ChallengeSettings } from "@/types/game";

export function WeekSetup({
	lobbyId,
	week,
	punishmentText,
	mode,
	challengeSettings,
	players,
	isOwner,
}: {
	lobbyId: string;
	week: number;
	punishmentText: string;
	mode?: GameMode;
	challengeSettings?: ChallengeSettings | null;
	players: Player[];
	isOwner: boolean;
}) {
	const { user } = useAuth();
	const [readyStates, setReadyStates] = useState<Record<string, boolean>>({});
	const [loading, setLoading] = useState<boolean>(false);
	const [errorMsg, setErrorMsg] = useState<string | null>(null);

	// Find current user's player
	const myPlayer = useMemo(() => {
		if (user?.id) {
			const found = players.find(p => (p as any).userId === user.id);
			if (found) return found;
		}
		return null;
	}, [players, user?.id]);

	// Load ready states
	useEffect(() => {
		async function load() {
			try {
				const res = await fetch(`/api/lobby/${encodeURIComponent(lobbyId)}/week-ready?week=${week}`, { cache: "no-store" });
				if (!res.ok) return;
				const j = await res.json();
				setReadyStates(j.readyByPlayer || {});
			} catch { /* ignore */ }
		}
		load();
		const id = setInterval(load, 5 * 1000); // Poll every 5 seconds
		return () => clearInterval(id);
	}, [lobbyId, week]);

	// Toggle ready state
	async function toggleReady(ready: boolean) {
		if (!myPlayer) return;
		setLoading(true);
		setErrorMsg(null);
		try {
			const res = await fetch(`/api/lobby/${encodeURIComponent(lobbyId)}/week-ready`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ playerId: myPlayer.id, week, ready }),
			});
			if (!res.ok) {
				const j = await res.json().catch(() => ({}));
				setErrorMsg(j?.error || "Failed to update ready state");
				return;
			}
			// Optimistically update
			setReadyStates(prev => ({ ...prev, [myPlayer.id]: ready }));
			console.log("[WeekSetup] Player ready toggled", { playerId: myPlayer.id, ready });
		} catch {
			setErrorMsg("Failed to update ready state");
		} finally {
			setLoading(false);
		}
	}

	// Start week
	async function startWeek() {
		setErrorMsg(null);
		setLoading(true);
		try {
			const res = await fetch(`/api/lobby/${encodeURIComponent(lobbyId)}/week-start`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ week }),
			});
			if (!res.ok) {
				const j = await res.json().catch(() => ({}));
				setErrorMsg(j?.error || "Failed to start week");
				return;
			}
			console.log("[WeekSetup] Week started by host");
			// Reload page to switch to ACTIVE layout
			if (typeof window !== "undefined") window.location.reload();
		} catch {
			setErrorMsg("Failed to start week");
		} finally {
			setLoading(false);
		}
	}

	const allReady = players.length > 0 && players.every(p => readyStates[p.id] === true);
	const readyCount = players.filter(p => readyStates[p.id] === true).length;

	// Determine how punishment was chosen
	const selectionMethod = challengeSettings?.selection || "ROULETTE";
	const methodLabel = selectionMethod === "ROULETTE" ? "🎡 Roulette" : selectionMethod === "VOTING" ? "🗳 Voting" : "🧑‍⚖️ Host decided";

	return (
		<div className="mx-auto max-w-6xl">
			{/* Hero Card - Punishment Reveal */}
			<motion.div
				initial={{ opacity: 0, y: 12 }}
				animate={{ opacity: 1, y: 0 }}
				className="paper-card paper-grain ink-edge scoreboard-vignette px-4 sm:px-6 py-4 sm:py-5 text-center mb-6"
			>
				<div className="uppercase tracking-[0.14em] text-[10px] sm:text-[11px] text-deepBrown/70 mb-1">
					THIS WEEK'S PUNISHMENT
				</div>
				<div className="flex flex-col md:flex-row items-center justify-center gap-2 md:gap-4">
					<div className="poster-headline text-3xl sm:text-4xl md:text-5xl lg:text-6xl leading-tight text-cream break-words max-w-full px-2">
						"{punishmentText}"
					</div>
				</div>
				{/* Meta row */}
				<div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-[10px] sm:text-[11px] text-deepBrown/70 uppercase tracking-wide">
					<span>WEEK {week}</span>
					<span>•</span>
					<span>{mode === "CHALLENGE_ROULETTE" ? "Challenge: Roulette" : mode === "CHALLENGE_CUMULATIVE" ? "Challenge: Cumulative" : "Challenge"}</span>
					<span>•</span>
					<span className="inline-flex items-center gap-1">{methodLabel}</span>
				</div>
			</motion.div>

			{errorMsg && <div className="mb-4 text-sm text-[#a13535]">⚠ {errorMsg}</div>}

			{/* Players Roster */}
			<div className="paper-card paper-grain ink-edge p-4 sm:p-6 mb-6">
				<div className="text-xs text-deepBrown/70 mb-4 uppercase tracking-wide">Players</div>
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
					{players.map((player) => {
						const isReady = readyStates[player.id] === true;
						const isMe = myPlayer?.id === player.id;
						const canToggle = isMe || isOwner;

						return (
							<motion.div
								key={player.id}
								variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}
								className="relative bg-cream rounded-md p-3 border border-deepBrown/20 flex items-center gap-3"
							>
								<div className="h-10 w-10 rounded-full overflow-hidden bg-tan border border-deepBrown/30 flex-shrink-0">
									{player.avatarUrl ? (
										<img src={player.avatarUrl} alt="" className="h-full w-full object-cover" />
									) : (
										<div className="h-full w-full flex items-center justify-center text-lg">🏋️</div>
									)}
								</div>
								<div className="flex-1 min-w-0">
									<div className="poster-headline text-sm leading-4 truncate">{player.name.toUpperCase()}</div>
									<div className="text-[11px] text-deepBrown/70 truncate">{player.location || "—"}</div>
									<div className="text-[11px] text-deepBrown/80 mt-0.5">
										Goal: {player.weeklyTarget || 3} workouts
									</div>
								</div>
								{canToggle ? (
									<button
										onClick={() => toggleReady(!isReady)}
										disabled={loading}
										className={`px-2 py-1 rounded text-[10px] font-semibold border transition-colors ${
											isReady
												? "bg-green-500/15 dark:bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/20 dark:border-green-500/30"
												: "bg-gray-500/15 dark:bg-gray-500/20 text-gray-700 dark:text-gray-300 border-gray-500/20 dark:border-gray-500/30"
										}`}
									>
										{isReady ? "READY ✅" : "NOT READY ⏳"}
									</button>
								) : (
									<span
										className={`px-2 py-1 rounded text-[10px] font-semibold border ${
											isReady
												? "bg-green-500/15 dark:bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/20 dark:border-green-500/30"
												: "bg-gray-500/15 dark:bg-gray-500/20 text-gray-700 dark:text-gray-300 border-gray-500/20 dark:border-gray-500/30"
										}`}
									>
										{isReady ? "READY ✅" : "NOT READY ⏳"}
									</span>
								)}
							</motion.div>
						);
					})}
				</div>

				{/* Host Controls */}
				{isOwner && (
					<div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-deepBrown/20">
						<div className="text-xs text-deepBrown/70">
							{allReady ? "All players ready" : `Waiting for players… ${readyCount}/${players.length} ready`}
						</div>
						<div className="flex gap-2">
							<button
								onClick={startWeek}
								disabled={loading || (!allReady && !isOwner)}
								className={`btn-vintage px-4 py-2 rounded-md text-xs ${!allReady ? "opacity-60" : ""}`}
								title={!allReady ? "All players must be ready" : undefined}
							>
								Start week
							</button>
							{!allReady && (
								<button
									onClick={startWeek}
									disabled={loading}
									className="px-3 py-2 rounded-md border border-deepBrown/30 text-xs"
									title="Start week even if not all players are ready"
								>
									Override start (owner)
								</button>
							)}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
