import { getServerSupabase } from "./supabaseClient";
import { getRequestUserId } from "./requestAuth";

type LobbyRow = {
	owner_id: string | null;
	owner_user_id: string | null;
};

type PlayerRow = {
	id: string;
	user_id: string | null;
};

export type LobbyAccessResult =
	| {
			ok: true;
			supabase: NonNullable<ReturnType<typeof getServerSupabase>>;
			userId: string;
			memberPlayerId: string | null;
			isOwner: boolean;
			ownerPlayerId: string | null;
	  }
	| {
			ok: false;
			status: number;
			code: string;
			message: string;
	  };

export async function resolveLobbyAccess(req: Request, lobbyId: string): Promise<LobbyAccessResult> {
	const supabase = getServerSupabase();
	if (!supabase) {
		return { ok: false, status: 501, code: "SUPABASE_NOT_CONFIGURED", message: "Supabase not configured" };
	}

	const userId = await getRequestUserId(req);
	if (!userId) {
		return { ok: false, status: 401, code: "UNAUTHORIZED", message: "Unauthorized" };
	}

	const { data: lobby } = await supabase
		.from("lobby")
		.select("owner_id,owner_user_id")
		.eq("id", lobbyId)
		.maybeSingle();
	if (!lobby) {
		return { ok: false, status: 404, code: "NOT_FOUND", message: "Lobby not found" };
	}
	const l = lobby as LobbyRow;

	const { data: member } = await supabase
		.from("player")
		.select("id")
		.eq("lobby_id", lobbyId)
		.eq("user_id", userId)
		.maybeSingle();
	const memberPlayerId = (member?.id as string | undefined) ?? null;

	let ownerUserId = l.owner_user_id ?? null;
	if (!ownerUserId && l.owner_id) {
		const { data: ownerPlayer } = await supabase
			.from("player")
			.select("id,user_id")
			.eq("id", l.owner_id)
			.maybeSingle();
		ownerUserId = ((ownerPlayer as PlayerRow | null)?.user_id ?? null);
	}
	const isOwner = !!ownerUserId && ownerUserId === userId;

	return {
		ok: true,
		supabase,
		userId,
		memberPlayerId,
		isOwner,
		ownerPlayerId: l.owner_id ?? null
	};
}

