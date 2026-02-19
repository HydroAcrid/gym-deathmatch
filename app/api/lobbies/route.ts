import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabaseClient";
import { getRequestUserId } from "@/lib/requestAuth";

export async function GET(req: NextRequest) {
	const userId = await getRequestUserId(req);
	const supabase = getServerSupabase();
	if (!supabase) {
		console.log("[api/lobbies] No Supabase client available");
		return NextResponse.json({ lobbies: [] });
	}
	try {
		if (!userId) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		// Return UNION of: lobbies where the user has a player row, and lobbies owned by the user.
		// We do two queries and merge to avoid OR limitations and ensure we never silently drop owned lobbies.
		// CRITICAL: Uses user_id (auth.users.id), NOT email - this matches the schema and RLS policies.
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
		const list = Array.from(map.values());

		// Attach per-lobby player counts for lobby cards.
		const lobbyIds = list.map((l: any) => l.id).filter(Boolean);
		const counts = new Map<string, number>();
		if (lobbyIds.length) {
			const { data: players } = await supabase
				.from("player")
				.select("lobby_id")
				.in("lobby_id", lobbyIds as any);
			for (const row of (players ?? []) as Array<{ lobby_id: string }>) {
				counts.set(row.lobby_id, (counts.get(row.lobby_id) ?? 0) + 1);
			}
		}
		const withCounts = list.map((l: any) => ({
			...l,
			player_count: counts.get(l.id) ?? 0
		}));
		
		// Return all fields including created_at, status, mode for client-side filtering/sorting
		return NextResponse.json({ lobbies: withCounts });
	} catch (e) {
		console.error("[api/lobbies] Error fetching lobbies:", e);
		return NextResponse.json({ lobbies: [] });
	}
}
