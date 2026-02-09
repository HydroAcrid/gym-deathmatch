import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabaseClient";
import { getRequestUserId } from "@/lib/requestAuth";

export async function POST(req: Request) {
	const supabase = getServerSupabase();
	if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 501 });
	try {
		const userId = await getRequestUserId(req);
		if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { overwriteAll, playerId } = await req.json();
		const { data: prof } = await supabase.from("user_profile").select("*").eq("user_id", userId).maybeSingle();
		if (!prof) return NextResponse.json({ ok: true });

		// Optional: backfill a specific player row (older lobbies may have null user_id)
		if (playerId) {
			const { data: ownedPlayer } = await supabase.from("player").select("id").eq("id", playerId).eq("user_id", userId).maybeSingle();
			if (!ownedPlayer) return NextResponse.json({ error: "Player not found for user" }, { status: 403 });
			const backfill: any = { user_id: userId };
			if (prof.display_name) backfill.name = prof.display_name;
			if (prof.location !== undefined) backfill.location = prof.location;
			if (prof.quip !== undefined) backfill.quip = prof.quip;
			await supabase.from("player").update(backfill).eq("id", playerId);
		}

		if (overwriteAll) {
			// Force-sync all mapped fields from profile onto every player row for this user
			const updates: any = {};
			if (prof.display_name) updates.name = prof.display_name;
			if (prof.location !== null && prof.location !== undefined) updates.location = prof.location;
			if (prof.quip !== null && prof.quip !== undefined) updates.quip = prof.quip;
			if (Object.keys(updates).length) {
				// Update all player rows for this user
				await supabase.from("player").update(updates).eq("user_id", userId);
				// Also update the specific playerId if provided (in case user_id wasn't set yet)
				if (playerId) {
					await supabase.from("player").update(updates).eq("id", playerId);
				}
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

