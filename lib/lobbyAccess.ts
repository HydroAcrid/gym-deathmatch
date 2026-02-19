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

type UserProfileRow = {
	display_name: string | null;
	avatar_url: string | null;
};

type OwnerPlayerRow = {
	id: string;
	lobby_id: string;
	user_id: string | null;
};

type UserProfileFullRow = {
	display_name: string | null;
	avatar_url: string | null;
	location: string | null;
	quip: string | null;
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

	let profile: UserProfileRow | null = null;
	try {
		const { data } = await supabase
			.from("user_profile")
			.select("display_name,avatar_url")
			.eq("user_id", userId)
			.maybeSingle();
		profile = (data as UserProfileRow | null) ?? null;
	} catch {
		profile = null;
	}

	let ownerUserId = l.owner_user_id ?? null;
	if (!ownerUserId && l.owner_id) {
		const { data: ownerPlayer } = await supabase
			.from("player")
			.select("id,user_id")
			.eq("id", l.owner_id)
			.maybeSingle();
		ownerUserId = ((ownerPlayer as PlayerRow | null)?.user_id ?? null);
	}
	if (!ownerUserId && l.owner_id && memberPlayerId === l.owner_id) {
		ownerUserId = userId;
		try {
			await supabase.from("player").update({ user_id: userId }).eq("id", l.owner_id).is("user_id", null);
			await supabase.from("lobby").update({ owner_user_id: userId }).eq("id", lobbyId).is("owner_user_id", null);
		} catch {
			// best-effort self-heal only
		}
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
				const ownerPlayer = (ownerRow as OwnerPlayerRow | null) ?? null;
				if (ownerPlayer?.id && ownerPlayer.lobby_id === lobbyId) {
					memberPlayerId = ownerPlayer.id;
					if (!ownerPlayer.user_id) {
						await supabase.from("player").update({ user_id: userId }).eq("id", memberPlayerId);
					}
				}
			}

			if (!memberPlayerId) {
				const { data: profileFull } = await supabase
					.from("user_profile")
					.select("display_name,avatar_url,location,quip")
					.eq("user_id", userId)
					.maybeSingle();
				const fullProfile = (profileFull as UserProfileFullRow | null) ?? null;
				const repairedOwnerId = crypto.randomUUID();
				const { error: insertErr } = await supabase.from("player").insert({
					id: repairedOwnerId,
					lobby_id: lobbyId,
					name: fullProfile?.display_name || "Owner",
					avatar_url: fullProfile?.avatar_url ?? null,
					location: fullProfile?.location ?? null,
					quip: fullProfile?.quip ?? null,
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

	// Self-heal for non-owner users:
	// reclaim a single unlinked player row in this lobby when it uniquely matches profile.
	if (!memberPlayerId) {
		try {
			const profileName = (profile?.display_name || "").trim();
			const profileAvatar = (profile?.avatar_url || "").trim();
			let candidateRows: Array<{ id: string }> = [];

			if (profileName) {
				const { data } = await supabase
					.from("player")
					.select("id")
					.eq("lobby_id", lobbyId)
					.is("user_id", null)
					.ilike("name", profileName)
					.limit(2);
				candidateRows = (data ?? []) as Array<{ id: string }>;
			}

			if (candidateRows.length !== 1 && profileAvatar) {
				const { data } = await supabase
					.from("player")
					.select("id")
					.eq("lobby_id", lobbyId)
					.is("user_id", null)
					.eq("avatar_url", profileAvatar)
					.limit(2);
				candidateRows = (data ?? []) as Array<{ id: string }>;
			}

			if (candidateRows.length === 1) {
				const claimedId = candidateRows[0].id;
				const { error: claimErr } = await supabase
					.from("player")
					.update({ user_id: userId })
					.eq("id", claimedId)
					.is("user_id", null);
				if (!claimErr) {
					memberPlayerId = claimedId;
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
