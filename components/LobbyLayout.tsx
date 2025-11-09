"use client";

import { useMemo, useState } from "react";
import { Lobby, Player } from "@/types/game";
import { motion } from "framer-motion";
import { Countdown } from "./Countdown";
import { CashPool } from "./CashPool";
import { PlayerCard } from "./PlayerCard";
import { InvitePlayerCard } from "./InvitePlayerCard";
import { useSearchParams } from "next/navigation";

export function LobbyLayout({ lobby }: { lobby: Lobby }) {
	const [players, setPlayers] = useState<Player[]>(lobby.players);
	const search = useSearchParams();
	const stravaConnected = search.get("stravaConnected");
	const connectedPlayerId = search.get("playerId");

	const banner = useMemo(() => {
		if (stravaConnected === "1" && connectedPlayerId) {
			const name = players.find(p => p.id === connectedPlayerId)?.name ?? "A player";
			return `${name} connected Strava ✅`;
		}
		return null;
	}, [stravaConnected, connectedPlayerId, players]);

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
			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				{players.map((p) => (
					<PlayerCard key={p.id} player={p} />
				))}
				<InvitePlayerCard onAdd={(np) => setPlayers(prev => [...prev, np])} />
			</div>
		</div>
	);
}


