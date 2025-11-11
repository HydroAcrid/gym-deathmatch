import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabaseClient";

export async function GET(req: Request) {
	const supabase = getServerSupabase();
	if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 501 });
	try {
		const { searchParams } = new URL(req.url);
		const userId = searchParams.get("userId");
		if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });
		// Prefer user_profile
		const { data: prof } = await supabase.from("user_profile").select("*").eq("user_id", userId).maybeSingle();
		if (prof) return NextResponse.json({ displayName: prof.display_name ?? null, avatarUrl: prof.avatar_url ?? null });
		// Fallback: derive from first player with user_id
		const { data: player } = await supabase.from("player").select("name,avatar_url").eq("user_id", userId).maybeSingle();
		return NextResponse.json({ displayName: player?.name ?? null, avatarUrl: player?.avatar_url ?? null });
	} catch {
		return NextResponse.json({ displayName: null, avatarUrl: null });
	}
}

export async function PUT(req: Request) {
	const supabase = getServerSupabase();
	if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 501 });
	try {
		const { userId, displayName, avatarUrl } = await req.json();
		if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });
		const row = { user_id: userId, display_name: displayName ?? null, avatar_url: avatarUrl ?? null };
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


