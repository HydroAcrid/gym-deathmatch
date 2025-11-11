import { getServerSupabase } from "./supabaseClient";
import type { StravaTokens } from "./strava";
import type { StravaTokenRow } from "@/types/db";

export async function upsertUserStravaTokens(userId: string, tokens: StravaTokens): Promise<boolean> {
	const supabase = getServerSupabase();
	if (!supabase) return false;
	const expiresAtIso = new Date(tokens.expiresAt * 1000).toISOString();
	const { error } = await supabase.from("user_strava_token").upsert(
		{
			user_id: userId,
			access_token: tokens.accessToken,
			refresh_token: tokens.refreshToken,
			expires_at: expiresAtIso
		},
		{ onConflict: "user_id" }
	);
	if (error) {
		console.error("Supabase upsertUserStravaTokens error", error);
		return false;
	}
	return true;
}

export async function getUserStravaTokens(userId: string): Promise<StravaTokens | null> {
	const supabase = getServerSupabase();
	if (!supabase) return null;
	const { data, error } = await supabase.from("user_strava_token").select("*").eq("user_id", userId).maybeSingle();
	if (error || !data) return null;
	return {
		accessToken: data.access_token as string,
		refreshToken: data.refresh_token as string,
		expiresAt: Math.floor(new Date(data.expires_at as string).getTime() / 1000)
	};
}
export async function upsertStravaTokens(playerId: string, tokens: StravaTokens): Promise<boolean> {
	const supabase = getServerSupabase();
	if (!supabase) return false;
	const expiresAtIso = new Date(tokens.expiresAt * 1000).toISOString();
	const { error } = await supabase.from("strava_token").upsert(
		{
			player_id: playerId,
			access_token: tokens.accessToken,
			refresh_token: tokens.refreshToken,
			expires_at: expiresAtIso
		},
		{ onConflict: "player_id" }
	);
	if (error) {
		console.error("Supabase upsertStravaTokens error", error);
		return false;
	}
	return true;
}

export async function updateLobbyStage(lobbyId: string, updates: Partial<{ status: "pending"|"scheduled"|"active"|"completed"; scheduledStart: string | null; seasonStart: string | null }>): Promise<boolean> {
	const supabase = getServerSupabase();
	if (!supabase) return false;
	const payload: any = {};
	if (updates.status !== undefined) payload.status = updates.status;
	if (updates.scheduledStart !== undefined) payload.scheduled_start = updates.scheduledStart;
	if (updates.seasonStart !== undefined) payload.season_start = updates.seasonStart;
	const { error } = await supabase.from("lobby").update(payload).eq("id", lobbyId);
	if (error) {
		console.error("updateLobbyStage error", error);
		return false;
	}
	return true;
}


