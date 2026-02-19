"use client";

import { Player } from "@/types/game";
import { HeartDisplay } from "./HeartDisplay";
import { QuipBubble } from "./QuipBubble";
import { ManualActivityModal } from "./ManualActivityModal";
import { useState } from "react";
import { useAuth } from "./AuthProvider";
import { StatusBadge } from "./StatusBadge";
import { MapPin, Flame, Target, Trophy } from "lucide-react";
import { authFetch } from "@/lib/clientAuth";

export function PlayerCard({ player, lobbyId, mePlayerId, showReady }: { player: Player; lobbyId?: string; mePlayerId?: string; showReady?: boolean }) {
	const avatar = player.avatarUrl || "";
	const [openManual, setOpenManual] = useState(false);
	const { user } = useAuth();
	const isMe = (mePlayerId && mePlayerId === player.id) || (!!user?.id && !!player.userId && user.id === player.userId);
	const isEliminated = player.livesRemaining === 0;
	const initials = (player.name || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

	return (
		<div className={`athlete-card p-4 sm:p-5 h-full flex flex-col ${isEliminated ? "opacity-50" : ""}`}>
			{/* Header with avatar and status */}
			<div className="flex items-start justify-between mb-3 sm:mb-4">
				<div className="flex items-center gap-3">
					<div className="relative">
						<div className="w-12 h-12 sm:w-14 sm:h-14 bg-muted border-2 border-border flex items-center justify-center overflow-hidden">
							{avatar ? (
								<img src={avatar} alt={`${player.name} avatar`} className="h-full w-full object-cover" />
							) : (
								<span className="text-xl sm:text-2xl font-display font-bold text-muted-foreground">
									{initials}
								</span>
							)}
						</div>
					</div>
					<div>
						<h3 className="font-display text-base sm:text-lg font-bold text-foreground tracking-wider">
							{player.name.toUpperCase()}
						</h3>
						{player.location && (
							<div className="flex items-center gap-1 text-[10px] sm:text-xs text-muted-foreground font-display tracking-wider">
								<MapPin className="w-3 h-3" />
								{player.location}
							</div>
						)}
					</div>
				</div>
				
				<div className="flex flex-col items-end gap-1">
					{player.inSuddenDeath && player.livesRemaining > 0 && (
						<span className="arena-badge arena-badge-destructive text-[10px]">SUDDEN DEATH</span>
					)}
					{isEliminated && (
						<span className="arena-badge text-[10px] text-muted-foreground">ELIMINATED</span>
					)}
					{showReady && typeof player.ready === "boolean" && (
						<span className={`arena-badge text-[10px] ${player.ready ? "arena-badge-primary" : ""}`}>
							{player.ready ? "READY" : "NOT READY"}
						</span>
					)}
					{player.isStravaConnected ? (
						<div className="flex items-center gap-2">
							<StatusBadge status="connected" className="mr-2" />
							{isMe && lobbyId && (
								<button
									onClick={async () => {
										await authFetch(`/api/strava/disconnect`, {
											method: "POST",
											headers: { "Content-Type": "application/json" },
											body: JSON.stringify({ playerId: player.id })
										});
										if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("gymdm:refresh-live"));
									}}
									className="arena-badge text-[10px]"
								>
									Disconnect
								</button>
							)}
						</div>
					) : (
						isMe ? (
							<a
								href={`/api/strava/authorize?playerId=${encodeURIComponent(player.id)}&lobbyId=${encodeURIComponent(lobbyId ?? "")}`}
								className="arena-badge arena-badge-primary px-3 py-2 text-[10px]"
							>
								CONNECT STRAVA
							</a>
						) : null
					)}
				</div>
			</div>

			{/* Divider */}
			<div className="arena-divider-solid mb-3 sm:mb-4" />

			{/* Stats grid - industrial readout style */}
			<div className="grid grid-cols-4 gap-1 sm:gap-2">
				<div className="stat-block">
					<div className="stat-value text-lg sm:text-xl">{player.totalWorkouts}</div>
					<div className="stat-label text-[8px] sm:text-[10px]">WORKOUTS</div>
				</div>
				<div className="stat-block">
					<div className="stat-value text-lg sm:text-xl flex items-center justify-center gap-1">
						{player.currentStreak}
						<Flame className="w-3 h-3 sm:w-4 sm:h-4 text-primary" />
					</div>
					<div className="stat-label text-[8px] sm:text-[10px]">STREAK</div>
				</div>
				<div className="stat-block">
					<div className="stat-value text-lg sm:text-xl">{player.averageWorkoutsPerWeek.toFixed(1)}</div>
					<div className="stat-label text-[8px] sm:text-[10px]">AVG/WK</div>
				</div>
				<div className="stat-block">
					<div className="stat-value text-lg sm:text-xl">{player.longestStreak}</div>
					<div className="stat-label text-[8px] sm:text-[10px]">BEST</div>
				</div>
			</div>

			{/* Hearts & Weekly goal */}
			<div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t-2 border-border">
				<div className="flex items-center justify-between">
					<HeartDisplay lives={player.livesRemaining} maxLives={3} />
					{typeof player.weeklyTarget === "number" && (
						<span className="arena-badge arena-badge-primary text-[10px]">
							<Target className="w-3 h-3 mr-1 inline" />
							GOAL: {player.weeklyTarget}/WK
						</span>
					)}
				</div>
			</div>

			{/* Manual log CTA */}
			<div className="mt-3 min-h-[44px] flex items-start">
				{isMe && lobbyId ? (
					<button className="arena-badge arena-badge-primary px-3 py-2 text-xs min-h-[44px] w-full text-center" onClick={() => setOpenManual(true)}>
						LOG WORKOUT
					</button>
				) : (
					<div className="h-[44px] w-0" aria-hidden />
				)}
			</div>
			<div className="mt-3">
				<QuipBubble text={player.quip} />
			</div>
			{lobbyId && (
				<ManualActivityModal
					open={openManual}
					onClose={() => setOpenManual(false)}
					lobbyId={lobbyId}
					onSaved={() => {
						try {
							if (typeof window !== "undefined") {
								window.dispatchEvent(new CustomEvent("gymdm:refresh-live"));
							}
						} catch { /* ignore */ }
					}}
				/>
			)}
		</div>
	);
}
