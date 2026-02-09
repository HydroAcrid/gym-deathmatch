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
		if (prof) return NextResponse.json({ name: prof.display_name ?? null, avatarUrl: prof.avatar_url ?? null, location: prof.location ?? null, quip: prof.quip ?? null });
		// Fallback to player
		const { data } = await supabase.from("player").select("name,avatar_url,location,quip").eq("user_id", userId).maybeSingle();
		return NextResponse.json({ name: data?.name ?? null, avatarUrl: data?.avatar_url ?? null, location: data?.location ?? null, quip: data?.quip ?? null });
	} catch {
		return NextResponse.json({ name: null, avatarUrl: null });
	}
}

export async function PUT(req: Request) {
	const supabase = getServerSupabase();
	if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 501 });
	try {
		const userId = await getRequestUserId(req);
		if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const body = await req.json();

		// Enforce sane limits server-side
		const clamp = (v: any, max: number) => {
			if (v === null || v === undefined) return null;
			const s = String(v);
			return s.length > max ? s.slice(0, max) : s;
		};

		const row: any = {
			user_id: userId,
			display_name: clamp(body?.displayName ?? null, 40),
			avatar_url: body?.avatarUrl ?? null,
			location: clamp(body?.location ?? null, 60),
			quip: clamp(body?.quip ?? null, 140)
		};

		const { error } = await supabase.from("user_profile").upsert(row, { onConflict: "user_id" });
		if (error) return NextResponse.json({ error: error.message }, { status: 500 });

		return NextResponse.json({ ok: true });
	} catch (e: any) {
		return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 });
	}
}

