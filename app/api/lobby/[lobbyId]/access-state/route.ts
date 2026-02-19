import { NextRequest, NextResponse } from "next/server";
import { resolveLobbyAccess } from "@/lib/lobbyAccess";
import { evaluateInviteGate, inviteReasonMessage } from "@/lib/inviteAccess";

type LobbyAccessRow = {
	name: string | null;
	invite_enabled: boolean | null;
	invite_expires_at: string | null;
	invite_token_required: boolean | null;
	invite_token: string | null;
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ lobbyId: string }> }) {
	const { lobbyId } = await params;
	const access = await resolveLobbyAccess(req, lobbyId);
	if (!access.ok) {
		if (access.status === 404) {
			return NextResponse.json({ state: "not_found", error: access.message }, { status: 404 });
		}
		return NextResponse.json({ error: access.message }, { status: access.status });
	}

	const supabase = access.supabase;
	const { data: lobby } = await supabase
		.from("lobby")
		.select("*")
		.eq("id", lobbyId)
		.maybeSingle();
	const lobbyRow = (lobby as LobbyAccessRow | null) ?? null;
	if (!lobbyRow) {
		return NextResponse.json({ state: "not_found", error: "Lobby not found" }, { status: 404 });
	}

	const token = new URL(req.url).searchParams.get("t");
	const inviteEnabled = lobbyRow.invite_enabled !== false;
	const inviteExpiresAt = lobbyRow.invite_expires_at ?? null;
	const inviteTokenRequired = lobbyRow.invite_token_required === true;
	const inviteToken = lobbyRow.invite_token ?? null;
	const gate = evaluateInviteGate({
		isOwner: access.isOwner,
		isMember: !!access.memberPlayerId || access.isOwner,
		inviteEnabled,
		inviteExpiresAt,
		inviteTokenRequired,
		inviteToken,
		providedToken: token,
	});

	return NextResponse.json({
			state: access.memberPlayerId || access.isOwner ? "member" : "not_member",
			memberPlayerId: access.memberPlayerId || (access.isOwner ? access.ownerPlayerId : null),
			lobbyId: lobbyId,
			lobbyName: lobbyRow.name ?? null,
		canJoin: gate.canJoin,
		reason: gate.reason,
		reasonMessage: inviteReasonMessage(gate.reason),
		invite: {
			enabled: inviteEnabled,
			expiresAt: inviteExpiresAt,
			tokenRequired: inviteTokenRequired,
		},
		inviteToken: access.memberPlayerId || access.isOwner ? inviteToken : null,
	});
}
