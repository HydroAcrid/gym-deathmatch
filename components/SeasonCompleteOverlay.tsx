"use client";

import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import type { SeasonSummary, GameMode } from "@/types/game";
import { useState } from "react";
import { OwnerSettingsModal } from "./OwnerSettingsModal";
import { authFetch } from "@/lib/clientAuth";
import { calculatePoints, POINTS_FORMULA_TEXT } from "@/lib/points";
import { Coins, Dumbbell, Flame, Heart, Trophy, TrendingUp } from "lucide-react";

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
			const res = await authFetch(`/api/lobby/${encodeURIComponent(lobbyId)}/season/next`, {
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
		...seasonSummary.winners.map(p => ({
			...p,
			isWinner: true,
			points: p.points ?? calculatePoints({
				workouts: p.totalWorkouts,
				streak: p.currentStreak ?? 0,
				longestStreak: p.longestStreak ?? p.currentStreak ?? 0,
			})
		})),
		...seasonSummary.losers.map(p => ({
			...p,
			isWinner: false,
			points: p.points ?? calculatePoints({
				workouts: p.totalWorkouts,
				streak: p.currentStreak ?? 0,
				longestStreak: p.longestStreak ?? p.currentStreak ?? 0,
			})
		}))
	].sort((a, b) => {
		if ((b.points ?? 0) !== (a.points ?? 0)) return (b.points ?? 0) - (a.points ?? 0);
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
					className="fixed inset-0 z-[160] flex items-start sm:items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-sm"
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
						className="scoreboard-panel w-full h-[100dvh] sm:h-auto sm:max-w-5xl sm:max-h-[90vh] overflow-y-auto arena-scrollbar border-2 p-4 sm:p-8 pt-[calc(env(safe-area-inset-top,0px)+1rem)] sm:pt-8 pb-[calc(env(safe-area-inset-bottom,0px)+6.5rem)] sm:pb-8"
						onClick={(e) => e.stopPropagation()}
					>
						{/* Header */}
						<div className="text-center mb-6">
							<div className="font-display tracking-widest text-primary text-3xl sm:text-4xl md:text-5xl mb-2">
								SEASON {seasonNumber} COMPLETE
							</div>
							<div className="text-muted-foreground text-sm sm:text-base">
								{subheading}
							</div>
						</div>

						{/* Content Grid */}
						<div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
							{/* Left: Standings */}
							<div className="space-y-4">
								<div className="font-display tracking-widest text-primary text-lg mb-3">STANDINGS</div>
								<div className="text-[11px] text-muted-foreground -mt-2 mb-2">{POINTS_FORMULA_TEXT}</div>
								<div className="space-y-3">
									{allPlayers.map((player, idx) => (
										<motion.div
											key={player.id}
											initial={{ opacity: 0, x: -20 }}
											animate={{ opacity: 1, x: 0 }}
											transition={{ delay: idx * 0.1 }}
											className={`flex items-center gap-3 p-3 rounded-md border ${
												player.isWinner 
													? "bg-muted/20 border-primary/40" 
													: "bg-muted/10 border-border"
											}`}
										>
											{player.isWinner && (
												<Trophy className="h-6 w-6 text-primary" />
											)}
											<div className="h-12 w-12 rounded-full overflow-hidden border-2 border-border flex-shrink-0">
												{player.avatarUrl ? (
													<img src={player.avatarUrl} alt={player.name} className="h-full w-full object-cover" />
												) : (
													<div className="h-full w-full flex items-center justify-center bg-muted">
														<Dumbbell className="h-5 w-5 text-primary" />
													</div>
												)}
											</div>
											<div className="flex-1 min-w-0">
												<div className="font-display tracking-widest text-primary text-base truncate">{player.name.toUpperCase()}</div>
												<div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
													<span className="inline-flex items-center gap-1">
														<Trophy className="h-3 w-3 text-primary" /> {player.points ?? 0} pts
													</span>
													<span>•</span>
													<span className="inline-flex items-center gap-1">
														<Heart className="h-3 w-3 text-primary" /> {player.hearts}
													</span>
													<span>•</span>
													<span>{player.totalWorkouts} workouts</span>
												</div>
											</div>
										</motion.div>
									))}
								</div>
								{/* Debts for money modes */}
								{isMoney && seasonSummary.debts && seasonSummary.debts.length > 0 && (
									<div className="mt-4 pt-4 border-t border-border">
										<div className="text-xs text-muted-foreground space-y-1">
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
								<div className="font-display tracking-widest text-primary text-lg mb-3">HIGHLIGHTS</div>
								<div className="space-y-3">
									{seasonSummary.highlights.longestStreak && (
										<div className="p-3 rounded-md border border-border bg-muted/10">
											<div className="text-xs text-muted-foreground mb-1 inline-flex items-center gap-1">
												<Flame className="h-3.5 w-3.5 text-primary" />
												<span>LONGEST STREAK</span>
											</div>
											<div className="font-display tracking-widest text-primary text-lg">{seasonSummary.highlights.longestStreak.playerName}</div>
											<div className="text-sm text-muted-foreground">{seasonSummary.highlights.longestStreak.streak} days</div>
										</div>
									)}
									{seasonSummary.highlights.mostWorkouts && (
										<div className="p-3 rounded-md border border-border bg-muted/10">
											<div className="text-xs text-muted-foreground mb-1 inline-flex items-center gap-1">
												<Dumbbell className="h-3.5 w-3.5 text-primary" />
												<span>MOST WORKOUTS</span>
											</div>
											<div className="font-display tracking-widest text-primary text-lg">{seasonSummary.highlights.mostWorkouts.playerName}</div>
											<div className="text-sm text-muted-foreground">{seasonSummary.highlights.mostWorkouts.count} total</div>
										</div>
									)}
									{seasonSummary.highlights.mostConsistent && (
										<div className="p-3 rounded-md border border-border bg-muted/10">
											<div className="text-xs text-muted-foreground mb-1 inline-flex items-center gap-1">
												<TrendingUp className="h-3.5 w-3.5 text-primary" />
												<span>MOST CONSISTENT</span>
											</div>
											<div className="font-display tracking-widest text-primary text-lg">{seasonSummary.highlights.mostConsistent.playerName}</div>
											<div className="text-sm text-muted-foreground">{seasonSummary.highlights.mostConsistent.avgPerWeek.toFixed(1)} avg/week</div>
										</div>
									)}
									{isMoney && (
										<div className="p-3 rounded-md border border-border bg-muted/10">
											<div className="text-xs text-muted-foreground mb-1 inline-flex items-center gap-1">
												<Coins className="h-3.5 w-3.5 text-primary" />
												<span>FINAL POT</span>
											</div>
											<div className="font-display tracking-widest text-primary text-2xl">${seasonSummary.finalPot}</div>
										</div>
									)}
								</div>
							</div>
						</div>

						{/* Action Buttons */}
						{isOwner && (
							<div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-border">
								<button
									onClick={() => startNextSeason()}
									disabled={loading}
									className="arena-badge arena-badge-primary px-6 py-3 rounded-md text-sm flex-1 disabled:opacity-60"
								>
									{loading ? "Starting..." : `Start Season ${seasonNumber + 1} (same rules)`}
								</button>
								<button
									onClick={() => setShowEditModal(true)}
									disabled={loading}
									className="arena-badge px-6 py-3 rounded-md text-sm flex-1 disabled:opacity-60"
								>
									Edit settings then start
								</button>
								<button
									onClick={() => router.push("/lobbies")}
									className="px-6 py-3 rounded-md border border-border text-sm hover:bg-muted/10 transition-colors disabled:opacity-60"
								>
									Return to lobbies
								</button>
							</div>
						)}
						{!isOwner && (
							<div className="pt-6 border-t border-border text-center">
								<button
									onClick={() => router.push("/lobbies")}
									className="arena-badge px-6 py-3 rounded-md text-sm"
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
