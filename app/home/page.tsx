"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLastLobbySnapshot } from "@/hooks/useLastLobby";

export default function HomePage() {
	const router = useRouter();
	const lastLobby = useLastLobbySnapshot();

	useEffect(() => {
		if (!lastLobby?.id) return;
		router.replace(`/lobby/${encodeURIComponent(lastLobby.id)}`);
	}, [lastLobby?.id, router]);

	if (lastLobby?.id) {
		return (
			<div className="min-h-screen">
				<div className="container mx-auto max-w-3xl py-10 px-4 space-y-6">
					<div className="scoreboard-panel p-6 space-y-3">
						<div className="arena-badge arena-badge-primary text-[10px]">RESUMING LOBBY</div>
						<h1 className="font-display text-2xl tracking-widest text-primary">{lastLobby.name}</h1>
						<p className="text-sm text-muted-foreground">
							Taking you back to your most recent lobby.
						</p>
						<div className="flex gap-3 flex-wrap">
							<Link href={`/lobby/${encodeURIComponent(lastLobby.id)}`} className="arena-badge arena-badge-primary px-4 py-2">
								OPEN NOW
							</Link>
							<Link href="/lobbies" className="arena-badge px-4 py-2">
								CHOOSE ANOTHER
							</Link>
						</div>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen">
			<div className="container mx-auto max-w-3xl py-10 px-4 space-y-6">
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
