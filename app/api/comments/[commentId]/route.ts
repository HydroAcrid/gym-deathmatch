import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabaseClient";
import { getRequestUserId } from "@/lib/requestAuth";

type PlayerUserLookup = { user_id: string | null };

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ commentId: string }> }) {
	const { commentId } = await params;
	const supabase = getServerSupabase();
	if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 501 });

	const userId = await getRequestUserId(req);
	if (!userId) return NextResponse.json({ error: "Missing user" }, { status: 401 });

	const { data: postComment } = await supabase
		.from("post_comments")
		.select("id,lobby_id,activity_id,author_player_id")
		.eq("id", commentId)
		.maybeSingle();

	if (postComment) {
		const [{ data: lobby }, { data: author }] = await Promise.all([
			supabase.from("lobby").select("owner_user_id").eq("id", postComment.lobby_id).maybeSingle(),
			supabase.from("player").select("user_id").eq("id", postComment.author_player_id).maybeSingle()
		]);

		const isAuthor = author?.user_id === userId;
		const isOwner = lobby?.owner_user_id === userId;
		if (!isAuthor && !isOwner) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

		const { error } = await supabase.from("post_comments").delete().eq("id", commentId);
		if (error) return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
		return NextResponse.json({ ok: true });
	}

	// Fallback: system commentary row from `comments` table
	const { data: systemComment } = await supabase
		.from("comments")
		.select("id,lobby_id,primary_player_id")
		.eq("id", commentId)
		.maybeSingle();
	if (!systemComment) return NextResponse.json({ error: "Comment not found" }, { status: 404 });

	const [lobbyRes, authorRes] = await Promise.all([
		supabase.from("lobby").select("owner_user_id").eq("id", systemComment.lobby_id).maybeSingle(),
		systemComment.primary_player_id
			? supabase.from("player").select("user_id").eq("id", systemComment.primary_player_id).maybeSingle()
			: Promise.resolve({ data: null as PlayerUserLookup | null })
	]);
	const isOwner = lobbyRes.data?.owner_user_id === userId;
	const isAuthor = authorRes.data?.user_id === userId;
	if (!isOwner && !isAuthor) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

	const { error } = await supabase.from("comments").delete().eq("id", commentId);
	if (error) return NextResponse.json({ error: "Failed to delete" }, { status: 500 });

	return NextResponse.json({ ok: true });
}
