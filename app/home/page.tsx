"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LAST_LOBBY_STORAGE_KEY, type LastLobbySnapshot } from "@/lib/localStorageKeys";

export default function HomePage() {
	const [lastLobby, setLastLobby] = useState<LastLobbySnapshot | null>(null);

	useEffect(() => {
		if (typeof window === "undefined") return;
		try {
			const stored = window.localStorage.getItem(LAST_LOBBY_STORAGE_KEY);
			if (!stored) return;
			const parsed = JSON.parse(stored) as LastLobbySnapshot;
			if (parsed?.id && parsed?.name) {
				setLastLobby(parsed);
			}
		} catch {
			// ignore malformed JSON or storage errors
		}
	}, []);

	return (
		<div className="min-h-screen">
			<div className="container mx-auto max-w-3xl py-10 px-4 space-y-6">
				{lastLobby ? (
					<div className="scoreboard-panel p-6 space-y-3">
						<div className="arena-badge arena-badge-primary text-[10px]">RESUME LOBBY</div>
						<h1 className="font-display text-2xl tracking-widest text-primary">{lastLobby.name}</h1>
						<p className="text-sm text-muted-foreground">
							Jump back into the arena you visited last. We&apos;ll keep this pinned here whenever you switch lobbies.
						</p>
						<div className="flex gap-3 flex-wrap">
							<Link href={`/lobby/${encodeURIComponent(lastLobby.id)}`} className="arena-badge arena-badge-primary px-4 py-2">
								OPEN LOBBY
							</Link>
							<Link href={`/lobby/${encodeURIComponent(lastLobby.id)}/history`} className="arena-badge px-4 py-2">
								VIEW HISTORY
							</Link>
						</div>
					</div>
				) : null}

				<div className="scoreboard-panel p-6 space-y-3">
					<h2 className="font-display text-2xl tracking-widest text-primary">WELCOME BACK</h2>
					<p className="text-sm text-muted-foreground">
						Pick a lobby to see live stats, history, and season progress. Once you join a lobby it will show up in your list automatically.
					</p>
					<div className="flex gap-3 flex-wrap">
						<Link href="/lobbies" className="arena-badge arena-badge-primary px-4 py-2">
							VIEW LOBBIES
						</Link>
						<Link href="/rules" className="arena-badge px-4 py-2">
							READ THE RULES
						</Link>
					</div>
				</div>
			</div>
		</div>
	);
}
