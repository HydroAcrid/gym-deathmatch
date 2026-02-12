import type { DbClient } from "@/platform/db/client";
import { requireDbClient } from "@/platform/db/client";

type LobbyRow = {
	id: string;
	name: string | null;
	owner_id: string | null;
	owner_user_id: string | null;
	status: string | null;
	stage: string | null;
	mode: string | null;
};

type InviteConfigRow = {
	invite_enabled: boolean | null;
	invite_expires_at: string | null;
	invite_token_required: boolean | null;
	invite_token: string | null;
};

export type LobbyRecord = {
	id: string;
	name: string | null;
	ownerId: string | null;
	ownerUserId: string | null;
	status: string | null;
	stage: string | null;
	mode: string | null;
};

export type InviteConfigRecord = {
	inviteEnabled: boolean;
	inviteExpiresAt: string | null;
	inviteTokenRequired: boolean;
	inviteToken: string | null;
};

export interface LobbyRepo {
	getLobbyById(lobbyId: string): Promise<LobbyRecord | null>;
	getInviteConfig(lobbyId: string): Promise<InviteConfigRecord | null>;
}

export function createLobbyRepo(db: DbClient = requireDbClient()): LobbyRepo {
	return {
		async getLobbyById(lobbyId: string): Promise<LobbyRecord | null> {
			const { data } = await db
				.from("lobby")
				.select("id,name,owner_id,owner_user_id,status,stage,mode")
				.eq("id", lobbyId)
				.maybeSingle();
			if (!data) return null;
			const row = data as LobbyRow;
			return {
				id: String(row.id),
				name: row.name ?? null,
				ownerId: row.owner_id ?? null,
				ownerUserId: row.owner_user_id ?? null,
				status: row.status ?? null,
				stage: row.stage ?? null,
				mode: row.mode ?? null,
			};
		},
		async getInviteConfig(lobbyId: string): Promise<InviteConfigRecord | null> {
			const { data } = await db
				.from("lobby")
				.select("invite_enabled,invite_expires_at,invite_token_required,invite_token")
				.eq("id", lobbyId)
				.maybeSingle();
			if (!data) return null;
			const row = data as InviteConfigRow;
			return {
				inviteEnabled: row.invite_enabled !== false,
				inviteExpiresAt: row.invite_expires_at ?? null,
				inviteTokenRequired: row.invite_token_required === true,
				inviteToken: row.invite_token ?? null,
			};
		},
	};
}
