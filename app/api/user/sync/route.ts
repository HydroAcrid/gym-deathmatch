import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabaseClient";

export async function POST(req: Request) {
	const supabase = getServerSupabase();
	if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 501 });
	try {
		const { userId } = await req.json();
		if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });
		const { data: prof } = await supabase.from("user_profile").select("display_name").eq("user_id", userId).maybeSingle();
		const displayName = prof?.display_name || null;
		if (!displayName) return NextResponse.json({ ok: true }); // nothing to sync
		// Update any player rows for this user where name is generic
		await supabase
			.from("player")
			.update({ name: displayName })
			.eq("user_id", userId)
			.in("name", ["Owner", "Me"]);
		return NextResponse.json({ ok: true });
	} catch {
		return NextResponse.json({ ok: false });
	}
}


