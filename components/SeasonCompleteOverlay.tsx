"use client";

import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import type { SeasonSummary, GameMode } from "@/types/game";
import Image from "next/image";
import { useState } from "react";
import { OwnerSettingsModal } from "./OwnerSettingsModal";

export function SeasonCompleteOverlay({
	lobbyId,
	seasonNumber,
	mode,
	seasonSummary,
	isOwner,
	defaultWeekly,
	defaultLives,
	defaultSeasonEnd,
	onNextSeason,
	ownerPlayerId
}: {
	lobbyId: string;
	seasonNumber: number;
	mode?: GameMode;
	seasonSummary: SeasonSummary;
	isOwner: boolean;
	defaultWeekly: number;
	defaultLives: number;
	defaultSeasonEnd: string;
	onNextSeason?: () => void;
	ownerPlayerId?: string | null;
}) {
	const router = useRouter();
	const [showEditModal, setShowEditModal] = useState(false);
	const [loading, setLoading] = useState(false);
	
	const isMoney = mode?.startsWith("MONEY_");
	const subheading = isMoney 
		? "The pot has been settled." 
		: "Punishments have been assigned.";

	async function startNextSeason(seasonStart?: string, seasonEnd?: string) {
		if (loading) return;
		setLoading(true);
		try {
			const res = await fetch(`/api/lobby/${encodeURIComponent(lobbyId)}/season/next`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					seasonStart,
					seasonEnd
				})
			});
			if (!res.ok) {
				const j = await res.json().catch(() => ({}));
				alert(j?.error || "Failed to start next season");
				return;
			}
			if (onNextSeason) {
				onNextSeason();
			} else {
				router.refresh();
			}
		} catch (e) {
			console.error("Start next season error", e);
			alert("Failed to start next season");
		} finally {
			setLoading(false);
		}
	}

	// Combine winners and losers for standings display
	const allPlayers = [
		...seasonSummary.winners.map(p => ({ ...p, isWinner: true })),
		...seasonSummary.losers.map(p => ({ ...p, isWinner: false }))
	].sort((a, b) => {
		// Sort by hearts first, then totalWorkouts
		if (b.hearts !== a.hearts) return b.hearts - a.hearts;
		return b.totalWorkouts - a.totalWorkouts;
	});

	return (
		<>
			<AnimatePresence>
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
					onClick={(e) => {
						// Don't close on overlay click - require button action
						e.stopPropagation();
					}}
				>
					<motion.div
						initial={{ opacity: 0, scale: 0.95, y: 20 }}
						animate={{ opacity: 1, scale: 1, y: 0 }}
						exit={{ opacity: 0, scale: 0.95, y: 20 }}
						transition={{ duration: 0.3, ease: "easeOut" }}
						className="paper-card paper-grain ink-edge max-w-5xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 border-4"
						style={{ borderColor: "#E1542A" }}
						onClick={(e) => e.stopPropagation()}
					>
						{/* Header */}
						<div className="text-center mb-6">
							<div className="poster-headline text-3xl sm:text-4xl md:text-5xl mb-2">
								SEASON {seasonNumber} COMPLETE
							</div>
							<div className="text-deepBrown/80 text-sm sm:text-base">
								{subheading}
							</div>
						</div>

						{/* Content Grid */}
						<div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
							{/* Left: Standings */}
							<div className="space-y-4">
								<div className="poster-headline text-lg mb-3">STANDINGS</div>
								<div className="space-y-3">
									{allPlayers.map((player, idx) => (
										<motion.div
											key={player.id}
											initial={{ opacity: 0, x: -20 }}
											animate={{ opacity: 1, x: 0 }}
											transition={{ delay: idx * 0.1 }}
											className={`flex items-center gap-3 p-3 rounded-md border ${
												player.isWinner 
													? "bg-cream/20 border-accent-primary/40" 
													: "bg-cream/5 border-deepBrown/20"
											}`}
										>
											{player.isWinner && (
												<span className="text-2xl">🏆</span>
											)}
											<div className="h-12 w-12 rounded-full overflow-hidden border-2 border-deepBrown/30 flex-shrink-0">
												{player.avatarUrl ? (
													<Image 
														src={player.avatarUrl} 
														alt={player.name} 
														width={48} 
														height={48} 
														className="object-cover"
													/>
												) : (
													<div className="h-full w-full flex items-center justify-center text-xl bg-tan">🏋️</div>
												)}
											</div>
											<div className="flex-1 min-w-0">
												<div className="poster-headline text-base truncate">{player.name.toUpperCase()}</div>
												<div className="text-xs text-deepBrown/70">
													❤️ {player.hearts} • {player.totalWorkouts} workouts
												</div>
											</div>
										</motion.div>
									))}
								</div>
								{/* Debts for money modes */}
								{isMoney && seasonSummary.debts && seasonSummary.debts.length > 0 && (
									<div className="mt-4 pt-4 border-t border-deepBrown/20">
										<div className="text-xs text-deepBrown/70 space-y-1">
											{seasonSummary.debts.map((debt, idx) => (
												<div key={idx}>
													{debt.fromName} owes ${debt.amount} to {debt.toName}
												</div>
											))}
										</div>
									</div>
								)}
							</div>

							{/* Right: Highlights */}
							<div className="space-y-4">
								<div className="poster-headline text-lg mb-3">HIGHLIGHTS</div>
								<div className="space-y-3">
									{seasonSummary.highlights.longestStreak && (
										<div className="p-3 rounded-md border border-deepBrown/20 bg-cream/5">
											<div className="text-xs text-deepBrown/70 mb-1">🔥 LONGEST STREAK</div>
											<div className="poster-headline text-lg">{seasonSummary.highlights.longestStreak.playerName}</div>
											<div className="text-sm text-deepBrown/80">{seasonSummary.highlights.longestStreak.streak} days</div>
										</div>
									)}
									{seasonSummary.highlights.mostWorkouts && (
										<div className="p-3 rounded-md border border-deepBrown/20 bg-cream/5">
											<div className="text-xs text-deepBrown/70 mb-1">💪 MOST WORKOUTS</div>
											<div className="poster-headline text-lg">{seasonSummary.highlights.mostWorkouts.playerName}</div>
											<div className="text-sm text-deepBrown/80">{seasonSummary.highlights.mostWorkouts.count} total</div>
										</div>
									)}
									{seasonSummary.highlights.mostConsistent && (
										<div className="p-3 rounded-md border border-deepBrown/20 bg-cream/5">
											<div className="text-xs text-deepBrown/70 mb-1">📈 MOST CONSISTENT</div>
											<div className="poster-headline text-lg">{seasonSummary.highlights.mostConsistent.playerName}</div>
											<div className="text-sm text-deepBrown/80">{seasonSummary.highlights.mostConsistent.avgPerWeek.toFixed(1)} avg/week</div>
										</div>
									)}
									{isMoney && (
										<div className="p-3 rounded-md border border-deepBrown/20 bg-cream/5">
											<div className="text-xs text-deepBrown/70 mb-1">💰 FINAL POT</div>
											<div className="poster-headline text-2xl">${seasonSummary.finalPot}</div>
										</div>
									)}
								</div>
							</div>
						</div>

						{/* Action Buttons */}
						{isOwner && (
							<div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-deepBrown/20">
								<button
									onClick={() => startNextSeason()}
									disabled={loading}
									className="btn-vintage px-6 py-3 rounded-md text-sm flex-1 disabled:opacity-60"
								>
									{loading ? "Starting..." : `Start Season ${seasonNumber + 1} (same rules)`}
								</button>
								<button
									onClick={() => setShowEditModal(true)}
									disabled={loading}
									className="btn-secondary px-6 py-3 rounded-md text-sm flex-1 disabled:opacity-60"
								>
									Edit settings then start
								</button>
								<button
									onClick={() => router.push("/lobbies")}
									className="px-6 py-3 rounded-md border border-deepBrown/30 text-sm hover:bg-cream/10 transition-colors disabled:opacity-60"
								>
									Return to lobbies
								</button>
							</div>
						)}
						{!isOwner && (
							<div className="pt-6 border-t border-deepBrown/20 text-center">
								<button
									onClick={() => router.push("/lobbies")}
									className="btn-secondary px-6 py-3 rounded-md text-sm"
								>
									Return to lobbies
								</button>
							</div>
						)}
					</motion.div>
				</motion.div>
			</AnimatePresence>

			{/* Edit Modal */}
			{showEditModal && (
				<OwnerSettingsModal
					open={showEditModal}
					onClose={() => setShowEditModal(false)}
					lobbyId={lobbyId}
					ownerPlayerId={ownerPlayerId ?? null}
					defaultWeekly={defaultWeekly}
					defaultLives={defaultLives}
					defaultSeasonEnd={defaultSeasonEnd}
					onSaved={async (newSeasonEnd) => {
						setShowEditModal(false);
						// Calculate new season start (now or from defaultSeasonEnd)
						const newSeasonStart = new Date().toISOString();
						await startNextSeason(newSeasonStart, newSeasonEnd);
					}}
					hideTrigger
				/>
			)}
		</>
	);
}
