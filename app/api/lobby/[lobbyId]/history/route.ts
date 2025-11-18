import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabaseClient";

export async function GET(req: NextRequest, { params }: { params: Promise<{ lobbyId: string }> }) {
	const { lobbyId } = await params;
	const supabase = getServerSupabase();
	if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 501 });

	try {
		// Validate membership by user id header (client supplies from auth)
		const userId = req.headers.get("x-user-id") || "";
		if (!userId) return NextResponse.json({ error: "Missing user" }, { status: 401 });
		const { data: member } = await supabase.from("player").select("id").eq("lobby_id", lobbyId).eq("user_id", userId).maybeSingle();
		if (!member) return NextResponse.json({ error: "Not a member of lobby" }, { status: 403 });

		const limitParam = Number(new URL(req.url).searchParams.get("limit") || "50");
		const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 100) : 50;

		const [{ data: activities }, { data: events }, { data: comments }, { data: players }, { data: lobby }] = await Promise.all([
			supabase.from("manual_activities").select("*").eq("lobby_id", lobbyId).order("created_at", { ascending: false }).limit(limit),
			supabase.from("history_events").select("*").eq("lobby_id", lobbyId).order("created_at", { ascending: false }).limit(limit),
			supabase.from("comments").select("id,type,rendered,created_at,primary_player_id").eq("lobby_id", lobbyId).in("visibility", ["history", "both"] as any).order("created_at", { ascending: false }).limit(limit),
			supabase.from("player").select("id,name,avatar_url,user_id").eq("lobby_id", lobbyId),
			supabase.from("lobby").select("id,name").eq("id", lobbyId).maybeSingle()
		]);

		return NextResponse.json({
			activities: activities ?? [],
			events: events ?? [],
			comments: comments ?? [],
			players: players ?? [],
			lobby: lobby ?? null
		}, { status: 200 });
	} catch (e) {
		console.error("history GET error", e);
		return NextResponse.json({ error: "Bad request" }, { status: 400 });
	}
}


