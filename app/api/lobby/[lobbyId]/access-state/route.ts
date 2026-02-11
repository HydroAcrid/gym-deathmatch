import { NextRequest, NextResponse } from "next/server";
import { resolveLobbyAccess } from "@/lib/lobbyAccess";
import { evaluateInviteGate, inviteReasonMessage } from "@/lib/inviteAccess";

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
	if (!lobby) {
		return NextResponse.json({ state: "not_found", error: "Lobby not found" }, { status: 404 });
	}

	const token = new URL(req.url).searchParams.get("t");
	const inviteEnabled = (lobby as any).invite_enabled !== false;
	const inviteExpiresAt = ((lobby as any).invite_expires_at as string | null) ?? null;
	const inviteTokenRequired = (lobby as any).invite_token_required === true;
	const inviteToken = ((lobby as any).invite_token as string | null) ?? null;
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
		lobbyName: (lobby as any).name ?? null,
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
