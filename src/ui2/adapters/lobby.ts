import type { LobbyCardData } from "../components/LobbyCard";

export type LobbyRowLike = {
	id: string;
	name: string;
	season_number: number;
	cash_pool: number;
	season_start?: string;
	season_end?: string;
	weekly_target?: number;
	initial_lives?: number;
	owner_user_id?: string;
	created_at?: string;
	status?: string;
	mode?: string;
	player_count?: number;
};

const stageFromStatus = (status?: string): LobbyCardData["stage"] => {
	if (status === "completed") return "completed";
	if (status === "transition_spin") return "transition_spin";
	if (status === "active") return "active";
	return "pre_stage";
};

export function mapLobbyRowToCard(
	lobby: LobbyRowLike,
	opts: { userId?: string; createdAgo?: string | null }
): LobbyCardData {
	return {
		id: lobby.id,
		name: lobby.name,
		seasonNumber: lobby.season_number ?? 1,
		stage: stageFromStatus(lobby.status),
		mode: (lobby.mode as LobbyCardData["mode"]) || "MONEY_SURVIVAL",
		cashPool: lobby.cash_pool ?? 0,
		weeklyTarget: lobby.weekly_target,
		initialLives: lobby.initial_lives,
		playerCount: lobby.player_count,
		isOwner: Boolean(opts.userId && lobby.owner_user_id === opts.userId),
		seasonStart: lobby.season_start,
		seasonEnd: lobby.season_end,
		createdAgo: opts.createdAgo ?? null,
	};
}
