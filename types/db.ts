export interface LobbyRow {
	id: string;
	name: string;
	season_number: number;
	season_start: string; // timestamptz
	season_end: string; // timestamptz
	cash_pool: number;
}

export interface PlayerRow {
	id: string;
	lobby_id: string;
	name: string;
	avatar_url: string | null;
	location: string | null;
	quip: string | null;
}

export interface StravaTokenRow {
	player_id: string;
	access_token: string;
	refresh_token: string;
	expires_at: string; // timestamptz
	updated_at: string | null;
}


