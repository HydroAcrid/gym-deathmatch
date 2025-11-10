"use client";

import { useMemo, useState } from "react";
import { Lobby, Player } from "@/types/game";
import { motion } from "framer-motion";
import { Countdown } from "./Countdown";
import { CashPool } from "./CashPool";
import { PlayerCard } from "./PlayerCard";
import { InvitePlayerCard } from "./InvitePlayerCard";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

export function LobbyLayout({ lobby }: { lobby: Lobby }) {
	const [players, setPlayers] = useState<Player[]>(lobby.players);
	const search = useSearchParams();
	const stravaConnected = search.get("stravaConnected");
	const connectedPlayerId = search.get("playerId");
	const stravaError = search.get("stravaError");
	const container = {
		hidden: {},
		show: {
			transition: {
				staggerChildren: 0.08,
				delayChildren: 0.12
			}
		}
	};
	const item = {
		hidden: { opacity: 0, y: 12, scale: 0.98 },
		show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4, ease: "easeOut" } }
	};

	const banner = useMemo(() => {
		if (stravaConnected === "1" && connectedPlayerId) {
			const name = players.find(p => p.id === connectedPlayerId)?.name ?? "A player";
			return `${name} connected Strava ✅`;
		}
		if (stravaError === "1" && connectedPlayerId) {
			const name = players.find(p => p.id === connectedPlayerId)?.name ?? "A player";
			return `${name}: Strava connection failed. Please try again.`;
		}
		return null;
	}, [stravaConnected, stravaError, connectedPlayerId, players]);

	useEffect(() => {
		let ignore = false;
		async function loadLive() {
			try {
				const res = await fetch(`/api/lobby/${encodeURIComponent(lobby.id)}/live`, { cache: "no-store" });
				if (!res.ok) return;
				const data = await res.json();
				if (ignore) return;
				if (data?.lobby?.players) {
					setPlayers(data.lobby.players);
				}
			} catch {
				// ignore network errors; show mock values
			}
		}
		loadLive();
		// re-fetch after connect or error banners too
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [lobby.id, stravaConnected, stravaError]);

	return (
		<div className="mx-auto max-w-6xl">
			{/* Season header strip */}
			<div className="relative mb-6">
				<motion.div className="paper-card paper-grain ink-edge px-4 py-3 border-b-4" style={{ borderColor: "#E1542A" }}>
					<div className="flex flex-wrap items-center gap-3">
						<div className="poster-headline text-lg">{lobby.name.toUpperCase()}</div>
						<div className="text-xs text-deepBrown/70">SEASON {lobby.seasonNumber} · WINTER GRIND</div>
						<div className="ml-auto">
							<Countdown endIso={lobby.seasonEnd} />
						</div>
					</div>
				</motion.div>
				{banner && (
					<div className="mt-2 text-xs bg-cream border border-deepBrown/40 text-deepBrown px-3 py-2 rounded-md ink-edge">
						{banner}
					</div>
				)}
			</div>

			{/* Cash Pool */}
			<div className="mb-6">
				<CashPool amount={lobby.cashPool} />
			</div>

			{/* Players grid */}
			<motion.div className="grid grid-cols-1 md:grid-cols-2 gap-4" variants={container} initial="hidden" animate="show">
				{players.map((p) => (
					<motion.div key={p.id} variants={item}>
						<PlayerCard player={p} />
					</motion.div>
				))}
				<motion.div variants={item}>
					<InvitePlayerCard lobbyId={lobby.id} onAdd={(np) => setPlayers(prev => [...prev, np])} />
				</motion.div>
			</motion.div>
		</div>
	);
}


