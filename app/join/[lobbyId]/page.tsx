"use client";

import { useParams } from "next/navigation";
import { JoinLobby } from "@/components/JoinLobby";

export default function JoinLobbyPage() {
	const params = useParams<{ lobbyId: string }>();
	const lobbyId = params?.lobbyId ?? "kevin-nelly";
	return (
		<div className="ui2-scope min-h-screen">
			<div className="container mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
				<div className="scoreboard-panel p-5 text-center">
					<div className="font-display text-lg tracking-widest text-primary">JOIN LOBBY</div>
					<div className="text-muted-foreground text-xs">Lobby: {lobbyId}</div>
				</div>
				<JoinLobby lobbyId={String(lobbyId)} />
			</div>
		</div>
	);
}


