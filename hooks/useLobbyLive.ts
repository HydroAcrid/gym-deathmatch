"use client";

import { useState, useEffect, useCallback } from "react";
import { LiveLobbyResponse } from "@/types/api";
import { useAutoRefresh } from "./useAutoRefresh";

export function useLobbyLive(lobbyId: string) {
	const [data, setData] = useState<LiveLobbyResponse | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<Error | null>(null);

	const reload = useCallback(async () => {
		if (!lobbyId) return;
		try {
			const res = await fetch(`/api/lobby/${encodeURIComponent(lobbyId)}/live`, { cache: "no-store" });
			if (!res.ok) throw new Error("Failed to fetch lobby data");
			const json = await res.json();
			setData(json);
			setError(null);
		} catch (err) {
			console.error(err);
			setError(err as Error);
		} finally {
			setLoading(false);
		}
	}, [lobbyId]);

	// Initial load
	useEffect(() => {
		reload();
	}, [reload]);

	// Listen for custom refresh event
	useEffect(() => {
		function handler() {
			reload();
		}
		if (typeof window !== "undefined") window.addEventListener("gymdm:refresh-live", handler);
		return () => { if (typeof window !== "undefined") window.removeEventListener("gymdm:refresh-live", handler); };
	}, [reload]);

	// Fallback polling (20s) - slightly longer than before to save battery, relying on realtime
	useAutoRefresh(() => reload(), 20000, [lobbyId]);

	return { data, loading, error, reload };
}

