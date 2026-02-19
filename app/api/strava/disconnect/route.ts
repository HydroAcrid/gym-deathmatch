import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabaseClient";
import { getRequestUserId } from "@/lib/requestAuth";

export async function POST(req: NextRequest) {
	const supabase = getServerSupabase();
	if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 501 });
	try {
		const userId = await getRequestUserId(req);
		if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const body = await req.json();
		const playerId = String(body.playerId || "");
		// Delete user-scoped token for current authenticated user.
		await supabase.from("user_strava_token").delete().eq("user_id", userId);

		if (playerId) {
			const { data: owned } = await supabase.from("player").select("id").eq("id", playerId).eq("user_id", userId).maybeSingle();
			if (owned?.id) {
				await supabase.from("strava_token").delete().eq("player_id", playerId);
			}
		} else {
			const { data: ownedPlayers } = await supabase.from("player").select("id").eq("user_id", userId);
			const ids = (ownedPlayers ?? [])
				.map((player: { id?: string | null }) => player.id)
				.filter((id): id is string => typeof id === "string" && id.length > 0);
			if (ids.length) {
				await supabase.from("strava_token").delete().in("player_id", ids);
			}
		}
		return NextResponse.json({ ok: true });
	} catch (e) {
		console.error("disconnect error", e);
		return NextResponse.json({ error: "Bad request" }, { status: 400 });
	}
}
