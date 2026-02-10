import { NextRequest, NextResponse } from "next/server";
import { onPotChanged } from "@/lib/commentary";
import { resolveLobbyAccess } from "@/lib/lobbyAccess";

export async function POST(req: NextRequest, { params }: { params: Promise<{ lobbyId: string }> }) {
	const { lobbyId } = await params;
	const access = await resolveLobbyAccess(req, lobbyId);
	if (!access.ok) return NextResponse.json({ error: access.message }, { status: access.status });
	if (!access.memberPlayerId) return NextResponse.json({ error: "Not a lobby member" }, { status: 403 });
	if (!access.isOwner) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
	const supabase = access.supabase;

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

	try { await onPotChanged(lobbyId, delta, newPot); } catch { /* best-effort */ }

	return NextResponse.json({ ok: true, pot: newPot, delta });
}
