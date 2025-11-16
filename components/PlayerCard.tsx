"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Player } from "@/types/game";
import { HeartDisplay } from "./HeartDisplay";
import { QuipBubble } from "./QuipBubble";
import { ManualActivityModal } from "./ManualActivityModal";
import { useState } from "react";
import { useAuth } from "./AuthProvider";
import { StatusBadge } from "./StatusBadge";

export function PlayerCard({ player, lobbyId, mePlayerId, showReady }: { player: Player; lobbyId?: string; mePlayerId?: string; showReady?: boolean }) {
	const avatar = player.avatarUrl || "";
	const [openManual, setOpenManual] = useState(false);
	const { user } = useAuth();
	const isMe = (mePlayerId && mePlayerId === player.id) || (!!user?.id && !!player.userId && user.id === player.userId);
	return (
		<motion.div
			className={`paper-card paper-grain ink-edge p-5 flex flex-col gap-4 relative overflow-hidden transition-shadow duration-300 min-h-[520px] h-full ${player.livesRemaining === 0 ? "opacity-80" : ""}`}
			initial={{ opacity: 0, scale: 0.96, y: 12 }}
			animate={{ opacity: 1, scale: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } }}
			whileHover={{ y: -4, boxShadow: "0 6px 14px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)" }}
		>
			{/* Burnt orange stripe */}
			<div className="absolute left-0 top-0 bottom-0 w-2" style={{ backgroundColor: "#E1542A" }} />

			<div className="flex items-center gap-3 pl-2">
				<div className="relative h-16 w-16 rounded-md overflow-hidden border-2" style={{ borderColor: "#4A2620" }}>
					{avatar ? (
						<Image src={avatar} alt={`${player.name} avatar`} fill sizes="56px" className="object-cover" />
					) : (
						<div className="h-full w-full flex items-center justify-center text-2xl bg-tan">🏋️</div>
					)}
				</div>
				<div className="flex flex-col">
					<div className="text-[10px] text-deepBrown/70">ATHLETE</div>
					<div className="poster-headline text-2xl leading-5">{player.name.toUpperCase()}</div>
					{player.location && <div className="text-xs text-deepBrown/70">{player.location}</div>}
				</div>
				{/* Top-right status/actions with a reserved height so the card doesn't jump when buttons appear */}
				<div className="ml-auto flex flex-col items-end gap-1 min-h-[48px]">
					{player.inSuddenDeath && player.livesRemaining > 0 && (
						<span className="mr-2 text-[10px] px-2 py-1 rounded-md border text-deepBrown border-deepBrown/40 bg-cream">
							SUDDEN DEATH ⚡
						</span>
					)}
					{player.livesRemaining === 0 && (
						<span className="mr-2 text-[10px] px-2 py-1 rounded-md border text-deepBrown border-deepBrown/40 bg-cream">
							KO’D 💀
						</span>
					)}
					{showReady && typeof player.ready === "boolean" && (
						<span className={`mr-2 text-[10px] px-2 py-1 rounded-md border ${player.ready ? "bg-[#2b6b2b] text-cream border-transparent" : "text-deepBrown border-deepBrown/40 bg-cream"}`}>
							{player.ready ? "READY ✅" : "NOT READY ⏳"}
						</span>
					)}
					{player.isStravaConnected ? (
						<div className="flex items-center gap-2">
							<StatusBadge status="connected" className="mr-2" />
							{isMe && lobbyId && (
								<button
									onClick={async () => {
										await fetch(`/api/strava/disconnect`, {
											method: "POST",
											headers: { "Content-Type": "application/json" },
											body: JSON.stringify({ playerId: player.id, userId: user?.id || null })
										});
										if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("gymdm:refresh-live"));
									}}
									className="px-2 py-1 rounded-md border border-deepBrown/30 text-[10px]"
								>
									Disconnect
								</button>
							)}
						</div>
					) : (
						isMe ? (
							<a
								href={`/api/strava/authorize?playerId=${encodeURIComponent(player.id)}&lobbyId=${encodeURIComponent(lobbyId ?? "kevin-nelly")}`}
								className="btn-vintage px-3 py-2 rounded-md text-[10px] transition-all duration-300"
							>
								CONNECT STRAVA
							</a>
						) : null
					)}
				</div>
			</div>

			<div className="grid grid-cols-2 gap-3 pl-2">
				<div className="bg-cream rounded-md p-3 border border-deepBrown/20">
					<div className="text-[10px] text-deepBrown/70">🔥 CURRENT FORM</div>
					<div className="poster-headline text-xl">{player.currentStreak}-DAY STREAK</div>
				</div>
				<div className="bg-cream rounded-md p-3 border border-deepBrown/20">
					<div className="text-[10px] text-deepBrown/70">🏅 LONGEST</div>
					<div className="poster-headline text-xl">{player.longestStreak} DAYS</div>
				</div>
				<div className="bg-cream rounded-md p-3 border border-deepBrown/20">
					<div className="text-[10px] text-deepBrown/70">📈 AVG/WK</div>
					<div className="poster-headline text-xl">{player.averageWorkoutsPerWeek.toFixed(1)}</div>
				</div>
				<div className="bg-cream rounded-md p-3 border border-deepBrown/20">
					<div className="text-[10px] text-deepBrown/70">✅ TOTAL</div>
					<div className="poster-headline text-xl">{player.totalWorkouts}</div>
				</div>
			</div>

			<div className="pl-2">
				<HeartDisplay lives={player.livesRemaining} />
				{typeof player.weeklyTarget === "number" && (
					<div className="text-[11px] text-deepBrown/70 mt-1">Weekly goal: {player.weeklyTarget} workouts</div>
				)}
			</div>
			{/* Reserve a consistent space for the manual log CTA so card heights align even when the button is hidden */}
			<div className="pl-2 min-h-[48px] flex items-start">
				{isMe && lobbyId ? (
					<button className="px-3 py-2 rounded-md border border-deepBrown/30 text-xs min-h-[44px]" onClick={() => setOpenManual(true)}>
						Log workout manually
					</button>
				) : (
					<div className="h-[44px] w-0" aria-hidden />
				)}
			</div>
			<QuipBubble text={player.quip} />
			{lobbyId && (
				<ManualActivityModal
					open={openManual}
					onClose={() => setOpenManual(false)}
					lobbyId={lobbyId}
					playerId={player.id}
					onSaved={() => {
						try {
							// soft refresh data by reloading /live through a custom event
							if (typeof window !== "undefined") {
								window.dispatchEvent(new CustomEvent("gymdm:refresh-live"));
							}
						} catch { /* ignore */ }
					}}
				/>
			)}
		</motion.div>
	);
}


