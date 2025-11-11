import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabaseClient";

export async function POST(req: Request) {
	const supabase = getServerSupabase();
	if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 501 });
	try {
		const { userId, avatarUrl, playerId } = await req.json();
		if (!userId || !avatarUrl) return NextResponse.json({ error: "Missing params" }, { status: 400 });
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


