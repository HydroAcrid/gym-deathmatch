export type InviteBlockReason =
	| "INVITE_DISABLED"
	| "INVITE_EXPIRED"
	| "INVITE_TOKEN_REQUIRED"
	| "INVITE_TOKEN_INVALID"
	| "INVITE_MISCONFIGURED";

export type InviteGateInput = {
	isOwner: boolean;
	isMember: boolean;
	inviteEnabled: boolean;
	inviteExpiresAt: string | null;
	inviteTokenRequired: boolean;
	inviteToken: string | null;
	providedToken: string | null;
};

export type InviteGateResult = {
	canJoin: boolean;
	reason: InviteBlockReason | null;
};

export function evaluateInviteGate(input: InviteGateInput): InviteGateResult {
	if (input.isOwner || input.isMember) {
		return { canJoin: true, reason: null };
	}
	if (!input.inviteEnabled) {
		return { canJoin: false, reason: "INVITE_DISABLED" };
	}
	if (input.inviteExpiresAt) {
		const expiresAt = new Date(input.inviteExpiresAt).getTime();
		if (!Number.isNaN(expiresAt) && expiresAt <= Date.now()) {
			return { canJoin: false, reason: "INVITE_EXPIRED" };
		}
	}
	if (input.inviteTokenRequired) {
		const expected = (input.inviteToken || "").trim();
		const provided = (input.providedToken || "").trim();
		if (!expected) {
			return { canJoin: false, reason: "INVITE_MISCONFIGURED" };
		}
		if (!provided) {
			return { canJoin: false, reason: "INVITE_TOKEN_REQUIRED" };
		}
		if (provided !== expected) {
			return { canJoin: false, reason: "INVITE_TOKEN_INVALID" };
		}
	}
	return { canJoin: true, reason: null };
}

export function inviteReasonMessage(reason: InviteBlockReason | null): string {
	switch (reason) {
		case "INVITE_DISABLED":
			return "Invites are currently disabled for this lobby.";
		case "INVITE_EXPIRED":
			return "This invite link has expired.";
		case "INVITE_TOKEN_REQUIRED":
			return "This invite link is missing its access token.";
		case "INVITE_TOKEN_INVALID":
			return "This invite link token is invalid.";
		case "INVITE_MISCONFIGURED":
			return "Invite link is misconfigured. Ask the host to regenerate it.";
		default:
			return "Unable to join this lobby.";
	}
}
