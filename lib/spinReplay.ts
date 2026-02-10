export function spinReplayStorageKey(lobbyId: string, spinId: string): string {
	return `gymdm:spin-seen:${lobbyId}:${spinId}`;
}

export function hasSeenSpinReplay(lobbyId: string, spinId: string): boolean {
	if (typeof window === "undefined") return false;
	try {
		return window.localStorage.getItem(spinReplayStorageKey(lobbyId, spinId)) === "1";
	} catch {
		return false;
	}
}

export function markSpinReplaySeen(lobbyId: string, spinId: string): void {
	if (typeof window === "undefined") return;
	try {
		window.localStorage.setItem(spinReplayStorageKey(lobbyId, spinId), "1");
	} catch {
		// ignore storage errors
	}
}
