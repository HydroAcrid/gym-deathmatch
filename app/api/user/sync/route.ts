import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabaseClient";

export async function POST(req: Request) {
	const supabase = getServerSupabase();
	if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 501 });
	try {
		const { userId } = await req.json();
		if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });
		const { data: prof } = await supabase.from("user_profile").select("*").eq("user_id", userId).maybeSingle();
		if (!prof) return NextResponse.json({ ok: true });
		// Update name if generic
		if (prof.display_name) {
			await supabase.from("player")
				.update({ name: prof.display_name })
				.eq("user_id", userId)
				.in("name", ["Owner", "Me"]);
		}
		// Fill missing location/quip if null
		const updates: any = {};
		if (prof.location) updates.location = prof.location;
		if (prof.quip) updates.quip = prof.quip;
		if (Object.keys(updates).length) {
			await supabase.from("player")
				.update(updates)
				.eq("user_id", userId)
				.is("location", null);
			await supabase.from("player")
				.update(updates)
				.eq("user_id", userId)
				.is("quip", null);
		}
		return NextResponse.json({ ok: true });
	} catch {
		return NextResponse.json({ ok: false });
	}
}


