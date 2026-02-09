import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabaseClient";
import { getRequestUserId } from "@/lib/requestAuth";

export async function POST(req: NextRequest) {
	const supabase = getServerSupabase();
	if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 501 });

	const userId = await getRequestUserId(req);
	if (!userId) return NextResponse.json({ error: "Missing user" }, { status: 401 });

	const body = await req.json().catch(() => null);
	const endpoint = body?.endpoint;
	if (!endpoint) return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });

	await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint).eq("user_id", userId);
	return NextResponse.json({ ok: true });
}
