"use client";

import { useParams } from "next/navigation";
import { JoinLobby } from "@/components/JoinLobby";

export default function JoinLobbyPage() {
	const params = useParams<{ lobbyId: string }>();
	const lobbyId = params?.lobbyId ?? "kevin-nelly";
	return (
		<div className="mx-auto max-w-3xl">
			<div className="paper-card paper-grain ink-edge p-5 mb-6 border-b-4" style={{ borderColor: "#E1542A" }}>
				<div className="poster-headline text-lg">Join Lobby</div>
				<div className="text-deepBrown/70 text-xs">Lobby: {lobbyId}</div>
			</div>
			<JoinLobby lobbyId={String(lobbyId)} />
		</div>
	);
}


