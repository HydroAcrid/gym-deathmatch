export const LAST_LOBBY_STORAGE_KEY = "gymdm:last-lobby";
export const MANUAL_ACTIVITY_TARGETS_CACHE_KEY = "gymdm:manual-activity-targets";

export type LastLobbySnapshot = {
	id: string;
	name: string;
	mode?: string | null;
	updatedAt: string;
};
