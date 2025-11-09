import { Lobby, LobbyId } from "@/types/game";
import { defaultLobby } from "@/data/mockLobby";

export function getLobbyById(lobbyId: LobbyId): Lobby | null {
	// TODO: replace with DB call when persistence is added
	if (lobbyId === defaultLobby.id) return structuredClone(defaultLobby);
	return null;
}

export function getDefaultLobby(): Lobby {
	// TODO: replace with DB call when persistence is added
	return structuredClone(defaultLobby);
}


