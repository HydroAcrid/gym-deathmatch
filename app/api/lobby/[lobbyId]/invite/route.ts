import { NextRequest, NextResponse } from "next/server";
import { resolveLobbyAccess } from "@/lib/lobbyAccess";
import type { PlayerRow } from "@/types/db";
import { evaluateInviteGate, inviteReasonMessage } from "@/lib/inviteAccess";
import { refreshLobbyLiveSnapshot } from "@/lib/liveSnapshotStore";

export async function POST(req: NextRequest, { params }: { params: Promise<{ lobbyId: string }> }) {
	const { lobbyId } = await params;
	const access = await resolveLobbyAccess(req, lobbyId);
	if (!access.ok) return NextResponse.json({ error: access.message }, { status: access.status });
	const supabase = access.supabase;
	const authUserId = access.userId;
	try {
		const body = await req.json();
		// Owners can create unlinked guest players; everyone else self-joins as authenticated user.
		const allowUnlinkedGuest = access.isOwner && body?.guest === true && !body.userId;

		// Enforce invite controls for non-owner self-join flows.
		if (!allowUnlinkedGuest) {
			const { data: lobby } = await supabase
				.from("lobby")
				.select("*")
				.eq("id", lobbyId)
				.maybeSingle();
			if (!lobby) return NextResponse.json({ error: "Lobby not found" }, { status: 404 });
			const gate = evaluateInviteGate({
					isOwner: access.isOwner,
					isMember: !!access.memberPlayerId || access.isOwner,
					inviteEnabled: (lobby as any).invite_enabled !== false,
					inviteExpiresAt: ((lobby as any).invite_expires_at as string | null) ?? null,
					inviteTokenRequired: (lobby as any).invite_token_required === true,
					inviteToken: ((lobby as any).invite_token as string | null) ?? null,
					providedToken: typeof body.inviteToken === "string" ? body.inviteToken : null,
				});
			if (!gate.canJoin) {
				return NextResponse.json(
					{ error: inviteReasonMessage(gate.reason), code: gate.reason },
					{ status: 403 }
				);
			}
		}

		async function allocatePlayerId(preferred?: string): Promise<string> {
			const base = (preferred || "").trim();
			if (base) {
				for (let i = 0; i < 5; i++) {
					const candidate = i === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 6)}`;
					const { data: exists } = await supabase.from("player").select("id").eq("id", candidate).maybeSingle();
					if (!exists) return candidate;
				}
			}
			return crypto.randomUUID();
		}

		// Prevent duplicate player for this authenticated user in this lobby.
		if (!allowUnlinkedGuest) {
			const { data: existing } = await supabase
				.from("player")
				.select("id")
			.eq("lobby_id", lobbyId)
			.eq("user_id", authUserId)
			.maybeSingle();
			if (existing?.id) {
				// Update the existing player with any new profile data
				const updateData: any = {};
				if (body.name) updateData.name = body.name;
				if (body.avatarUrl !== undefined) updateData.avatar_url = body.avatarUrl;
				if (body.location !== undefined) updateData.location = body.location;
				if (body.quip !== undefined) updateData.quip = body.quip;
				if (Object.keys(updateData).length > 0) {
					await supabase.from("player").update(updateData).eq("id", existing.id);
				}
				void refreshLobbyLiveSnapshot(lobbyId);
				return NextResponse.json({ ok: true, alreadyJoined: true, playerId: existing.id });
			}
		}
		const requestedId = typeof body.id === "string" && body.id.trim().length
			? body.id.trim()
			: (body.name ? String(body.name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") : "");
		const playerId = await allocatePlayerId(allowUnlinkedGuest ? requestedId : undefined);
		let name = body.name as string;
		let avatarUrl = (body.avatarUrl ?? null) as string | null;
		let location = (body.location ?? null) as string | null;
		let quip = (body.quip ?? null) as string | null;
		// For authenticated self-join, default name/avatar from profile when not supplied.
		if (!allowUnlinkedGuest) {
			try {
				const { data: prof } = await supabase.from("user_profile").select("*").eq("user_id", authUserId).maybeSingle();
				if ((!name || name.trim().length === 0) && prof?.display_name) name = prof.display_name;
				if (!avatarUrl && prof?.avatar_url) avatarUrl = prof.avatar_url;
				if (!location && prof?.location) location = prof.location;
				if (!quip && prof?.quip) quip = prof.quip;
			} catch { /* ignore */ }
		}
		const p: PlayerRow = {
			id: playerId,
			lobby_id: lobbyId,
			name,
			avatar_url: avatarUrl,
			location,
			quip
		};
		// Attach authenticated user for self-joins; guest invites stay unlinked.
		if (!allowUnlinkedGuest) (p as any).user_id = authUserId;
		// Never upsert on `id` because player ids are global across lobbies.
		const { error } = await supabase.from("player").insert(p as any);
		if (error) {
			console.error("invite insert error", error);
			return NextResponse.json({ error: "Failed to insert" }, { status: 500 });
		}
		void refreshLobbyLiveSnapshot(lobbyId);
		return NextResponse.json({ ok: true, playerId });
	} catch (e) {
		return NextResponse.json({ error: "Bad request" }, { status: 400 });
	}
}
