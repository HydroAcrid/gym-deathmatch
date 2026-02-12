import { NextRequest, NextResponse } from "next/server";
import { jsonError, logError } from "@/lib/logger";
import { resolveLobbyAccess } from "@/lib/lobbyAccess";
import { ReconcileService, isReconcileServiceError } from "@/domains/lobby/services/reconcileService";

export async function POST(req: NextRequest, { params }: { params: Promise<{ lobbyId: string }> }) {
	const { lobbyId } = await params;
	const access = await resolveLobbyAccess(req, lobbyId);
	if (!access.ok) return jsonError(access.code, access.message, access.status);
	if (!access.memberPlayerId && !access.isOwner) return jsonError("FORBIDDEN", "Not a lobby member", 403);

	try {
		const result = await ReconcileService.reconcileLobby({ supabase: access.supabase, lobbyId });
		return NextResponse.json(result);
	} catch (err) {
		if (isReconcileServiceError(err)) {
			return jsonError(err.code, err.message, err.status);
		}
		logError({ route: "POST /api/lobby/[id]/reconcile", code: "RECONCILE_FAILED", err, lobbyId });
		return jsonError("RECONCILE_FAILED", "Failed to reconcile lobby", 400);
	}
}
