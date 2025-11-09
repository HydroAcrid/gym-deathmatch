import { PlayerId } from "@/types/game";
import { StravaTokens } from "./strava";

const tokenStore = new Map<PlayerId, StravaTokens>();

export function setTokensForPlayer(playerId: PlayerId, tokens: StravaTokens) {
	tokenStore.set(playerId, tokens);
}

export function getTokensForPlayer(playerId: PlayerId): StravaTokens | undefined {
	return tokenStore.get(playerId);
}

// Note: This is NOT persistent. Replace with DB-backed storage later.


