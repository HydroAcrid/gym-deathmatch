import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabaseClient";

export async function GET(req: NextRequest, { params }: { params: Promise<{ lobbyId: string }> }) {
	const { lobbyId } = await params;
	const supabase = getServerSupabase();
	if (!supabase) return NextResponse.json({ items: [] });
	try {
		// Determine mode to filter money-only events for challenge lobbies
		const { data: lrow } = await supabase.from("lobby").select("mode").eq("id", lobbyId).maybeSingle();
		const mode = (lrow?.mode as string) || "MONEY_SURVIVAL";
		const isChallenge = String(mode).startsWith("CHALLENGE_");
		const { data, error } = await supabase
			.from("comments")
			.select("id, type, rendered, created_at, primary_player_id")
			.eq("lobby_id", lobbyId)
			.in("visibility", ["feed", "both"] as any)
			.order("created_at", { ascending: false })
			.limit(50);
		if (error) throw error;
		// Also include select history events for visibility in feed (punishment spins etc.)
		const { data: evs } = await supabase
			.from("history_events")
			.select("id,type,payload,created_at")
			.eq("lobby_id", lobbyId)
			.in("type", ["PUNISHMENT_SPUN"] as any)
			.order("created_at", { ascending: false })
			.limit(20);
		// join minimal player info
		const playerIds = Array.from(new Set((data ?? []).map((d: any) => d.primary_player_id).filter(Boolean)));
		let players: any[] = [];
		if (playerIds.length) {
			const { data: prows } = await supabase.from("player").select("id,name,avatar_url").in("id", playerIds as any);
			players = prows ?? [];
		}
		const byId = new Map(players.map(p => [p.id, p]));
		let items1 = (data ?? []).map((d: any) => ({
			id: d.id,
			text: d.rendered,
			createdAt: d.created_at,
			player: byId.get(d.primary_player_id) || null
		}));
		// Filter out pot/ante events for challenge modes
		if (isChallenge) {
			items1 = (data ?? [])
				.filter((d: any) => d.type !== "POT")
				.map((d: any) => ({
					id: d.id,
					text: d.rendered,
					createdAt: d.created_at,
					player: byId.get(d.primary_player_id) || null
				}));
		}
		const items2 = (evs ?? []).map((e: any) => ({
			id: `he-${e.id}`,
			text: (e.type === "PUNISHMENT_SPUN" ? `🎡 Wheel spun: "${(e.payload as any)?.text ?? ""}"` : e.type),
			createdAt: e.created_at,
			player: null
		}));
		// Dedup: skip history_events entries if a commentary quip already covers the same event
		const commentTextsLower = new Set(items1.map((i: any) => (i.text ?? "").toLowerCase()));
		const dedupedItems2 = items2.filter((i: any) => {
			const t = (i.text ?? "").toLowerCase();
			return ![...commentTextsLower].some(ct => ct.includes("wheel spun") && t.includes("wheel spun"));
		});
		const mixed = [...items1, ...dedupedItems2].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 50);
		return NextResponse.json({ items: mixed });
	} catch (e) {
		return NextResponse.json({ items: [] });
	}
}
