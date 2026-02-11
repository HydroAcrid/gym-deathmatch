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
	let memberPlayerId = (member?.id as string | undefined) ?? null;

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

	// Self-heal: if lobby owner has no member player row in this lobby, re-create/link one.
	// This recovers from historical global-id upsert collisions that could move player rows
	// between lobbies.
	if (isOwner && !memberPlayerId) {
		try {
			if (l.owner_id) {
				const { data: ownerRow } = await supabase
					.from("player")
					.select("id,lobby_id,user_id")
					.eq("id", l.owner_id)
					.maybeSingle();
				if ((ownerRow as any)?.id && (ownerRow as any)?.lobby_id === lobbyId) {
					memberPlayerId = (ownerRow as any).id as string;
					if (!(ownerRow as any).user_id) {
						await supabase.from("player").update({ user_id: userId }).eq("id", memberPlayerId);
					}
				}
			}

			if (!memberPlayerId) {
				const { data: profile } = await supabase
					.from("user_profile")
					.select("display_name,avatar_url,location,quip")
					.eq("user_id", userId)
					.maybeSingle();
				const repairedOwnerId = crypto.randomUUID();
				const { error: insertErr } = await supabase.from("player").insert({
					id: repairedOwnerId,
					lobby_id: lobbyId,
					name: (profile as any)?.display_name || "Owner",
					avatar_url: (profile as any)?.avatar_url ?? null,
					location: (profile as any)?.location ?? null,
					quip: (profile as any)?.quip ?? null,
					user_id: userId
				});
				if (!insertErr) {
					memberPlayerId = repairedOwnerId;
					await supabase.from("lobby").update({ owner_id: repairedOwnerId, owner_user_id: userId }).eq("id", lobbyId);
				}
			}
		} catch {
			// keep access resolution best-effort even if repair fails
		}
	}

	return {
		ok: true,
		supabase,
		userId,
		memberPlayerId,
		isOwner,
		ownerPlayerId: l.owner_id ?? null
	};
}
