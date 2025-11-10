"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type LobbyRow = {
	id: string; name: string; season_number: number; cash_pool: number;
};

export default function LobbiesPage() {
	const [lobbies, setLobbies] = useState<LobbyRow[]>([]);
	const [playerId, setPlayerId] = useState<string | null>(null);

	useEffect(() => {
		const me = localStorage.getItem("gymdm_playerId");
		setPlayerId(me);
		const url = me ? `/api/lobbies?playerId=${encodeURIComponent(me)}` : "/api/lobbies";
		fetch(url).then(r => r.json()).then(d => setLobbies(d.lobbies ?? [])).catch(() => {});
	}, []);

	return (
		<div className="mx-auto max-w-6xl">
			<div className="paper-card paper-grain ink-edge p-5 mb-6 border-b-4" style={{ borderColor: "#E1542A" }}>
				<div className="poster-headline text-lg mb-1">YOUR LOBBIES</div>
				<div className="text-deepBrown/70 text-xs">
					{playerId ? `Player: ${playerId}` : "Not joined yet — use Join Lobby to create your player"}
				</div>
			</div>
			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				{lobbies.map((l: any) => (
					<Link key={l.id} href={`/lobby/${l.id}`} className="paper-card paper-grain ink-edge p-4 hover:brightness-110 transition">
						<div className="poster-headline text-xl">{l.name}</div>
						<div className="text-deepBrown/70 text-xs">Season {l.season_number} • Pot ${l.cash_pool}</div>
					</Link>
				))}
				{lobbies.length === 0 && (
					<div className="text-deepBrown/70 text-sm">No lobbies yet. Create/join one from the navbar.</div>
				)}
			</div>
		</div>
	);
}


