import { NextRequest, NextResponse } from "next/server";
import { resolveLobbyAccess } from "@/lib/lobbyAccess";
import { refreshLobbyLiveSnapshot } from "@/lib/liveSnapshotStore";
import {
	enqueueCommentaryEvent,
	ensureCommentaryQueueReady,
	isCommentaryQueueUnavailableError,
} from "@/lib/commentaryEvents";
import { processCommentaryQueue } from "@/lib/commentaryProcessor";

export async function POST(req: NextRequest, { params }: { params: Promise<{ lobbyId: string }> }) {
	const { lobbyId } = await params;
	const access = await resolveLobbyAccess(req, lobbyId);
	if (!access.ok) return NextResponse.json({ error: access.message }, { status: access.status });
	if (!access.isOwner) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
	const supabase = access.supabase;
	try {
		await ensureCommentaryQueueReady();
	} catch (e) {
		if (isCommentaryQueueUnavailableError(e)) {
			return NextResponse.json(
				{ error: "COMMENTARY_QUEUE_UNAVAILABLE", message: "Run latest SQL schema before updating pot." },
				{ status: 503 }
			);
		}
		return NextResponse.json({ error: "Failed to initialize commentary queue" }, { status: 500 });
	}

	const { targetPot } = await req.json().catch(() => ({ targetPot: null }));
	const newPot = Number(targetPot);
	if (!Number.isFinite(newPot) || newPot < 0) return NextResponse.json({ error: "Invalid pot amount" }, { status: 400 });

	const { data: lobby } = await supabase.from("lobby").select("cash_pool").eq("id", lobbyId).maybeSingle();
	if (!lobby) return NextResponse.json({ error: "Lobby not found" }, { status: 404 });

	// Compute delta vs current cash_pool (authoritative)
	const currentPot = Number(lobby.cash_pool ?? 0);
	const delta = newPot - currentPot;

	const { error: updErr } = await supabase.from("lobby").update({ cash_pool: newPot }).eq("id", lobbyId);
	if (updErr) return NextResponse.json({ error: "Failed to update pot" }, { status: 500 });

	await enqueueCommentaryEvent({
		lobbyId,
		type: "POT_CHANGED",
		key: `pot:${newPot}:${delta}`,
		payload: { delta, pot: newPot },
	});
	void processCommentaryQueue({ lobbyId, limit: 50, maxMs: 400 }).catch((err) => {
		console.error("pot commentary tail-process failed", err);
	});
	void refreshLobbyLiveSnapshot(lobbyId);

	return NextResponse.json({ ok: true, pot: newPot, delta });
}
