export const LAST_LOBBY_STORAGE_KEY = "gymdm:last-lobby";
export const MANUAL_ACTIVITY_TARGETS_CACHE_KEY = "gymdm:manual-activity-targets";
export const LOBBY_INTERACTIONS_STORAGE_KEY = "gymdm:lobby-interactions";
export const SEASON_FINALE_SEEN_PREFIX = "gymdm:season-finale-seen";
export const WHATS_NEW_SEEN_RELEASE_KEY = "gymdm:whats-new:last-seen-release";

export type LastLobbySnapshot = {
	id: string;
	name: string;
	mode?: string | null;
	updatedAt: string;
};

export type LobbyInteractionsSnapshot = Record<string, string>;
