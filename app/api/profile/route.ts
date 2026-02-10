import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabaseClient";
import { getRequestUserId } from "@/lib/requestAuth";

export async function GET(req: Request) {
	const supabase = getServerSupabase();
	if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 501 });
	try {
		const userId = await getRequestUserId(req);
		if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		// Prefer user_profile
		const { data: prof } = await supabase.from("user_profile").select("*").eq("user_id", userId).maybeSingle();
		if (prof) {
			return NextResponse.json({
				displayName: prof.display_name ?? null,
				avatarUrl: prof.avatar_url ?? null,
				location: prof.location ?? null,
				quip: prof.quip ?? null
			});
		}
		// Fallback: derive from first player with user_id
		const { data: player } = await supabase.from("player").select("name,avatar_url,location,quip").eq("user_id", userId).maybeSingle();
		return NextResponse.json({
			displayName: player?.name ?? null,
			avatarUrl: player?.avatar_url ?? null,
			location: player?.location ?? null,
			quip: player?.quip ?? null
		});
	} catch {
		return NextResponse.json({ displayName: null, avatarUrl: null });
	}
}

export async function PUT(req: Request) {
	const supabase = getServerSupabase();
	if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 501 });
	try {
		const userId = await getRequestUserId(req);
		if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { displayName, avatarUrl, location, quip } = await req.json();
		const row = { user_id: userId, display_name: displayName ?? null, avatar_url: avatarUrl ?? null, location: location ?? null, quip: quip ?? null };
		const { error } = await supabase.from("user_profile").upsert(row, { onConflict: "user_id" });
		if (error) {
			console.error("profile upsert error", error);
			return NextResponse.json({ error: "Failed to save profile" }, { status: 500 });
		}
		return NextResponse.json({ ok: true });
	} catch {
		return NextResponse.json({ error: "Bad request" }, { status: 400 });
	}
}

