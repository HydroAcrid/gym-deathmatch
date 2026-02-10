import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabaseClient";
import { getRequestUserId } from "@/lib/requestAuth";

export async function POST(req: Request) {
	const supabase = getServerSupabase();
	if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 501 });
	try {
		const userId = await getRequestUserId(req);
		if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { avatarUrl, playerId } = await req.json();
		if (!avatarUrl) return NextResponse.json({ error: "Missing params" }, { status: 400 });
		// Try update by user_id (preferred)
		let err: any = null;
		let updated = 0;
		try {
			const { data, error } = await supabase.from("player")
				.update({ avatar_url: avatarUrl })
				.eq("user_id", userId)
				.select("id");
			if (error) err = error;
			updated = Array.isArray(data) ? data.length : 0;
		} catch (e: any) {
			err = e;
		}
		// If user_id column missing or nothing updated, fallback to playerId if provided
		if ((err && (String(err?.message || "").includes("user_id") || String(err?.code || "") === "42703")) || updated === 0) {
			if (playerId) {
				const { data: ownedPlayer } = await supabase.from("player").select("id").eq("id", playerId).eq("user_id", userId).maybeSingle();
				if (!ownedPlayer) return NextResponse.json({ error: "Player not found for user" }, { status: 403 });
				// Update by player id and attach this player to the current user for future lookups
				const { error: e2 } = await supabase
					.from("player")
					.update({ avatar_url: avatarUrl, user_id: userId })
					.eq("id", playerId);
				if (e2) {
					console.error("avatar update error fallback", e2);
					return NextResponse.json({ error: "Failed to update avatar" }, { status: 500 });
				}
			} else if (err) {
				console.error("avatar update error", err);
				return NextResponse.json({ error: "Failed to update avatar" }, { status: 500 });
			}
		}
		return NextResponse.json({ ok: true });
	} catch {
		return NextResponse.json({ error: "Bad request" }, { status: 400 });
	}
}

