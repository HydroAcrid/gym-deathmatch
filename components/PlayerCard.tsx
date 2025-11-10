"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Player } from "@/types/game";
import { HeartDisplay } from "./HeartDisplay";
import { QuipBubble } from "./QuipBubble";

export function PlayerCard({ player }: { player: Player }) {
	const avatar = player.avatarUrl || "";
	return (
		<motion.div
			className="paper-card paper-grain ink-edge p-5 flex flex-col gap-4 relative overflow-hidden transition-shadow duration-300"
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
				<div className="ml-auto">
					{player.isStravaConnected ? (
						<span className="text-[10px] px-2 py-1 rounded-md border text-deepBrown border-deepBrown/40 bg-cream">
							CONNECTED
						</span>
					) : (
						<Link
							href={`/api/strava/authorize?playerId=${encodeURIComponent(player.id)}`}
							className="btn-vintage px-3 py-2 rounded-md text-[10px]"
						>
							CONNECT STRAVA
						</Link>
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

			<HeartDisplay lives={player.livesRemaining} />
			<QuipBubble text={player.quip} />
		</motion.div>
	);
}


