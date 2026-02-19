import { getServerSupabase } from "@/lib/supabaseClient";

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

type TimelineActivityRow = {
	id?: string;
	player_id?: string;
	playerId?: string;
	created_at?: string;
	createdAt?: string;
	date?: string;
	duration_minutes?: number | string;
	duration?: number | string;
	minutes?: number | string;
	distance_km?: number | string | null;
	distance?: number | string | null;
	photo_url?: string;
	image_url?: string;
	imageUrl?: string;
	notes?: string;
	caption?: string;
	source?: string;
	type?: string;
	player_name?: string | null;
	player_avatar_url?: string | null;
	player_user_id?: string | null;
	player?: unknown;
	[key: string]: unknown;
};

type TimelineEventRow = {
	id?: string;
	type?: string;
	payload?: Record<string, unknown> | null;
	actor_player_id?: string | null;
	actorPlayerId?: string | null;
	target_player_id?: string | null;
	targetPlayerId?: string | null;
	actor_name?: string | null;
	target_name?: string | null;
	created_at?: string;
	actor?: unknown;
	target?: unknown;
	[key: string]: unknown;
};

type TimelineCommentRow = {
	id?: string;
	type?: string;
	rendered?: string;
	created_at?: string;
	primary_player_id?: string;
	player?: unknown;
	[key: string]: unknown;
};

type LobbyTimelineRow = {
	id?: string;
	name?: string | null;
	owner_id?: string | null;
	owner_user_id?: string | null;
	cash_pool?: number | null;
};

export type TimelineItem = {
	id: string;
	source: TimelineSource;
	createdAt: string;
	text: string;
	player: PlayerLite | null;
};

export type TimelineData = {
	activities: TimelineActivityRow[];
	events: TimelineEventRow[];
	comments: TimelineCommentRow[];
	players: PlayerLite[];
	lobby: LobbyTimelineRow | null;
	ownerPlayerId: string | null;
	ownerUserId: string | null;
	lobbyName: string | null;
	votes: Record<string, { legit: number; sus: number; mine?: "legit" | "sus" }>;
	myPlayerId: string | null;
	timeline: TimelineItem[];
};

type LoadLobbyTimelineArgs = {
	supabase: NonNullable<ReturnType<typeof getServerSupabase>>;
	lobbyId: string;
	limit: number;
	memberPlayerId: string | null;
	commentVisibility?: Array<"feed" | "history" | "both">;
	includeActivities?: boolean;
	includeEvents?: boolean;
	includeComments?: boolean;
};

function normalizePlayer(value: unknown): PlayerLite | null {
	if (!value) return null;
	const row = Array.isArray(value) ? value[0] : value;
	if (!row || typeof row !== "object") return null;
	const record = row as Record<string, unknown>;
	if (typeof record.id !== "string") return null;
	return {
		id: record.id,
		name: typeof record.name === "string" ? record.name : null,
		avatar_url: typeof record.avatar_url === "string" ? record.avatar_url : null,
		user_id: typeof record.user_id === "string" ? record.user_id : null,
	};
}

function titleCase(input: string): string {
	if (!input) return "Workout";
	const lower = input.toLowerCase();
	return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export function renderEventLine(ev: TimelineEventRow, actor: PlayerLite | null, target: PlayerLite | null): string {
	const actorName = actor?.name || "System";
	const targetName = target?.name || "Athlete";
	const payload = ev.payload ?? {};

	if (ev.type === "ACTIVITY_LOGGED") return `${actorName} posted a workout`;
	if (ev.type === "VOTE_RESULT") {
		const result = String(payload.result || "decision").replace(/_/g, " ");
		return `Vote result: ${result} (${payload.legit ?? 0} legit · ${payload.sus ?? 0} sus)`;
	}
	if (ev.type === "WEEKLY_TARGET_MET") {
		const wk = payload.weeklyTarget ?? "target";
		const cnt = payload.workouts ?? "?";
		return `${targetName} met weekly target: ${cnt}/${wk}`;
	}
	if (ev.type === "WEEKLY_TARGET_MISSED") {
		const wk = payload.weeklyTarget ?? "target";
		const cnt = payload.workouts ?? "?";
		return `${targetName} missed weekly target: ${cnt}/${wk}`;
	}
	if (ev.type === "OWNER_OVERRIDE_ACTIVITY") {
		return `${actorName} set an activity to ${String(payload.newStatus || "").toUpperCase()}${target ? ` for ${targetName}` : ""}`;
	}
	if (ev.type === "OWNER_ADJUST_HEARTS") {
		const delta = Number(payload.delta || 0);
		const sign = delta > 0 ? "+" : "";
		return `${actorName} adjusted hearts for ${targetName}: ${sign}${delta}${payload.reason ? ` — ${payload.reason}` : ""}`;
	}
	if (ev.type === "PUNISHMENT_SPUN") {
		return `Wheel spun: "${String(payload.text ?? "").trim()}"`;
	}

	return actorName === "System" ? String(ev.type || "SYSTEM") : `${actorName}: ${String(ev.type || "SYSTEM")}`;
}

function toActivityTimelineText(activity: TimelineActivityRow): string {
	const caption = String(activity.caption || "").trim();
	if (caption) return caption;
	const typeLabel = titleCase(String(activity.type || "workout"));
	const actorName = activity.player_name || (activity.player_snapshot as PlayerLite | undefined)?.name || "Athlete";
	return `${actorName} logged a ${typeLabel} workout`;
}

export async function loadLobbyTimelineData({
	supabase,
	lobbyId,
	limit,
	memberPlayerId,
	commentVisibility = ["feed", "history", "both"],
	includeActivities = true,
	includeEvents = true,
	includeComments = true,
}: LoadLobbyTimelineArgs): Promise<TimelineData> {
	const activitiesPromise = includeActivities
		? supabase
				.from("manual_activities")
				.select("*, player:player_id(id,name,avatar_url,user_id)")
				.eq("lobby_id", lobbyId)
				.order("created_at", { ascending: false })
				.limit(limit)
		: Promise.resolve({ data: [] });
	const eventsPromise = includeEvents
		? supabase
				.from("history_events")
				.select("*, actor:actor_player_id(id,name,avatar_url,user_id), target:target_player_id(id,name,avatar_url,user_id)")
				.eq("lobby_id", lobbyId)
				.order("created_at", { ascending: false })
				.limit(limit)
		: Promise.resolve({ data: [] });
	const commentsPromise = includeComments
		? supabase
				.from("comments")
				.select("id,type,rendered,created_at,primary_player_id,player:primary_player_id(id,name,avatar_url,user_id)")
				.eq("lobby_id", lobbyId)
				.in("visibility", commentVisibility)
				.order("created_at", { ascending: false })
				.limit(limit)
		: Promise.resolve({ data: [] });

	const [{ data: activities }, { data: events }, { data: comments }, { data: players }, { data: lobby }] = await Promise.all([
		activitiesPromise,
		eventsPromise,
		commentsPromise,
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

	const activityRows = (activities ?? []) as TimelineActivityRow[];
	const eventRows = (events ?? []) as TimelineEventRow[];
	const commentRows = (comments ?? []) as TimelineCommentRow[];
	const playerRows = (players ?? []) as Array<Record<string, unknown>>;
	const lobbyRow = (lobby as LobbyTimelineRow | null) ?? null;

	const activityIds = activityRows.map((a) => a.id).filter((id): id is string => typeof id === "string" && id.length > 0);
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

	const playerMap = new Map<string, Record<string, unknown>>();
	for (const player of playerRows) {
		if (typeof player.id === "string") playerMap.set(player.id, player);
	}

	const normalizedActivities = activityRows.map((activity) => {
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

	const normalizedEvents = eventRows.map((event) => {
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

	const normalizedComments = commentRows.map((comment) => {
		const player = normalizePlayer(comment.player) ?? normalizePlayer(playerMap.get(comment.primary_player_id ?? ""));
		return {
			...comment,
			player_snapshot: player,
		};
	});

	const timeline: TimelineItem[] = [
		...normalizedActivities.map((activity) => ({
			id: `activity-${activity.id ?? crypto.randomUUID()}`,
			source: "activity" as const,
			createdAt: activity.createdAt ?? activity.created_at ?? activity.date ?? new Date().toISOString(),
			text: toActivityTimelineText(activity),
			player: (activity.player_snapshot as PlayerLite | null | undefined) ?? null,
		})),
		...normalizedEvents.map((event) => ({
			id: `event-${event.id ?? crypto.randomUUID()}`,
			source: "event" as const,
			createdAt: event.created_at ?? new Date().toISOString(),
			text: renderEventLine(event, (event.actor_snapshot as PlayerLite | null | undefined) ?? null, (event.target_snapshot as PlayerLite | null | undefined) ?? null),
			player: (event.actor_snapshot as PlayerLite | null | undefined) ?? null,
		})),
		...normalizedComments.map((comment) => ({
			id: `comment-${comment.id ?? crypto.randomUUID()}`,
			source: "comment" as const,
			createdAt: comment.created_at ?? new Date().toISOString(),
			text: String(comment.rendered || "Comment"),
			player: (comment.player_snapshot as PlayerLite | null | undefined) ?? null,
		})),
	]
		.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
		.slice(0, limit);

	return {
		activities: normalizedActivities,
		events: normalizedEvents,
		comments: normalizedComments,
		players: playerRows
			.filter((player): player is Record<string, unknown> & { id: string } => typeof player.id === "string")
			.map((player) => ({
				id: player.id,
				name: typeof player.name === "string" ? player.name : null,
				avatar_url: typeof player.avatar_url === "string" ? player.avatar_url : null,
				user_id: typeof player.user_id === "string" ? player.user_id : null,
			})),
		lobby: lobbyRow,
		ownerPlayerId: lobbyRow?.owner_id ?? null,
		ownerUserId: lobbyRow?.owner_user_id ?? null,
		lobbyName: lobbyRow?.name ?? null,
		votes: votesByAct,
		myPlayerId: memberPlayerId,
		timeline,
	};
}
