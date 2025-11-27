import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabaseClient";
import { onPotChanged } from "@/lib/commentary";

export async function POST(req: NextRequest, { params }: { params: Promise<{ lobbyId: string }> }) {
	const { lobbyId } = await params;
	const supabase = getServerSupabase();
	if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 501 });

	const userId = req.headers.get("x-user-id") || "";
	if (!userId) return NextResponse.json({ error: "Missing user" }, { status: 401 });

	const { targetPot } = await req.json().catch(() => ({ targetPot: null }));
	const newPot = Number(targetPot);
	if (!Number.isFinite(newPot) || newPot < 0) return NextResponse.json({ error: "Invalid pot amount" }, { status: 400 });

	// Verify owner
	const { data: lobby } = await supabase.from("lobby").select("cash_pool,owner_user_id").eq("id", lobbyId).maybeSingle();
	if (!lobby) return NextResponse.json({ error: "Lobby not found" }, { status: 404 });
	if (lobby.owner_user_id !== userId) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

	// Compute delta vs current cash_pool (authoritative)
	const currentPot = Number(lobby.cash_pool ?? 0);
	const delta = newPot - currentPot;

	const { error: updErr } = await supabase.from("lobby").update({ cash_pool: newPot }).eq("id", lobbyId);
	if (updErr) return NextResponse.json({ error: "Failed to update pot" }, { status: 500 });

	try { await onPotChanged(lobbyId, delta, newPot); } catch { /* best-effort */ }

	return NextResponse.json({ ok: true, pot: newPot, delta });
}
