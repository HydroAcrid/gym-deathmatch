import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabaseClient";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ commentId: string }> }) {
	const { commentId } = await params;
	const supabase = getServerSupabase();
	if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 501 });

	const userId = req.headers.get("x-user-id") || "";
	if (!userId) return NextResponse.json({ error: "Missing user" }, { status: 401 });

	const { data: comment } = await supabase
		.from("post_comments")
		.select("id,lobby_id,activity_id,author_player_id")
		.eq("id", commentId)
		.maybeSingle();
	if (!comment) return NextResponse.json({ error: "Comment not found" }, { status: 404 });

	const [{ data: lobby }, { data: author }] = await Promise.all([
		supabase.from("lobby").select("owner_user_id").eq("id", comment.lobby_id).maybeSingle(),
		supabase.from("player").select("user_id").eq("id", comment.author_player_id).maybeSingle()
	]);

	const isAuthor = author?.user_id === userId;
	const isOwner = lobby?.owner_user_id === userId;
	if (!isAuthor && !isOwner) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

	const { error } = await supabase.from("post_comments").delete().eq("id", commentId);
	if (error) return NextResponse.json({ error: "Failed to delete" }, { status: 500 });

	return NextResponse.json({ ok: true });
}
