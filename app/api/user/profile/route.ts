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
		if (prof) return NextResponse.json({ name: prof.display_name ?? null, avatarUrl: prof.avatar_url ?? null, location: prof.location ?? null, quip: prof.quip ?? null });
		// Fallback to player
		const { data } = await supabase.from("player").select("name,avatar_url,location,quip").eq("user_id", userId).maybeSingle();
		return NextResponse.json({ name: data?.name ?? null, avatarUrl: data?.avatar_url ?? null, location: data?.location ?? null, quip: data?.quip ?? null });
	} catch {
		return NextResponse.json({ name: null, avatarUrl: null });
	}
}


