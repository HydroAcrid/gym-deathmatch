import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabaseClient";

export async function POST(req: Request) {
	const supabase = getServerSupabase();
	if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 501 });
	try {
		const { userId, overwriteAll } = await req.json();
		if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });
		const { data: prof } = await supabase.from("user_profile").select("*").eq("user_id", userId).maybeSingle();
		if (!prof) return NextResponse.json({ ok: true });

		if (overwriteAll) {
			// Force-sync all mapped fields from profile onto every player row for this user
			const updates: any = {};
			if (prof.display_name) updates.name = prof.display_name;
			if (prof.location !== null && prof.location !== undefined) updates.location = prof.location;
			if (prof.quip !== null && prof.quip !== undefined) updates.quip = prof.quip;
			if (Object.keys(updates).length) {
				await supabase.from("player").update(updates).eq("user_id", userId);
			}
		} else {
			// Conservative sync (default): fix obvious placeholders and fill missing fields
			if (prof.display_name) {
				await supabase.from("player")
					.update({ name: prof.display_name })
					.eq("user_id", userId)
					.in("name", ["Owner", "Me"]);
			}
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
		}
		return NextResponse.json({ ok: true });
	} catch {
		return NextResponse.json({ ok: false });
	}
}


