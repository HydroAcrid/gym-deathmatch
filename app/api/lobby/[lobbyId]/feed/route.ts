import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabaseClient";

export async function GET(req: NextRequest, { params }: { params: Promise<{ lobbyId: string }> }) {
	const { lobbyId } = await params;
	const supabase = getServerSupabase();
	if (!supabase) return NextResponse.json({ items: [] });
	try {
		const { data, error } = await supabase
			.from("comments")
			.select("id, type, rendered, created_at, primary_player_id")
			.eq("lobby_id", lobbyId)
			.in("visibility", ["feed", "both"] as any)
			.order("created_at", { ascending: false })
			.limit(50);
		if (error) throw error;
		// join minimal player info
		const playerIds = Array.from(new Set((data ?? []).map((d: any) => d.primary_player_id).filter(Boolean)));
		let players: any[] = [];
		if (playerIds.length) {
			const { data: prows } = await supabase.from("player").select("id,name,avatar_url").in("id", playerIds as any);
			players = prows ?? [];
		}
		const byId = new Map(players.map(p => [p.id, p]));
		const items = (data ?? []).map((d: any) => ({
			id: d.id,
			text: d.rendered,
			createdAt: d.created_at,
			player: byId.get(d.primary_player_id) || null
		}));
		return NextResponse.json({ items });
	} catch (e) {
		return NextResponse.json({ items: [] });
	}
}


