import type { Lobby, PlayerId, LobbyStage, SeasonSummary } from "@/types/game";

export interface LiveLobbyResponse {
	lobby: Lobby;
	fetchedAt: string; // ISO timestamp
	errors?: Array<{ playerId: PlayerId; reason: string }>;
	seasonStatus?: "pending" | "scheduled" | "transition_spin" | "active" | "completed";
	stage?: LobbyStage; // Primary stage machine state
	seasonSummary?: SeasonSummary | null; // Populated when stage === "COMPLETED"
	koEvent?: { loserPlayerId: PlayerId; potAtKO: number; winnerPlayerId?: PlayerId };
}


