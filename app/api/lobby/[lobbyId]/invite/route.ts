import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabaseClient";
import type { PlayerRow } from "@/types/db";

export async function POST(req: NextRequest, { params }: { params: Promise<{ lobbyId: string }> }) {
	const { lobbyId } = await params;
	const supabase = getServerSupabase();
	if (!supabase) {
		return NextResponse.json({ error: "Supabase not configured" }, { status: 501 });
	}
	try {
		const body = await req.json();
		const p: PlayerRow = {
			id: body.id,
			lobby_id: lobbyId,
			name: body.name,
			avatar_url: body.avatarUrl ?? null,
			location: body.location ?? null,
			quip: body.quip ?? null
		};
		// attach user id if provided
		if (body.userId) (p as any).user_id = body.userId;
		const { error } = await supabase.from<PlayerRow>("player").insert(p);
		if (error) {
			console.error("invite insert error", error);
			return NextResponse.json({ error: "Failed to insert" }, { status: 500 });
		}
		return NextResponse.json({ ok: true });
	} catch (e) {
		return NextResponse.json({ error: "Bad request" }, { status: 400 });
	}
}


