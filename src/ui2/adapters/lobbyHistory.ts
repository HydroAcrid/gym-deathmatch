export type PlayerLite = {
	id: string;
	name: string;
	avatar_url?: string | null;
	user_id?: string | null;
};

export type ActivityRow = {
	id: string;
	lobby_id: string;
	player_id: string;
	player_snapshot?: PlayerLite | null;
	player_name?: string | null;
	player_avatar_url?: string | null;
	player_user_id?: string | null;
	date: string;
	type: string;
	duration_minutes: number | null;
	distance_km: number | null;
	caption: string | null;
	notes?: string | null;
	photo_url: string | null;
	status: string;
	vote_deadline: string | null;
	decided_at: string | null;
	created_at?: string | null;
};

export type EventRow = {
	id: string;
	lobby_id: string;
	origin?: "history" | "comment";
	actor_player_id: string | null;
	target_player_id: string | null;
	actor_snapshot?: PlayerLite | null;
	target_snapshot?: PlayerLite | null;
	actor_name?: string | null;
	target_name?: string | null;
	type: string;
	payload: Record<string, unknown> | null;
	created_at: string;
};

export type CommentRow = {
	id: string;
	type: string;
	rendered: string;
	created_at: string;
	primary_player_id?: string | null;
};

export type VoteSummary = { legit: number; sus: number; mine?: "legit" | "sus" };

export type NormalizedHistoryResponse = {
	activities: ActivityRow[];
	players: PlayerLite[];
	historyEvents: EventRow[];
	lobbyName: string;
	ownerUserId: string | null;
	currentPot: number | null;
	ownerPlayerId: string | null;
	myPlayerId: string | null;
	votesByAct: Record<string, VoteSummary>;
};

function normalizePlayers(rows: unknown[]): PlayerLite[] {
	return rows
		.map((row) => {
			const p = (row ?? {}) as Record<string, unknown>;
			return {
				id: String(p.id ?? ""),
				name: String(p.name ?? "Athlete"),
				avatar_url: p.avatar_url ? String(p.avatar_url) : p.avatarUrl ? String(p.avatarUrl) : null,
				user_id: p.user_id ? String(p.user_id) : p.userId ? String(p.userId) : null,
			};
		})
		.filter((p) => p.id.length > 0);
}

function normalizeActivities(rows: unknown[]): ActivityRow[] {
	return rows.map((row) => {
		const a = (row ?? {}) as Record<string, unknown>;
		const playerSnapshotRaw = (a.player_snapshot ?? a.playerSnapshot ?? null) as Record<string, unknown> | null;
		const playerSnapshot: PlayerLite | null = playerSnapshotRaw
			? {
					id: String(playerSnapshotRaw.id ?? ""),
					name: String(playerSnapshotRaw.name ?? "Athlete"),
					avatar_url: playerSnapshotRaw.avatar_url
						? String(playerSnapshotRaw.avatar_url)
						: playerSnapshotRaw.avatarUrl
							? String(playerSnapshotRaw.avatarUrl)
							: null,
					user_id: playerSnapshotRaw.user_id
						? String(playerSnapshotRaw.user_id)
						: playerSnapshotRaw.userId
							? String(playerSnapshotRaw.userId)
							: null,
				}
			: null;
		return {
			...(a as unknown as ActivityRow),
			id: String(a.id ?? ""),
			lobby_id: String(a.lobby_id ?? a.lobbyId ?? ""),
			player_id: String(a.player_id ?? a.playerId ?? ""),
			player_snapshot: playerSnapshot,
			player_name: a.player_name ? String(a.player_name) : a.playerName ? String(a.playerName) : playerSnapshot?.name ?? null,
			player_avatar_url: a.player_avatar_url
				? String(a.player_avatar_url)
				: a.playerAvatarUrl
					? String(a.playerAvatarUrl)
					: playerSnapshot?.avatar_url ?? null,
			player_user_id: a.player_user_id
				? String(a.player_user_id)
				: a.playerUserId
					? String(a.playerUserId)
					: playerSnapshot?.user_id ?? null,
			date: String(a.date ?? a.createdAt ?? a.created_at ?? ""),
			type: String(a.type ?? "other"),
			duration_minutes:
				typeof a.duration_minutes === "number"
					? a.duration_minutes
					: typeof a.duration === "number"
						? a.duration
						: null,
			distance_km:
				typeof a.distance_km === "number"
					? a.distance_km
					: typeof a.distance === "number"
						? a.distance
						: null,
			caption: a.caption ? String(a.caption) : null,
			notes: a.notes ? String(a.notes) : null,
			photo_url: a.photo_url ? String(a.photo_url) : a.imageUrl ? String(a.imageUrl) : null,
			status: String(a.status ?? "pending"),
			vote_deadline: a.vote_deadline ? String(a.vote_deadline) : a.voteDeadline ? String(a.voteDeadline) : null,
			decided_at: a.decided_at ? String(a.decided_at) : a.decidedAt ? String(a.decidedAt) : null,
			created_at: a.created_at ? String(a.created_at) : null,
		};
	});
}

function normalizeHistoryEvents(rows: unknown[]): EventRow[] {
	return rows
		.map((row) => {
			const ev = (row ?? {}) as Record<string, unknown>;
			const actorSnapshotRaw = (ev.actor_snapshot ?? ev.actorSnapshot ?? null) as Record<string, unknown> | null;
			const targetSnapshotRaw = (ev.target_snapshot ?? ev.targetSnapshot ?? null) as Record<string, unknown> | null;
			const actorSnapshot = actorSnapshotRaw
				? {
						id: String(actorSnapshotRaw.id ?? ""),
						name: String(actorSnapshotRaw.name ?? "Athlete"),
						avatar_url: actorSnapshotRaw.avatar_url
							? String(actorSnapshotRaw.avatar_url)
							: actorSnapshotRaw.avatarUrl
								? String(actorSnapshotRaw.avatarUrl)
								: null,
						user_id: actorSnapshotRaw.user_id
							? String(actorSnapshotRaw.user_id)
							: actorSnapshotRaw.userId
								? String(actorSnapshotRaw.userId)
								: null,
					}
				: null;
			const targetSnapshot = targetSnapshotRaw
				? {
						id: String(targetSnapshotRaw.id ?? ""),
						name: String(targetSnapshotRaw.name ?? "Athlete"),
						avatar_url: targetSnapshotRaw.avatar_url
							? String(targetSnapshotRaw.avatar_url)
							: targetSnapshotRaw.avatarUrl
								? String(targetSnapshotRaw.avatarUrl)
								: null,
						user_id: targetSnapshotRaw.user_id
							? String(targetSnapshotRaw.user_id)
							: targetSnapshotRaw.userId
								? String(targetSnapshotRaw.userId)
								: null,
					}
				: null;
			const payload = ev.payload && typeof ev.payload === "object" ? (ev.payload as Record<string, unknown>) : null;
			return {
				id: String(ev.id ?? ""),
				lobby_id: String(ev.lobby_id ?? ""),
				origin: "history" as const,
				actor_player_id: ev.actor_player_id ? String(ev.actor_player_id) : null,
				target_player_id: ev.target_player_id ? String(ev.target_player_id) : null,
				actor_snapshot: actorSnapshot,
				target_snapshot: targetSnapshot,
				actor_name: ev.actor_name ? String(ev.actor_name) : actorSnapshot?.name ?? null,
				target_name: ev.target_name ? String(ev.target_name) : targetSnapshot?.name ?? null,
				type: String(ev.type ?? "UNKNOWN"),
				payload,
				created_at: String(ev.created_at ?? new Date().toISOString()),
			};
		})
		.filter((ev) => ev.id.length > 0);
}

function mergeKnownPlayers(input: {
	players: PlayerLite[];
	activities: ActivityRow[];
	events: EventRow[];
}): PlayerLite[] {
	const merged = [...input.players];
	const addIfMissing = (snap: PlayerLite | null | undefined) => {
		if (!snap?.id) return;
		if (!merged.some((p) => p.id === snap.id)) merged.push(snap);
	};
	for (const activity of input.activities) addIfMissing(activity.player_snapshot);
	for (const event of input.events) {
		addIfMissing(event.actor_snapshot);
		addIfMissing(event.target_snapshot);
	}
	return merged;
}

function buildCommentEvents(input: {
	comments: CommentRow[];
	lobbyId: string;
	players: PlayerLite[];
}): EventRow[] {
	return input.comments.map((comment) => ({
		id: comment.id,
		lobby_id: input.lobbyId,
		origin: "comment",
		actor_player_id: comment.primary_player_id || null,
		actor_name: comment.primary_player_id
			? input.players.find((p) => p.id === comment.primary_player_id)?.name ?? null
			: null,
		target_player_id: null,
		type: "COMMENT",
		payload: { rendered: comment.rendered, commentType: comment.type },
		created_at: comment.created_at,
	}));
}

function normalizeVotes(input: unknown): Record<string, VoteSummary> {
	if (!input || typeof input !== "object") return {};
	const out: Record<string, VoteSummary> = {};
	for (const [activityId, row] of Object.entries(input as Record<string, unknown>)) {
		const v = (row ?? {}) as Record<string, unknown>;
		out[activityId] = {
			legit: Number(v.legit ?? 0),
			sus: Number(v.sus ?? 0),
			mine: v.mine === "legit" || v.mine === "sus" ? v.mine : undefined,
		};
	}
	return out;
}

export function normalizeLobbyHistoryResponse(input: {
	lobbyId: string;
	userId: string | null | undefined;
	raw: unknown;
}): NormalizedHistoryResponse {
	const data = (input.raw ?? {}) as Record<string, unknown>;
	const activities = normalizeActivities(Array.isArray(data.activities) ? data.activities : []);
	const players = normalizePlayers(Array.isArray(data.players) ? data.players : []);
	const historyOnlyEvents = normalizeHistoryEvents(Array.isArray(data.events) ? data.events : []);
	const mergedPlayers = mergeKnownPlayers({
		players,
		activities,
		events: historyOnlyEvents,
	});
	const comments: CommentRow[] = (Array.isArray(data.comments) ? data.comments : []).map((row) => ({
		id: String((row as Record<string, unknown>)?.id ?? ""),
		type: String((row as Record<string, unknown>)?.type ?? "SUMMARY"),
		rendered: String((row as Record<string, unknown>)?.rendered ?? ""),
		created_at: String((row as Record<string, unknown>)?.created_at ?? new Date().toISOString()),
		primary_player_id: (row as Record<string, unknown>)?.primary_player_id
			? String((row as Record<string, unknown>)?.primary_player_id)
			: null,
	}));
	const commentEvents = buildCommentEvents({
		comments,
		lobbyId: input.lobbyId,
		players: mergedPlayers,
	});
	const historyEvents = [...historyOnlyEvents, ...commentEvents].sort(
		(a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
	);

	const lobbyRow = (data.lobby ?? {}) as Record<string, unknown>;
	const ownerPlayerIdRaw = data.ownerPlayerId ? String(data.ownerPlayerId) : null;
	const ownerUserIdRaw =
		lobbyRow.owner_user_id
			? String(lobbyRow.owner_user_id)
			: lobbyRow.ownerUserId
				? String(lobbyRow.ownerUserId)
				: data.ownerUserId
					? String(data.ownerUserId)
					: null;
	const ownerPlayerIdFallback =
		ownerUserIdRaw && input.userId && ownerUserIdRaw === input.userId
			? mergedPlayers.find((p) => p.user_id === input.userId)?.id ?? null
			: null;
	const myPlayerIdRaw =
		data.myPlayerId && typeof data.myPlayerId === "string"
			? data.myPlayerId
			: mergedPlayers.find((p) => p.user_id === input.userId)?.id ?? null;

	return {
		activities,
		players: mergedPlayers,
		historyEvents,
		lobbyName: String(lobbyRow.name ?? input.lobbyId),
		ownerUserId: ownerUserIdRaw,
		currentPot: typeof lobbyRow.cash_pool === "number" ? lobbyRow.cash_pool : null,
		ownerPlayerId: ownerPlayerIdRaw ?? ownerPlayerIdFallback,
		myPlayerId: myPlayerIdRaw,
		votesByAct: normalizeVotes(data.votes),
	};
}

export function playerForActivity(
	activity: ActivityRow,
	players: PlayerLite[]
): PlayerLite | null {
	if (!activity.player_id) return activity.player_snapshot ?? null;
	const existing = players.find((p) => p.id === activity.player_id);
	if (existing) return existing;
	if (activity.player_snapshot) return activity.player_snapshot;
	return {
		id: activity.player_id,
		name: activity.player_name ?? "Unknown athlete",
		avatar_url: activity.player_avatar_url ?? null,
		user_id: activity.player_user_id ?? undefined,
	};
}

export function canVoteActivity(input: {
	activity: ActivityRow;
	myPlayerId: string | null;
	playerCount: number;
	nowMs?: number;
}): boolean {
	const { activity, myPlayerId, playerCount } = input;
	const nowMs = input.nowMs ?? Date.now();
	if (activity.decided_at) return false;
	if (playerCount <= 2) return false;
	if (!myPlayerId || activity.player_id === myPlayerId) return false;
	if (activity.status === "pending") {
		if (activity.vote_deadline && new Date(activity.vote_deadline).getTime() < nowMs) return false;
		return true;
	}
	return activity.status === "approved" && !activity.decided_at;
}

export function timeLeftLabel(voteDeadline: string | null, nowMs?: number): string {
	if (!voteDeadline) return "";
	const ms = new Date(voteDeadline).getTime() - (nowMs ?? Date.now());
	if (ms <= 0) return "0h";
	const h = Math.floor(ms / 3600000);
	const m = Math.floor((ms % 3600000) / 60000);
	return `${h}h ${m}m`;
}

export function getInitials(name?: string | null): string {
	if (!name) return "AA";
	const parts = name.trim().split(/\s+/).filter(Boolean);
	if (parts.length === 0) return "AA";
	if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
	return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function titleCase(s: string): string {
	return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export function renderEventLine(ev: EventRow, players: PlayerLite[]): string {
	const actor = ev.actor_player_id
		? players.find((p) => p.id === ev.actor_player_id)?.name || ev.actor_snapshot?.name || ev.actor_name || "Unknown athlete"
		: ev.actor_snapshot?.name || ev.actor_name || "System";
	const target = ev.target_player_id
		? players.find((p) => p.id === ev.target_player_id)?.name || ev.target_snapshot?.name || ev.target_name || "Unknown athlete"
		: ev.target_snapshot?.name || ev.target_name || "";

	if (ev.type === "ACTIVITY_LOGGED") return `${actor} posted a workout`;
	if (ev.type === "VOTE_RESULT") {
		const result = String(ev.payload?.result ?? "decision");
		const legit = Number(ev.payload?.legit ?? 0);
		const sus = Number(ev.payload?.sus ?? 0);
		return `Vote result: ${result.replace(/_/g, " ")} (${legit} legit · ${sus} sus)`;
	}
	if (ev.type === "WEEKLY_TARGET_MET") {
		const wk = ev.payload?.weeklyTarget ?? "target";
		const cnt = ev.payload?.workouts ?? "?";
		const name = ev.target_name || players.find((p) => p.id === ev.target_player_id)?.name || "Athlete";
		return `${name} met weekly target: ${cnt}/${wk}`;
	}
	if (ev.type === "WEEKLY_TARGET_MISSED") {
		const wk = ev.payload?.weeklyTarget ?? "target";
		const cnt = ev.payload?.workouts ?? "?";
		const name = ev.target_name || players.find((p) => p.id === ev.target_player_id)?.name || "Athlete";
		return `${name} missed weekly target: ${cnt}/${wk}`;
	}
	if (ev.type === "OWNER_OVERRIDE_ACTIVITY") {
		return `${actor} set an activity to ${String(ev.payload?.newStatus || "").toUpperCase()}${target ? ` for ${target}` : ""}`;
	}
	if (ev.type === "OWNER_ADJUST_HEARTS") {
		const d = Number(ev.payload?.delta || 0);
		const sign = d > 0 ? "+" : "";
		return `${actor} adjusted hearts for ${target}: ${sign}${d}${ev.payload?.reason ? ` — ${ev.payload.reason}` : ""}`;
	}
	if (ev.type === "COMMENT") {
		return String(ev.payload?.rendered ?? "Comment");
	}
	return `${actor || "System"}: ${ev.type}`;
}
