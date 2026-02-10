"use client";

import { useEffect, useRef } from "react";
import { getBrowserSupabase } from "@/lib/supabaseBrowser";

/**
 * Subscribes to Supabase Realtime changes for a specific lobby.
 * Triggers a callback or dispatches 'gymdm:refresh-live' when relevant tables change.
 */
export function useLobbyRealtime(lobbyId: string | null, options?: { onChange?: () => void }) {
	const onChangeRef = useRef(options?.onChange);

	useEffect(() => {
		onChangeRef.current = options?.onChange;
	}, [options?.onChange]);

	useEffect(() => {
		if (!lobbyId) return;
		const supabase = getBrowserSupabase();
		if (!supabase) return;

		const channel = supabase.channel(`lobby:${lobbyId}`);

		const handleChange = () => {
			if (onChangeRef.current) {
				onChangeRef.current();
			} else {
				// Default to dispatching the global refresh event
				if (typeof window !== "undefined") {
					window.dispatchEvent(new CustomEvent("gymdm:refresh-live", { detail: { lobbyId } }));
				}
			}
		};

		// Subscribe to all relevant tables filtered by this lobby
		// Note: Some tables might not have lobby_id directly or might need different filters
		// For simple lobby sync, these cover most cases.
			// NOTE: "comments" table is intentionally excluded from this channel.
			// Feed refresh is handled independently by feed polling to avoid UI refresh storms.
			channel
			.on("postgres_changes", { event: "*", schema: "public", table: "lobby", filter: `id=eq.${lobbyId}` }, handleChange)
			.on("postgres_changes", { event: "*", schema: "public", table: "player", filter: `lobby_id=eq.${lobbyId}` }, handleChange)
			.on("postgres_changes", { event: "*", schema: "public", table: "manual_activities", filter: `lobby_id=eq.${lobbyId}` }, handleChange)
			.on("postgres_changes", { event: "*", schema: "public", table: "history_events", filter: `lobby_id=eq.${lobbyId}` }, handleChange)
			.on("postgres_changes", { event: "*", schema: "public", table: "heart_adjustments", filter: `lobby_id=eq.${lobbyId}` }, handleChange)
			.on("postgres_changes", { event: "*", schema: "public", table: "lobby_punishments", filter: `lobby_id=eq.${lobbyId}` }, handleChange)
			.on("postgres_changes", { event: "*", schema: "public", table: "week_ready_states", filter: `lobby_id=eq.${lobbyId}` }, handleChange)
			.on("postgres_changes", { event: "*", schema: "public", table: "user_ready_states", filter: `lobby_id=eq.${lobbyId}` }, handleChange)
			.subscribe();

		return () => {
			supabase.removeChannel(channel);
		};
	}, [lobbyId]);
}
