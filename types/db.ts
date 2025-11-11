export interface LobbyRow {
	id: string;
	name: string;
	season_number: number;
	season_start: string | null; // timestamptz
	season_end: string | null; // timestamptz
	cash_pool: number;
	weekly_target?: number | null;
	initial_lives?: number | null;
	owner_id?: string | null;
	status?: "pending" | "scheduled" | "active" | "completed" | null;
	scheduled_start?: string | null; // timestamptz
	deleted_at?: string | null;
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


