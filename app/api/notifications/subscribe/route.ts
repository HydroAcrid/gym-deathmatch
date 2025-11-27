import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabaseClient";

export async function POST(req: NextRequest) {
	const supabase = getServerSupabase();
	if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 501 });

	const userId = req.headers.get("x-user-id") || "";
	if (!userId) return NextResponse.json({ error: "Missing user" }, { status: 401 });

	const body = await req.json().catch(() => null);
	const sub = body?.subscription;
	if (!sub || !sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
		return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
	}

	// Replace any prior subscription for this endpoint
	await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
	const { error } = await supabase.from("push_subscriptions").insert({
		user_id: userId,
		endpoint: sub.endpoint,
		p256dh: sub.keys.p256dh,
		auth: sub.keys.auth,
		subscription: sub
	});
	if (error) return NextResponse.json({ error: "Failed to save subscription" }, { status: 500 });

	return NextResponse.json({ ok: true });
}
