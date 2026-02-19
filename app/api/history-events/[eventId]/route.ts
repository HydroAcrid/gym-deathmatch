import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabaseClient";
import { getRequestUserId } from "@/lib/requestAuth";

type PlayerUserLookup = { user_id: string | null };

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
	const { eventId } = await params;
	const supabase = getServerSupabase();
	if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 501 });

	const userId = await getRequestUserId(req);
	if (!userId) return NextResponse.json({ error: "Missing user" }, { status: 401 });

	// Prefer history_events rows.
	const { data: ev } = await supabase.from("history_events").select("id,lobby_id").eq("id", eventId).maybeSingle();
	if (ev) {
		// Verify owner by lobby.owner_user_id
		const { data: lobby } = await supabase.from("lobby").select("owner_user_id").eq("id", ev.lobby_id).maybeSingle();
		if (!lobby || lobby.owner_user_id !== userId) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

		const { error } = await supabase.from("history_events").delete().eq("id", eventId);
		if (error) return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
		return NextResponse.json({ ok: true });
	}

	// Fallback for merged history feed rows that actually live in `comments`.
	const { data: comment } = await supabase
		.from("comments")
		.select("id,lobby_id,primary_player_id")
		.eq("id", eventId)
		.maybeSingle();
	if (!comment) return NextResponse.json({ error: "Event not found" }, { status: 404 });

	const [lobbyRes, authorRes] = await Promise.all([
		supabase.from("lobby").select("owner_user_id").eq("id", comment.lobby_id).maybeSingle(),
		comment.primary_player_id
			? supabase.from("player").select("user_id").eq("id", comment.primary_player_id).maybeSingle()
			: Promise.resolve({ data: null as PlayerUserLookup | null })
	]);
	const isOwner = lobbyRes.data?.owner_user_id === userId;
	const isAuthor = authorRes.data?.user_id === userId;
	if (!isOwner && !isAuthor) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

	const { error } = await supabase.from("comments").delete().eq("id", eventId);
	if (error) return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
	return NextResponse.json({ ok: true });
}
