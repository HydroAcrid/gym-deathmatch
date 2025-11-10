import { getServerSupabase } from "./supabaseClient";
import type { StravaTokens } from "./strava";
import type { StravaTokenRow } from "@/types/db";
import { getLobbyById } from "./lobbies";
import type { Lobby } from "@/types/game";

export async function upsertStravaTokens(playerId: string, tokens: StravaTokens): Promise<boolean> {
	const supabase = getServerSupabase();
	if (!supabase) return false;
	const expiresAtIso = new Date(tokens.expiresAt * 1000).toISOString();
	const { error } = await supabase.from<StravaTokenRow>("strava_token").upsert(
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

export async function ensurePlayerExists(lobbyId: string, playerId: string): Promise<boolean> {
	const supabase = getServerSupabase();
	if (!supabase) return false;
	// Pull mock lobby to get canonical names/fields
	const mockLobby: Lobby | null = getLobbyById(lobbyId);
	if (!mockLobby) return false;
	const mockPlayer = mockLobby.players.find((p) => p.id === playerId);
	if (!mockPlayer) return false;

	// Upsert lobby
	const { error: lobbyErr } = await supabase.from("lobby").upsert(
		{
			id: mockLobby.id,
			name: mockLobby.name,
			season_number: mockLobby.seasonNumber,
			season_start: mockLobby.seasonStart,
			season_end: mockLobby.seasonEnd,
			cash_pool: mockLobby.cashPool,
			weekly_target: mockLobby.weeklyTarget ?? 3,
			initial_lives: mockLobby.initialLives ?? 3
		},
		{ onConflict: "id" }
	);
	if (lobbyErr) {
		console.error("ensurePlayerExists lobby upsert error", lobbyErr);
		return false;
	}
	// Upsert player
	const { error: playerErr } = await supabase.from("player").upsert(
		{
			id: mockPlayer.id,
			lobby_id: mockLobby.id,
			name: mockPlayer.name,
			avatar_url: mockPlayer.avatarUrl || null,
			location: mockPlayer.location || null,
			quip: mockPlayer.quip || null
		},
		{ onConflict: "id" }
	);
	if (playerErr) {
		console.error("ensurePlayerExists player upsert error", playerErr);
		return false;
	}
	return true;
}

export async function ensureLobbyAndPlayers(lobbyId: string): Promise<boolean> {
	const supabase = getServerSupabase();
	if (!supabase) return false;
	const mockLobby = getLobbyById(lobbyId);
	if (!mockLobby) return false;
	const { error: lobbyErr } = await supabase.from("lobby").upsert(
		{
			id: mockLobby.id,
			name: mockLobby.name,
			season_number: mockLobby.seasonNumber,
			season_start: mockLobby.seasonStart,
			season_end: mockLobby.seasonEnd,
			cash_pool: mockLobby.cashPool,
			weekly_target: mockLobby.weeklyTarget ?? 3,
			initial_lives: mockLobby.initialLives ?? 3
		},
		{ onConflict: "id" }
	);
	if (lobbyErr) {
		console.error("ensureLobbyAndPlayers lobby upsert error", lobbyErr);
		return false;
	}
	const rows = mockLobby.players.map((p) => ({
		id: p.id,
		lobby_id: mockLobby.id,
		name: p.name,
		avatar_url: p.avatarUrl || null,
		location: p.location || null,
		quip: p.quip || null
	}));
	const { error: playerErr } = await supabase.from("player").upsert(rows, { onConflict: "id" });
	if (playerErr) {
		console.error("ensureLobbyAndPlayers player upsert error", playerErr);
		return false;
	}
	return true;
}


