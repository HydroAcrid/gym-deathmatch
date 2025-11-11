import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabaseClient";

export async function GET(req: NextRequest) {
	const { searchParams } = new URL(req.url);
	const userId = searchParams.get("userId");
	const supabase = getServerSupabase();
	if (!supabase) return NextResponse.json({ lobbies: [] });
	try {
		// If no userId provided, do not return global lobbies.
		if (!userId) return NextResponse.json({ lobbies: [] });

		// Return UNION of: lobbies where the user has a player row, and lobbies owned by the user.
		// We do two queries and merge to avoid OR limitations and ensure we never silently drop owned lobbies.
		const [{ data: memberRows }, { data: ownerRows }] = await Promise.all([
			supabase.from("player").select("lobby_id").eq("user_id", userId).limit(200),
			supabase.from("lobby").select("*").eq("owner_user_id", userId).limit(200)
		]);
		const memberLobbyIds = Array.from(new Set((memberRows ?? []).map((r: any) => r.lobby_id)));
		const { data: memberLobbies } = memberLobbyIds.length
			? await supabase.from("lobby").select("*").in("id", memberLobbyIds as any).limit(500)
			: { data: [] as any[] };
		// Merge and sort by name
		const map = new Map<string, any>();
		for (const r of (memberLobbies ?? [])) map.set(r.id, r);
		for (const r of (ownerRows ?? [])) map.set(r.id, r);
		const list = Array.from(map.values()).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
		return NextResponse.json({ lobbies: list });
	} catch (e) {
		console.error("lobbies list error", e);
		return NextResponse.json({ lobbies: [] });
	}
}


