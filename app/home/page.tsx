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
		<div className="mx-auto max-w-3xl py-10 px-4 space-y-6">
			{lastLobby ? (
				<div className="paper-card paper-grain ink-edge p-6 border-b-4" style={{ borderColor: "#E1542A" }}>
					<div className="text-[12px] text-deepBrown/60 uppercase tracking-wide mb-1">Resume lobby</div>
					<h1 className="poster-headline text-2xl mb-1">{lastLobby.name}</h1>
					<p className="text-sm text-deepBrown/70">
						Jump back into the arena you visited last. We&apos;ll keep this pinned here whenever you switch lobbies.
					</p>
					<div className="mt-4 flex gap-3 flex-wrap">
						<Link href={`/lobby/${encodeURIComponent(lastLobby.id)}`} className="btn-vintage px-4 py-2 rounded-md text-xs">
							Open lobby
						</Link>
						<Link href={`/lobby/${encodeURIComponent(lastLobby.id)}/history`} className="btn-secondary px-4 py-2 rounded-md text-xs">
							View history
						</Link>
					</div>
				</div>
			) : null}

			<div className="paper-card paper-grain ink-edge p-6 border-b-4" style={{ borderColor: "#E1542A" }}>
				<h2 className="poster-headline text-2xl mb-2">Welcome back</h2>
				<p className="text-sm text-deepBrown/70">
					Pick a lobby to see live stats, history, and season progress. Once you join a lobby it will show up in your list automatically.
				</p>
				<div className="mt-4 flex gap-3 flex-wrap">
					<Link href="/lobbies" className="btn-vintage px-4 py-2 rounded-md text-xs">
						View lobbies
					</Link>
					<Link href="/rules" className="btn-secondary px-4 py-2 rounded-md text-xs">
						Read the rules
					</Link>
				</div>
			</div>
		</div>
	);
}
