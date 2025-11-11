"use client";

import { useEffect, useMemo, useState } from "react";
import type { Lobby, Player } from "@/types/game";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Countdown } from "./Countdown";
import { CountdownHero } from "./CountdownHero";

export function PreStageView({ lobby }: { lobby: Lobby }) {
	const router = useRouter();
	const [me, setMe] = useState<string | null>(null);
	useEffect(() => {
		if (typeof window !== "undefined") {
			setMe(localStorage.getItem("gymdm_playerId"));
		}
	}, []);
	const isOwner = useMemo(() => {
		// Mocked owner detection; replace with Supabase Auth user mapping later
		return !!(lobby.ownerId && me && lobby.ownerId === me);
	}, [lobby.ownerId, me]);

	const [scheduleAt, setScheduleAt] = useState<string>(lobby.scheduledStart ?? "");
	const schedule = async () => {
		await fetch(`/api/lobby/${encodeURIComponent(lobby.id)}/stage`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ status: "scheduled", scheduledStart: scheduleAt || null })
		});
		router.refresh();
	};
	const startNow = async () => {
		await fetch(`/api/lobby/${encodeURIComponent(lobby.id)}/stage`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ startNow: true })
		});
		router.refresh();
	};

	return (
		<div className="mx-auto max-w-6xl">
			<motion.div className="paper-card paper-grain ink-edge px-4 py-3 border-b-4 mb-3" style={{ borderColor: "#E1542A" }}
				initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
				<div className="flex items-center gap-3">
					<div className="poster-headline text-xl">DEATHMATCH STAGE · SEASON {lobby.seasonNumber} – WINTER GRIND</div>
				</div>
			</motion.div>

			{/* Hero Countdown */}
			<div className="mb-6">
				{lobby.status === "scheduled" && lobby.scheduledStart ? (
					<CountdownHero
						lobbyId={lobby.id}
						targetIso={lobby.scheduledStart}
						seasonLabel={`SEASON ${lobby.seasonNumber} – WINTER GRIND`}
						hostName={lobby.players.find(p => p.id === lobby.ownerId)?.name}
						numAthletes={lobby.players.length}
					/>
				) : (
					<div className="paper-card paper-grain ink-edge p-6 text-center stage-backdrop">
						<div className="poster-headline text-2xl md:text-3xl mb-2">AWAITING HOST</div>
						<div className="text-deepBrown/80 text-sm">Waiting for host to arm the Deathmatch…</div>
					</div>
				)}
			</div>

			{/* Owner Controls */}
			{isOwner && (
				<div className="paper-card paper-grain ink-edge p-4 mb-6">
					<div className="poster-headline text-base mb-2">HOST CONTROLS</div>
					<div className="flex flex-col md:flex-row items-start gap-3">
						<button onClick={startNow} className="btn-vintage px-4 py-2 rounded-md">Start Deathmatch now</button>
						<div className="flex items-center gap-2">
							<input
								type="datetime-local"
								value={scheduleAt}
								onChange={(e) => setScheduleAt(e.target.value)}
								className="bg-cream text-deepBrown border border-deepBrown/40 rounded-md px-2 py-1"
							/>
							<button onClick={schedule} className="btn-secondary px-3 py-2 rounded-md">Schedule start</button>
						</div>
					</div>
				</div>
			)}

			{/* Athletes on deck */}
			<div className="paper-card paper-grain ink-edge p-4">
				<div className="poster-headline text-base mb-3">ATHLETES ON DECK 🏋️‍♂️</div>
				<motion.div
					initial="hidden"
					animate="show"
					variants={{
						hidden: {},
						show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } }
					}}
					className="grid grid-cols-1 md:grid-cols-2 gap-3"
				>
					{lobby.players.map((p) => (
						<motion.div
							key={p.id}
							variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
							className="relative bg-cream rounded-md p-3 border border-deepBrown/20 flex items-center gap-3"
						>
							{/* Underlighting glow */}
							<div className="absolute inset-x-4 -bottom-2 h-3 rounded-full blur-md" style={{ background: "radial-gradient(ellipse at center, rgba(225,84,42,0.35), rgba(0,0,0,0))" }} />
							<div className="h-12 w-12 flex items-center justify-center rounded-full bg-tan text-xl border border-deepBrown/30">🏋️</div>
							<div className="flex-1">
								<div className="poster-headline text-base leading-4">{p.name.toUpperCase()}</div>
								<div className="text-[11px] text-deepBrown/70">{p.location || "—"}</div>
							</div>
							<div className="text-xs text-deepBrown/80 whitespace-nowrap">{p.currentStreak}-day streak</div>
							{p.isStravaConnected ? (
								<span className="ml-2 px-2 py-0.5 rounded text-[10px] bg-[#2b6b2b] text-cream flicker-fast">READY</span>
							) : (
								<span className="ml-2 px-2 py-0.5 rounded text-[10px] bg-[#6b2b2b] text-cream">OFFLINE</span>
							)}
						</motion.div>
					))}
				</motion.div>
			</div>
		</div>
	);
}


