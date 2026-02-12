import type { DbClient } from "@/platform/db/client";
import { requireDbClient } from "@/platform/db/client";

type PlayerRow = {
	id: string;
	user_id: string | null;
	lobby_id: string;
	name: string | null;
};

export type PlayerMembershipRecord = {
	id: string;
	userId: string | null;
	lobbyId: string;
	name: string | null;
};

export interface PlayerRepo {
	getMemberByLobbyAndUser(lobbyId: string, userId: string): Promise<PlayerMembershipRecord | null>;
	listPlayersByLobby(lobbyId: string): Promise<PlayerMembershipRecord[]>;
}

export function createPlayerRepo(db: DbClient = requireDbClient()): PlayerRepo {
	return {
		async getMemberByLobbyAndUser(lobbyId: string, userId: string): Promise<PlayerMembershipRecord | null> {
			const { data } = await db
				.from("player")
				.select("id,user_id,lobby_id,name")
				.eq("lobby_id", lobbyId)
				.eq("user_id", userId)
				.maybeSingle();
			if (!data) return null;
			const row = data as PlayerRow;
			return {
				id: String(row.id),
				userId: row.user_id ?? null,
				lobbyId: String(row.lobby_id),
				name: row.name ?? null,
			};
		},
		async listPlayersByLobby(lobbyId: string): Promise<PlayerMembershipRecord[]> {
			const { data } = await db
				.from("player")
				.select("id,user_id,lobby_id,name")
				.eq("lobby_id", lobbyId);
			const rows = (data ?? []) as PlayerRow[];
			return rows.map((row) => ({
				id: String(row.id),
				userId: row.user_id ?? null,
				lobbyId: String(row.lobby_id),
				name: row.name ?? null,
			}));
		},
	};
}
