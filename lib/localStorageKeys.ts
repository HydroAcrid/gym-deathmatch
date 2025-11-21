export const LAST_LOBBY_STORAGE_KEY = "gymdm:last-lobby";

export type LastLobbySnapshot = {
	id: string;
	name: string;
	mode?: string | null;
	updatedAt: string;
};
