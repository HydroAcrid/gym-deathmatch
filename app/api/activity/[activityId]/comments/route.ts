import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabaseClient";
import { sendPushToUser } from "@/lib/push";

type CommentResponse = {
	id: string;
	lobbyId: string;
	activityId: string;
	parentId: string | null;
	threadRootId: string | null;
	body: string;
	createdAt: string;
	authorPlayerId: string;
	authorName: string | null;
	authorAvatarUrl?: string | null;
};

async function requireMembership(supabase: NonNullable<ReturnType<typeof getServerSupabase>>, lobbyId: string, userId: string) {
	const { data: member } = await supabase
		.from("player")
		.select("id")
		.eq("lobby_id", lobbyId)
		.eq("user_id", userId)
		.maybeSingle();
	return member;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ activityId: string }> }) {
	const { activityId } = await params;
	const supabase = getServerSupabase();
	if (!supabase) return NextResponse.json({ comments: [] }, { status: 501 });

	const userId = req.headers.get("x-user-id") || "";
	if (!userId) return NextResponse.json({ error: "Missing user" }, { status: 401 });

	const { data: activity } = await supabase
		.from("manual_activities")
		.select("id,lobby_id,player_id")
		.eq("id", activityId)
		.maybeSingle();
	if (!activity) return NextResponse.json({ error: "Activity not found" }, { status: 404 });

	const member = await requireMembership(supabase, activity.lobby_id, userId);
	if (!member) return NextResponse.json({ error: "Not a lobby member" }, { status: 403 });

	const { data, error } = await supabase
		.from("post_comments")
		.select("id,lobby_id,activity_id,parent_id,thread_root_id,body,created_at,author_player_id, author:author_player_id(name,avatar_url)")
		.eq("activity_id", activityId)
		.order("created_at", { ascending: true });
	if (error) return NextResponse.json({ error: "Failed to load comments" }, { status: 500 });

	const comments: CommentResponse[] = (data ?? []).map(row => ({
		id: row.id as string,
		lobbyId: row.lobby_id as string,
		activityId: row.activity_id as string,
		parentId: (row.parent_id as string | null) ?? null,
		threadRootId: (row.thread_root_id as string | null) ?? null,
		body: row.body as string,
		createdAt: row.created_at as string,
		authorPlayerId: row.author_player_id as string,
		authorName: (row as any)?.author?.name ?? null,
		authorAvatarUrl: (row as any)?.author?.avatar_url ?? null
	}));

	return NextResponse.json({ comments });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ activityId: string }> }) {
	const { activityId } = await params;
	const supabase = getServerSupabase();
	if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 501 });

	const userId = req.headers.get("x-user-id") || "";
	if (!userId) return NextResponse.json({ error: "Missing user" }, { status: 401 });

	const bodyJson = await req.json().catch(() => null);
	const text = (bodyJson?.body as string | undefined)?.trim() ?? "";
	const parentId = (bodyJson?.parentId as string | undefined) || null;
	if (!text || text.length === 0) return NextResponse.json({ error: "Comment cannot be empty" }, { status: 400 });
	if (text.length > 500) return NextResponse.json({ error: "Comment too long (max 500 chars)" }, { status: 400 });

	const { data: activity } = await supabase
		.from("manual_activities")
		.select("id,lobby_id")
		.eq("id", activityId)
		.maybeSingle();
	if (!activity) return NextResponse.json({ error: "Activity not found" }, { status: 404 });

	const { data: player } = await supabase
		.from("player")
		.select("id,name,avatar_url,user_id")
		.eq("lobby_id", activity.lobby_id)
		.eq("user_id", userId)
		.maybeSingle();
	if (!player) return NextResponse.json({ error: "Not a lobby member" }, { status: 403 });

	let threadRootId: string | null = null;
	let parentAuthorUserId: string | null = null;
	let parentAuthorName: string | null = null;
	if (parentId) {
		const { data: parent } = await supabase
			.from("post_comments")
			.select("id,lobby_id,activity_id,thread_root_id,author_player_id")
			.eq("id", parentId)
			.maybeSingle();
		if (!parent || parent.activity_id !== activity.id || parent.lobby_id !== activity.lobby_id) {
			return NextResponse.json({ error: "Invalid parent" }, { status: 400 });
		}
		threadRootId = (parent.thread_root_id as string | null) ?? parent.id;
		if (parent.author_player_id) {
			const { data: parentAuthor } = await supabase.from("player").select("user_id,name").eq("id", parent.author_player_id as string).maybeSingle();
			parentAuthorUserId = parentAuthor?.user_id ?? null;
			parentAuthorName = parentAuthor?.name ?? null;
		}
	}

	const { data: inserted, error } = await supabase
		.from("post_comments")
		.insert({
			lobby_id: activity.lobby_id,
			activity_id: activity.id,
			author_player_id: player.id,
			parent_id: parentId,
			thread_root_id: threadRootId,
			body: text
		})
		.select("id")
		.single();
	if (error) return NextResponse.json({ error: "Failed to post comment" }, { status: 500 });

	const newId = inserted?.id as string;
	let finalThreadRoot = threadRootId;
	if (!finalThreadRoot) {
		finalThreadRoot = newId;
		await supabase.from("post_comments").update({ thread_root_id: newId }).eq("id", newId);
	}

	const { data: row } = await supabase
		.from("post_comments")
		.select("id,lobby_id,activity_id,parent_id,thread_root_id,body,created_at,author_player_id, author:author_player_id(name,avatar_url)")
		.eq("id", newId)
		.single();

	const comment: CommentResponse | null = row
		? {
				id: row.id as string,
				lobbyId: row.lobby_id as string,
				activityId: row.activity_id as string,
				parentId: (row.parent_id as string | null) ?? null,
				threadRootId: (row.thread_root_id as string | null) ?? finalThreadRoot,
				body: row.body as string,
				createdAt: row.created_at as string,
				authorPlayerId: row.author_player_id as string,
				authorName: (row as any)?.author?.name ?? null,
				authorAvatarUrl: (row as any)?.author?.avatar_url ?? null
		  }
		: null;

	// Push notify activity owner or parent comment author (if different from poster)
	try {
		const { data: ownerPlayer } = await supabase.from("player").select("user_id,name").eq("id", activity.player_id as string).maybeSingle();
		const targets: Array<{ userId: string; name?: string | null }> = [];
		if (parentAuthorUserId && parentAuthorUserId !== player.user_id) {
			targets.push({ userId: parentAuthorUserId, name: parentAuthorName });
		} else if (ownerPlayer?.user_id && ownerPlayer.user_id !== player.user_id) {
			targets.push({ userId: ownerPlayer.user_id as string, name: ownerPlayer.name });
		}
		const bodyText = text.slice(0, 120);
		for (const t of targets) {
			await sendPushToUser(t.userId, {
				title: t.name ? `${t.name}, new comment` : "New comment",
				body: bodyText,
				url: `/lobby/${activity.lobby_id}/history`
			});
		}
	} catch {
		// best-effort
	}

	return NextResponse.json({ comment }, { status: 201 });
}
