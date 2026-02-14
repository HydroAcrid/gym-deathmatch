export const LAST_LOBBY_STORAGE_KEY = "gymdm:last-lobby";
export const LOBBY_INTERACTIONS_STORAGE_KEY = "gymdm:lobby-interactions";

export type LastLobbySnapshot = {
	id: string;
	name: string;
	mode?: string | null;
	updatedAt: string;
};

export type LobbyInteractionsSnapshot = Record<string, string>;
