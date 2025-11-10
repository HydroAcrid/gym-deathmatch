"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { OwnerSettingsModal } from "@/components/OwnerSettingsModal";

type LobbyRow = {
	id: string; name: string; season_number: number; cash_pool: number;
	season_start?: string; season_end?: string; weekly_target?: number; initial_lives?: number; owner_id?: string;
};

export default function LobbiesPage() {
	const [lobbies, setLobbies] = useState<LobbyRow[]>([]);
	const [playerId, setPlayerId] = useState<string | null>(null);
	const [editLobby, setEditLobby] = useState<LobbyRow | null>(null);

	useEffect(() => {
		const me = localStorage.getItem("gymdm_playerId");
		setPlayerId(me);
		fetch("/api/lobbies").then(r => r.json()).then(d => setLobbies(d.lobbies ?? [])).catch(() => {});
	}, []);

	return (
		<div className="mx-auto max-w-6xl">
			<div className="paper-card paper-grain ink-edge p-5 mb-6 border-b-4" style={{ borderColor: "#E1542A" }}>
				<div className="poster-headline text-lg mb-1">LOBBIES</div>
				<div className="text-deepBrown/70 text-xs">
					{playerId ? `Signed in as player: ${playerId}` : "Not joined yet — use Join Lobby to create your player"}
				</div>
			</div>
			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				{lobbies.map((l) => (
					<div key={l.id} className="paper-card paper-grain ink-edge p-4">
						<div className="flex items-center justify-between">
							<Link href={`/lobby/${l.id}`} className="poster-headline text-xl hover:underline">
								{l.name}
							</Link>
							{playerId && l.owner_id === playerId && (
								<button className="btn-vintage-teal px-3 py-2 rounded-md text-xs"
									onClick={() => setEditLobby(l)}>
									Edit
								</button>
							)}
						</div>
						<div className="text-deepBrown/70 text-xs mt-1">Season {l.season_number} • Pot ${l.cash_pool}</div>
						{l.season_start && l.season_end && (
							<div className="text-deepBrown/70 text-[11px] mt-1">
								{new Date(l.season_start).toLocaleDateString()} → {new Date(l.season_end).toLocaleDateString()}
							</div>
						)}
						{typeof l.weekly_target === "number" && typeof l.initial_lives === "number" && (
							<div className="text-deepBrown/70 text-[11px] mt-1">
								Target {l.weekly_target}/wk • Lives {l.initial_lives}
							</div>
						)}
					</div>
				))}
				{lobbies.length === 0 && (
					<div className="text-deepBrown/70 text-sm">No lobbies yet. Create one from the navbar.</div>
				)}
			</div>
			{editLobby && playerId && editLobby.owner_id === playerId && (
				<OwnerSettingsModal
					lobbyId={editLobby.id}
					defaultWeekly={editLobby.weekly_target ?? 3}
					defaultLives={editLobby.initial_lives ?? 3}
					defaultSeasonEnd={editLobby.season_end ?? new Date().toISOString()}
					autoOpen
					hideTrigger
					onSaved={() => { setEditLobby(null); fetch("/api/lobbies").then(r=>r.json()).then(d=>setLobbies(d.lobbies??[])); }}
					onClose={() => setEditLobby(null)}
				/>
			)}
		</div>
	);
}


