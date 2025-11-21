"use client";

import { useEffect, useState } from "react";
import { LAST_LOBBY_STORAGE_KEY, type LastLobbySnapshot } from "@/lib/localStorageKeys";

export function useLastLobbySnapshot() {
	const [snapshot, setSnapshot] = useState<LastLobbySnapshot | null>(null);

	useEffect(() => {
		if (typeof window === "undefined") return;

		const read = () => {
			try {
				const raw = window.localStorage.getItem(LAST_LOBBY_STORAGE_KEY);
				if (!raw) {
					setSnapshot(null);
					return;
				}
				const parsed = JSON.parse(raw) as LastLobbySnapshot;
				if (parsed?.id && parsed?.name) setSnapshot(parsed);
			} catch {
				// ignore
			}
		};

		read();
		const handler = () => read();
		window.addEventListener("storage", handler);
		window.addEventListener("gymdm:last-lobby", handler as EventListener);
		return () => {
			window.removeEventListener("storage", handler);
			window.removeEventListener("gymdm:last-lobby", handler as EventListener);
		};
	}, []);

	return snapshot;
}
