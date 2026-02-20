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

export interface LobbyPunishmentItem {
	id: string;
	text: string;
	week: number;
	created_by?: string | null;
	week_status?: string | null;
}

export interface LobbySpinEvent {
	spinId: string;
	startedAt: string;
	winnerItemId: string;
	week: number;
}

export interface LobbyPunishmentWeekContext {
	week: number;
	hasItems: boolean;
	hasSpinEvent: boolean;
	hasActive: boolean;
	status: "PENDING_PUNISHMENT" | "PENDING_CONFIRMATION" | "ACTIVE" | "COMPLETE" | "UNKNOWN";
}

export interface LobbyPunishmentsResponse {
	week: number;
	items: LobbyPunishmentItem[];
	active: LobbyPunishmentItem | null;
	locked: boolean;
	weekStatus: string | null;
	needsSpin?: boolean;
	weekContext?: LobbyPunishmentWeekContext;
	spinEvent: LobbySpinEvent | null;
}
