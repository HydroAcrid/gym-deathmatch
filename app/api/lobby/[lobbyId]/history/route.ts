import { NextRequest, NextResponse } from "next/server";
import { resolveLobbyAccess } from "@/lib/lobbyAccess";

type VoteRow = {
  activity_id: string;
  choice: "legit" | "sus";
  voter_player_id: string | null;
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ lobbyId: string }> }) {
	const { lobbyId } = await params;
	const access = await resolveLobbyAccess(req, lobbyId);
	if (!access.ok) return NextResponse.json({ error: access.message }, { status: access.status });
	if (!access.memberPlayerId && !access.isOwner) return NextResponse.json({ error: "Not a member of lobby" }, { status: 403 });
	const supabase = access.supabase;
	const member = { id: access.memberPlayerId || access.ownerPlayerId };

	try {
		const limitParam = Number(new URL(req.url).searchParams.get("limit") || "50");
		const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 100) : 50;

		const visibilityFilters: Array<"history" | "both"> = ["history", "both"];
    const [{ data: activities }, { data: events }, { data: comments }, { data: players }, { data: lobby }] = await Promise.all([
      supabase
        .from("manual_activities")
        .select("*, player:player_id(id,name,avatar_url,user_id)")
        .eq("lobby_id", lobbyId)
        .order("created_at", { ascending: false })
        .limit(limit),
      supabase
        .from("history_events")
        .select("*, actor:actor_player_id(id,name,avatar_url,user_id), target:target_player_id(id,name,avatar_url,user_id)")
        .eq("lobby_id", lobbyId)
        .order("created_at", { ascending: false })
        .limit(limit),
      supabase.from("comments").select("id,type,rendered,created_at,primary_player_id").eq("lobby_id", lobbyId).in("visibility", visibilityFilters).order("created_at", { ascending: false }).limit(limit),
      supabase.from("player").select("id,name,avatar_url,user_id,hearts,lives_remaining").eq("lobby_id", lobbyId),
      supabase.from("lobby").select("id,name,owner_id,owner_user_id,cash_pool").eq("id", lobbyId).maybeSingle(),
    ]);

		let voteRows: VoteRow[] = [];
		const activityIds = (activities ?? []).map(a => a.id);
		if (activityIds.length) {
      const { data: rows } = await supabase
        .from("activity_votes")
        .select("activity_id,choice,voter_player_id")
        .in("activity_id", activityIds);
			voteRows = (rows ?? []) as VoteRow[];
		}

    const votesByAct: Record<string, { legit: number; sus: number; mine?: "legit" | "sus" }> = {};
    for (const v of voteRows) {
      const key = v.activity_id;
      if (!votesByAct[key]) votesByAct[key] = { legit: 0, sus: 0 };
      if (v.choice === "legit") votesByAct[key].legit++;
      if (v.choice === "sus") votesByAct[key].sus++;
      if (v.voter_player_id === member.id) votesByAct[key].mine = v.choice as "legit" | "sus";
    }

    const playerRows = players ?? [];
    const playerMap = new Map<string, any>();
    for (const p of playerRows) {
      if (p?.id) playerMap.set(p.id, p);
    }

    const toLite = (player: any) =>
      player
        ? {
            id: player.id,
            name: player.name,
            avatar_url: player.avatar_url ?? null,
            user_id: player.user_id ?? null,
          }
        : null;

    const rawActivities = activities ?? [];
    const normalizedActivities = rawActivities.map((activity: any) => {
      const playerId = activity.player_id ?? activity.playerId ?? "";
      const createdAtRaw = activity.created_at ?? activity.createdAt ?? activity.date;
      const createdDate = createdAtRaw ? new Date(createdAtRaw) : new Date();
      const createdAt = isNaN(createdDate.getTime()) ? new Date().toISOString() : createdDate.toISOString();
      const durationRaw = Number(activity.duration_minutes ?? activity.duration ?? activity.minutes ?? 0);
      const distanceRaw = activity.distance_km ?? activity.distance ?? null;
      const distanceVal = distanceRaw == null ? undefined : Number(distanceRaw);
      const joinedPlayer = activity.player ?? null;
      const player = playerId ? playerMap.get(playerId) ?? joinedPlayer : joinedPlayer;
      const playerSnapshot = toLite(player);

      return {
        ...activity,
        player_id: playerId,
        player,
        createdAt,
        duration: isNaN(durationRaw) ? 0 : durationRaw,
        distance: distanceVal !== undefined && !isNaN(distanceVal) ? distanceVal : undefined,
        imageUrl: activity.photo_url ?? activity.image_url ?? activity.imageUrl ?? undefined,
        notes: activity.notes ?? undefined,
        caption: activity.caption ?? undefined,
        source: activity.source ?? "manual",
        player_name: player?.name ?? activity.player_name ?? null,
        player_avatar_url: playerSnapshot?.avatar_url ?? activity.player_avatar_url ?? null,
        player_user_id: playerSnapshot?.user_id ?? activity.player_user_id ?? null,
        player_snapshot: playerSnapshot,
      };
    });

    const normalizedEvents = (events ?? []).map((event: any) => {
      const actorId = event.actor_player_id ?? event.actorPlayerId ?? null;
      const targetId = event.target_player_id ?? event.targetPlayerId ?? null;
      const actorJoined = event.actor ?? null;
      const targetJoined = event.target ?? null;
      const actor = actorId ? playerMap.get(actorId) ?? actorJoined : actorJoined;
      const target = targetId ? playerMap.get(targetId) ?? targetJoined : targetJoined;
      const actorSnapshot = toLite(actor);
      const targetSnapshot = toLite(target);
      return {
        ...event,
        actor_player_id: actorId,
        target_player_id: targetId,
        actor_name: actorSnapshot?.name ?? event.actor_name ?? null,
        target_name: targetSnapshot?.name ?? event.target_name ?? null,
        actor_snapshot: actorSnapshot,
        target_snapshot: targetSnapshot,
      };
    });

    return NextResponse.json({
      activities: normalizedActivities,
      events: normalizedEvents,
      comments: comments ?? [],
      players: playerRows,
      lobby: lobby ?? null,
      ownerPlayerId: lobby?.owner_id ?? null,
      ownerUserId: lobby?.owner_user_id ?? null,
      lobbyName: lobby?.name ?? null,
      votes: votesByAct,
			myPlayerId: member.id
		}, { status: 200 });
	} catch (e) {
		console.error("history GET error", e);
		return NextResponse.json({ error: "Bad request" }, { status: 400 });
	}
}
