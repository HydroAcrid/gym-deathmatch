import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabaseClient";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
	const { eventId } = await params;
	const supabase = getServerSupabase();
	if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 501 });

	const userId = req.headers.get("x-user-id") || "";
	if (!userId) return NextResponse.json({ error: "Missing user" }, { status: 401 });

	// Fetch event to get lobby_id
	const { data: ev } = await supabase.from("history_events").select("id,lobby_id").eq("id", eventId).maybeSingle();
	if (!ev) return NextResponse.json({ error: "Event not found" }, { status: 404 });

	// Verify owner by lobby.owner_user_id
	const { data: lobby } = await supabase.from("lobby").select("owner_user_id").eq("id", ev.lobby_id).maybeSingle();
	if (!lobby || lobby.owner_user_id !== userId) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

	const { error } = await supabase.from("history_events").delete().eq("id", eventId);
	if (error) return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
	return NextResponse.json({ ok: true });
}
