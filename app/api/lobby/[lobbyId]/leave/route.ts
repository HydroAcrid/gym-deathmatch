import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabaseClient";
import { getRequestUserId } from "@/lib/requestAuth";
import { refreshLobbyLiveSnapshot } from "@/lib/liveSnapshotStore";

type SupabaseClient = NonNullable<ReturnType<typeof getServerSupabase>>;

async function hasRecordedHistory(supabase: SupabaseClient, lobbyId: string, playerId: string) {
	const [manual, actorEvents, targetEvents, comments] = await Promise.all([
		supabase
			.from("manual_activities")
			.select("id", { head: true, count: "exact" })
			.eq("lobby_id", lobbyId)
			.eq("player_id", playerId),
		supabase
			.from("history_events")
			.select("id", { head: true, count: "exact" })
			.eq("lobby_id", lobbyId)
			.eq("actor_player_id", playerId),
		supabase
			.from("history_events")
			.select("id", { head: true, count: "exact" })
			.eq("lobby_id", lobbyId)
			.eq("target_player_id", playerId),
		supabase
			.from("comments")
			.select("id", { head: true, count: "exact" })
			.eq("lobby_id", lobbyId)
			.eq("primary_player_id", playerId),
	]);
	return (manual.count ?? 0) > 0 || (actorEvents.count ?? 0) > 0 || (targetEvents.count ?? 0) > 0 || (comments.count ?? 0) > 0;
}

export async function POST(req: Request, { params }: { params: Promise<{ lobbyId: string }> }) {
	const { lobbyId } = await params;
	const supabase = getServerSupabase();
	if (!supabase) return NextResponse.json({ ok: false }, { status: 501 });
	try {
		const userId = await getRequestUserId(req);
		if (!userId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
		const { data: lobby } = await supabase.from("lobby").select("owner_id, owner_user_id").eq("id", lobbyId).maybeSingle();
		if (lobby?.owner_user_id && lobby.owner_user_id === userId) {
			return NextResponse.json({ ok: false, error: "Lobby owner cannot leave. Transfer ownership first using the settings menu." }, { status: 403 });
		}
		// Find the player's row in this lobby
		const { data: me } = await supabase.from("player").select("id").eq("lobby_id", lobbyId).eq("user_id", userId).maybeSingle();
		if (!me?.id) return NextResponse.json({ ok: false, error: "Not in lobby" }, { status: 404 });
		// If this player is the owner, prevent them from leaving
		// Owner can only leave if they transfer ownership first (via /owner endpoint)
		if (lobby?.owner_id === me.id) {
			return NextResponse.json({ ok: false, error: "Lobby owner cannot leave. Transfer ownership first using the settings menu." }, { status: 403 });
		}
		if (await hasRecordedHistory(supabase, lobbyId, me.id)) {
			return NextResponse.json({
				ok: false,
				error: "Cannot leave after recording history in this lobby. Ask the host to archive/end season instead."
			}, { status: 409 });
		}
		const { error } = await supabase.from("player").delete().eq("id", me.id);
		if (error) {
			console.error("leave lobby error", error);
			return NextResponse.json({ ok: false }, { status: 500 });
		}
		void refreshLobbyLiveSnapshot(lobbyId);
		return NextResponse.json({ ok: true });
	} catch {
		return NextResponse.json({ ok: false, error: "bad request" }, { status: 400 });
	}
}
