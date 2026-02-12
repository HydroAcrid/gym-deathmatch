type PlayerLite = {
	id: string;
	name: string | null;
	avatar_url?: string | null;
	user_id?: string | null;
};

type VoteRow = {
	activity_id: string;
	choice: "legit" | "sus";
	voter_player_id: string | null;
};

type TimelineSource = "activity" | "event" | "comment";

export type TimelineItem = {
	id: string;
	source: TimelineSource;
	createdAt: string;
	text: string;
	player: PlayerLite | null;
};

export type TimelineData = {
	activities: any[];
	events: any[];
	comments: any[];
	players: PlayerLite[];
	lobby: any | null;
	ownerPlayerId: string | null;
	ownerUserId: string | null;
	lobbyName: string | null;
	votes: Record<string, { legit: number; sus: number; mine?: "legit" | "sus" }>;
	myPlayerId: string | null;
	timeline: TimelineItem[];
};

type LoadLobbyTimelineArgs = {
	supabase: any;
	lobbyId: string;
	limit: number;
	memberPlayerId: string | null;
	commentVisibility?: Array<"feed" | "history" | "both">;
};

function normalizePlayer(value: any): PlayerLite | null {
	if (!value) return null;
	const row = Array.isArray(value) ? value[0] : value;
	if (!row?.id) return null;
	return {
		id: row.id,
		name: row.name ?? null,
		avatar_url: row.avatar_url ?? null,
		user_id: row.user_id ?? null,
	};
}

function titleCase(input: string): string {
	if (!input) return "Workout";
	const lower = input.toLowerCase();
	return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export function renderEventLine(ev: any, actor: PlayerLite | null, target: PlayerLite | null): string {
	const actorName = actor?.name || "System";
	const targetName = target?.name || "Athlete";

	if (ev.type === "ACTIVITY_LOGGED") return `${actorName} posted a workout`;
	if (ev.type === "VOTE_RESULT") {
		const result = String(ev.payload?.result || "decision").replace(/_/g, " ");
		return `Vote result: ${result} (${ev.payload?.legit ?? 0} legit · ${ev.payload?.sus ?? 0} sus)`;
	}
	if (ev.type === "WEEKLY_TARGET_MET") {
		const wk = ev.payload?.weeklyTarget ?? "target";
		const cnt = ev.payload?.workouts ?? "?";
		return `${targetName} met weekly target: ${cnt}/${wk}`;
	}
	if (ev.type === "WEEKLY_TARGET_MISSED") {
		const wk = ev.payload?.weeklyTarget ?? "target";
		const cnt = ev.payload?.workouts ?? "?";
		return `${targetName} missed weekly target: ${cnt}/${wk}`;
	}
	if (ev.type === "OWNER_OVERRIDE_ACTIVITY") {
		return `${actorName} set an activity to ${String(ev.payload?.newStatus || "").toUpperCase()}${target ? ` for ${targetName}` : ""}`;
	}
	if (ev.type === "OWNER_ADJUST_HEARTS") {
		const d = Number(ev.payload?.delta || 0);
		const sign = d > 0 ? "+" : "";
		return `${actorName} adjusted hearts for ${targetName}: ${sign}${d}${ev.payload?.reason ? ` — ${ev.payload.reason}` : ""}`;
	}
	if (ev.type === "PUNISHMENT_SPUN") {
		return `Wheel spun: "${String(ev.payload?.text ?? "").trim()}"`;
	}

	return actorName === "System" ? String(ev.type || "SYSTEM") : `${actorName}: ${String(ev.type || "SYSTEM")}`;
}

function toActivityTimelineText(activity: any): string {
	const caption = String(activity.caption || "").trim();
	if (caption) return caption;
	const typeLabel = titleCase(String(activity.type || "workout"));
	const actorName = activity.player_name || activity.player_snapshot?.name || "Athlete";
	return `${actorName} logged a ${typeLabel} workout`;
}

export async function loadLobbyTimelineData({
	supabase,
	lobbyId,
	limit,
	memberPlayerId,
	commentVisibility = ["feed", "history", "both"],
}: LoadLobbyTimelineArgs): Promise<TimelineData> {
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
		supabase
			.from("comments")
			.select("id,type,rendered,created_at,primary_player_id,player:primary_player_id(id,name,avatar_url,user_id)")
			.eq("lobby_id", lobbyId)
			.in("visibility", commentVisibility as any)
			.order("created_at", { ascending: false })
			.limit(limit),
		supabase
			.from("player")
			.select("id,name,avatar_url,user_id,hearts,lives_remaining")
			.eq("lobby_id", lobbyId),
		supabase
			.from("lobby")
			.select("id,name,owner_id,owner_user_id,cash_pool")
			.eq("id", lobbyId)
			.maybeSingle(),
	]);

	const activityIds = (activities ?? []).map((a: any) => a.id);
	let voteRows: VoteRow[] = [];
	if (activityIds.length) {
		const { data: rows } = await supabase
			.from("activity_votes")
			.select("activity_id,choice,voter_player_id")
			.in("activity_id", activityIds);
		voteRows = (rows ?? []) as VoteRow[];
	}

	const votesByAct: Record<string, { legit: number; sus: number; mine?: "legit" | "sus" }> = {};
	for (const vote of voteRows) {
		if (!votesByAct[vote.activity_id]) votesByAct[vote.activity_id] = { legit: 0, sus: 0 };
		if (vote.choice === "legit") votesByAct[vote.activity_id].legit += 1;
		if (vote.choice === "sus") votesByAct[vote.activity_id].sus += 1;
		if (memberPlayerId && vote.voter_player_id === memberPlayerId) {
			votesByAct[vote.activity_id].mine = vote.choice;
		}
	}

	const playerRows = (players ?? []) as any[];
	const playerMap = new Map<string, any>();
	for (const player of playerRows) {
		if (player?.id) playerMap.set(player.id, player);
	}

	const normalizedActivities = (activities ?? []).map((activity: any) => {
		const playerId = activity.player_id ?? activity.playerId ?? "";
		const createdAtRaw = activity.created_at ?? activity.createdAt ?? activity.date;
		const createdDate = createdAtRaw ? new Date(createdAtRaw) : new Date();
		const createdAt = Number.isNaN(createdDate.getTime()) ? new Date().toISOString() : createdDate.toISOString();
		const durationRaw = Number(activity.duration_minutes ?? activity.duration ?? activity.minutes ?? 0);
		const distanceRaw = activity.distance_km ?? activity.distance ?? null;
		const distanceVal = distanceRaw == null ? undefined : Number(distanceRaw);
		const joinedPlayer = normalizePlayer(activity.player);
		const mappedPlayer = playerId ? normalizePlayer(playerMap.get(playerId)) : null;
		const player = mappedPlayer ?? joinedPlayer;

		return {
			...activity,
			player_id: playerId,
			player,
			player_snapshot: player,
			player_name: player?.name ?? activity.player_name ?? null,
			player_avatar_url: player?.avatar_url ?? activity.player_avatar_url ?? null,
			player_user_id: player?.user_id ?? activity.player_user_id ?? null,
			createdAt,
			duration: Number.isNaN(durationRaw) ? 0 : durationRaw,
			distance: distanceVal !== undefined && !Number.isNaN(distanceVal) ? distanceVal : undefined,
			imageUrl: activity.photo_url ?? activity.image_url ?? activity.imageUrl ?? undefined,
			notes: activity.notes ?? undefined,
			caption: activity.caption ?? undefined,
			source: activity.source ?? "manual",
		};
	});

	const normalizedEvents = (events ?? []).map((event: any) => {
		const actorId = event.actor_player_id ?? event.actorPlayerId ?? null;
		const targetId = event.target_player_id ?? event.targetPlayerId ?? null;
		const actorJoined = normalizePlayer(event.actor);
		const targetJoined = normalizePlayer(event.target);
		const actor = actorId ? normalizePlayer(playerMap.get(actorId)) ?? actorJoined : actorJoined;
		const target = targetId ? normalizePlayer(playerMap.get(targetId)) ?? targetJoined : targetJoined;
		return {
			...event,
			actor_player_id: actorId,
			target_player_id: targetId,
			actor_snapshot: actor,
			target_snapshot: target,
			actor_name: actor?.name ?? event.actor_name ?? null,
			target_name: target?.name ?? event.target_name ?? null,
		};
	});

	const normalizedComments = (comments ?? []).map((comment: any) => {
		const player = normalizePlayer(comment.player) ?? normalizePlayer(playerMap.get(comment.primary_player_id));
		return {
			...comment,
			player_snapshot: player,
		};
	});

	const timeline: TimelineItem[] = [
		...normalizedActivities.map((activity: any) => ({
			id: `activity-${activity.id}`,
			source: "activity" as const,
			createdAt: activity.createdAt ?? activity.created_at ?? activity.date ?? new Date().toISOString(),
			text: toActivityTimelineText(activity),
			player: activity.player_snapshot ?? null,
		})),
		...normalizedEvents.map((event: any) => ({
			id: `event-${event.id}`,
			source: "event" as const,
			createdAt: event.created_at ?? new Date().toISOString(),
			text: renderEventLine(event, event.actor_snapshot ?? null, event.target_snapshot ?? null),
			player: event.actor_snapshot ?? null,
		})),
		...normalizedComments.map((comment: any) => ({
			id: `comment-${comment.id}`,
			source: "comment" as const,
			createdAt: comment.created_at ?? new Date().toISOString(),
			text: String(comment.rendered || "Comment"),
			player: comment.player_snapshot ?? null,
		})),
	]
		.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
		.slice(0, limit);

	return {
		activities: normalizedActivities,
		events: normalizedEvents,
		comments: normalizedComments,
		players: playerRows.map((player: any) => ({
			id: player.id,
			name: player.name ?? null,
			avatar_url: player.avatar_url ?? null,
			user_id: player.user_id ?? null,
		})),
		lobby: lobby ?? null,
		ownerPlayerId: lobby?.owner_id ?? null,
		ownerUserId: lobby?.owner_user_id ?? null,
		lobbyName: lobby?.name ?? null,
		votes: votesByAct,
		myPlayerId: memberPlayerId,
		timeline,
	};
}
