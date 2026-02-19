import type { LiveLobbyResponse } from "@/types/api";
import { getServerSupabase } from "@/lib/supabaseClient";
import { buildLiveLobbyResponse } from "@/lib/liveSnapshot";
import { logError } from "@/lib/logger";

const SNAPSHOT_TTL_MS = 15 * 1000;

type SnapshotRow = {
	payload: LiveLobbyResponse | null;
	updated_at: string;
};

function normalizeOffset(offset?: number | null): number {
	if (!Number.isFinite(offset as number)) return 0;
	const rounded = Math.round(Number(offset));
	if (rounded < -840 || rounded > 840) return 0;
	return rounded;
}

export async function getLobbyLiveSnapshot(lobbyId: string, timezoneOffsetMinutes?: number | null): Promise<LiveLobbyResponse | null> {
	const supabase = getServerSupabase();
	if (!supabase) return null;
	const tz = normalizeOffset(timezoneOffsetMinutes);
	try {
		const { data } = await supabase
			.from("lobby_live_snapshots")
			.select("payload,updated_at")
			.eq("lobby_id", lobbyId)
			.eq("timezone_offset_minutes", tz)
			.maybeSingle();
		const row = (data as SnapshotRow | null) ?? null;
		if (!row?.payload) return null;
		const updatedAt = new Date(row.updated_at).getTime();
		if (!Number.isFinite(updatedAt)) return null;
		if (Date.now() - updatedAt > SNAPSHOT_TTL_MS) return null;
		return row.payload;
	} catch {
		return null;
	}
}

export async function saveLobbyLiveSnapshot(
	lobbyId: string,
	payload: LiveLobbyResponse,
	timezoneOffsetMinutes?: number | null
): Promise<void> {
	const supabase = getServerSupabase();
	if (!supabase) return;
	const tz = normalizeOffset(timezoneOffsetMinutes);
	try {
		await supabase.from("lobby_live_snapshots").upsert(
			{
				lobby_id: lobbyId,
				timezone_offset_minutes: tz,
				payload,
				updated_at: new Date().toISOString(),
			},
			{ onConflict: "lobby_id,timezone_offset_minutes" }
		);
	} catch (err) {
		logError({ route: "liveSnapshotStore.save", code: "LIVE_SNAPSHOT_SAVE_FAILED", err, lobbyId, extra: { timezoneOffsetMinutes: tz } });
	}
}

export async function refreshLobbyLiveSnapshot(lobbyId: string, timezoneOffsetMinutes?: number | null): Promise<void> {
	const tz = normalizeOffset(timezoneOffsetMinutes);
	try {
		const payload = await buildLiveLobbyResponse({
			lobbyId,
			requestTimezoneOffsetMinutes: tz,
		});
		if (!payload) return;
		await saveLobbyLiveSnapshot(lobbyId, payload, tz);
	} catch (err) {
		logError({ route: "liveSnapshotStore.refresh", code: "LIVE_SNAPSHOT_REFRESH_FAILED", err, lobbyId, extra: { timezoneOffsetMinutes: tz } });
	}
}
