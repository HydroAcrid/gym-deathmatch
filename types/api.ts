import type { Lobby, PlayerId } from "@/types/game";

export interface LiveLobbyResponse {
	lobby: Lobby;
	fetchedAt: string; // ISO timestamp
	errors?: Array<{ playerId: PlayerId; reason: string }>;
}


