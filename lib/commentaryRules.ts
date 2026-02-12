import type { CommentaryEventRecord, CommentaryEventType, CommentaryEventPayloadByType } from "@/lib/commentaryEvents";

export type CommentaryChannel = "feed" | "history" | "push";
export type CommentVisibility = "feed" | "history" | "both";
export type QuipType = "ACTIVITY" | "VOTE" | "HEARTS" | "POT" | "KO" | "SUMMARY";

export type CommentaryDispatchOutput = {
	ruleId: string;
	eventType: CommentaryEventType;
	channel: CommentaryChannel;
	score: number;
	dedupeKey: string;
	budgetKey: string;
	budgetType: "feed_per_lobby_per_minute" | "feed_per_workout" | "daily_push_per_user_per_day" | "none";
	meta: Record<string, unknown>;
	comment?: {
		lobbyId: string;
		type: QuipType;
		rendered: string;
		payload: Record<string, unknown>;
		visibility: CommentVisibility;
		primaryPlayerId?: string;
		secondaryPlayerId?: string;
		activityId?: string;
	};
	push?: {
		mode: "user" | "lobby";
		userId?: string;
		lobbyId?: string;
		excludeUserId?: string;
		title: string;
		body: string;
		url?: string;
	};
};

export type CommentaryRuleContext = {
	playerNamesById: Map<string, string>;
	playerUserIdsById: Map<string, string | null>;
};

function displayName(ctx: CommentaryRuleContext, id: string, fallback = "Athlete"): string {
	return ctx.playerNamesById.get(id) || fallback;
}

function summarizeNames(names: string[], maxNames = 3): string {
	if (names.length <= maxNames) return names.join(" • ");
	return `${names.slice(0, maxNames).join(" • ")} +${names.length - maxNames}`;
}

function activityRule(event: CommentaryEventRecord<"ACTIVITY_LOGGED">, ctx: CommentaryRuleContext): CommentaryDispatchOutput[] {
	const payload = event.payload as CommentaryEventPayloadByType["ACTIVITY_LOGGED"];
	const athleteName = displayName(ctx, payload.playerId);
	const duration = payload.durationMinutes ? `${payload.durationMinutes}m` : "a session";
	const type = String(payload.type || "workout").toLowerCase();
	const note = (payload.notes || "").trim();
	const feedLine = note
		? `${athleteName} logged ${duration} ${type} — "${note.slice(0, 120)}"`
		: `${athleteName} logged ${duration} ${type}.`;
	const actorUserId = ctx.playerUserIdsById.get(payload.playerId) || undefined;

	return [
		{
			ruleId: "activity_feed_highlight",
			eventType: "ACTIVITY_LOGGED",
			channel: "feed",
			score: 80,
			dedupeKey: `activity-feed:${payload.activityId}`,
			budgetKey: `activity:${payload.activityId}`,
			budgetType: "feed_per_workout",
			meta: { lobbyId: event.lobbyId, activityId: payload.activityId, playerId: payload.playerId },
			comment: {
				lobbyId: event.lobbyId,
				type: "SUMMARY",
				rendered: feedLine,
				payload: {
					activityHighlight: true,
					activityId: payload.activityId,
					playerId: payload.playerId,
					type: payload.type,
				},
				visibility: "feed",
				primaryPlayerId: payload.playerId,
				activityId: payload.activityId,
			},
		},
		{
			ruleId: "activity_lobby_push",
			eventType: "ACTIVITY_LOGGED",
			channel: "push",
			score: 70,
			dedupeKey: `activity-push:${payload.activityId}`,
			budgetKey: `activity-push:${payload.activityId}`,
			budgetType: "none",
			meta: { lobbyId: event.lobbyId, activityId: payload.activityId, playerId: payload.playerId },
			push: {
				mode: "lobby",
				lobbyId: event.lobbyId,
				excludeUserId: actorUserId,
				title: `${athleteName} just logged a workout`,
				body: "Tap to see what they did.",
				url: `/lobby/${event.lobbyId}/history`,
			},
		},
	];
}

function dailyReminderRule(event: CommentaryEventRecord<"DAILY_REMINDER_DUE">, ctx: CommentaryRuleContext): CommentaryDispatchOutput[] {
	const payload = event.payload as CommentaryEventPayloadByType["DAILY_REMINDER_DUE"];
	const name = payload.playerName || displayName(ctx, payload.playerId);
	const userId = ctx.playerUserIdsById.get(payload.playerId) || undefined;
	if (!userId) return [];
	return [
		{
			ruleId: "daily_reminder_push",
			eventType: "DAILY_REMINDER_DUE",
			channel: "push",
			score: 100,
			dedupeKey: `daily-reminder:${payload.playerId}:${payload.dayKey}`,
			budgetKey: `${payload.playerId}:${payload.dayKey}`,
			budgetType: "daily_push_per_user_per_day",
			meta: { lobbyId: event.lobbyId, playerId: payload.playerId, dayKey: payload.dayKey, kind: "daily_reminder" },
			push: {
				mode: "user",
				userId,
				title: "Move check-in",
				body: `${name}, no workout logged yet today. Tap to post.`,
				url: `/lobby/${event.lobbyId}/history`,
			},
		},
	];
}

function voteResolvedRule(event: CommentaryEventRecord<"VOTE_RESOLVED">, ctx: CommentaryRuleContext): CommentaryDispatchOutput[] {
	const payload = event.payload as CommentaryEventPayloadByType["VOTE_RESOLVED"];
	const athleteName = displayName(ctx, payload.playerId);
	const rendered =
		payload.result === "approved"
			? `Verdict: legit. ${athleteName}'s workout stands.`
			: `Verdict: SUS. ${athleteName}'s post doesn't count.`;
	return [
		{
			ruleId: "vote_resolved_both",
			eventType: "VOTE_RESOLVED",
			channel: "history",
			score: 105,
			dedupeKey: `vote-result:${payload.activityId}:${payload.result}`,
			budgetKey: "none",
			budgetType: "none",
			meta: { lobbyId: event.lobbyId, activityId: payload.activityId, result: payload.result },
			comment: {
				lobbyId: event.lobbyId,
				type: "VOTE",
				rendered,
				payload: {
					activityId: payload.activityId,
					result: payload.result,
					reason: payload.reason ?? null,
					legit: payload.legit ?? null,
					sus: payload.sus ?? null,
				},
				visibility: "both",
				primaryPlayerId: payload.playerId,
				activityId: payload.activityId,
			},
		},
	];
}

function potChangedRule(event: CommentaryEventRecord<"POT_CHANGED">): CommentaryDispatchOutput[] {
	const payload = event.payload as CommentaryEventPayloadByType["POT_CHANGED"];
	const renderedBase = `Ante collected. Pot climbs to $${payload.pot}`;
	return [
		{
			ruleId: "pot_feed_update",
			eventType: "POT_CHANGED",
			channel: "feed",
			score: 70,
			dedupeKey: `pot-feed:${payload.pot}:${payload.delta}`,
			budgetKey: `pot:${payload.pot}`,
			budgetType: "feed_per_lobby_per_minute",
			meta: { lobbyId: event.lobbyId, pot: payload.pot, delta: payload.delta },
			comment: {
				lobbyId: event.lobbyId,
				type: "POT",
				rendered: `${renderedBase} 🧾`,
				payload: { delta: payload.delta, pot: payload.pot },
				visibility: "feed",
			},
		},
		{
			ruleId: "pot_push_lobby",
			eventType: "POT_CHANGED",
			channel: "push",
			score: 60,
			dedupeKey: `pot-push:${payload.pot}:${payload.delta}`,
			budgetKey: "none",
			budgetType: "none",
			meta: { lobbyId: event.lobbyId, pot: payload.pot, delta: payload.delta },
			push: {
				mode: "lobby",
				lobbyId: event.lobbyId,
				title: "Pot climbed",
				body: `${renderedBase}. Stakes rising.`,
				url: `/lobby/${event.lobbyId}/history`,
			},
		},
	];
}

function spinResolvedRule(event: CommentaryEventRecord<"SPIN_RESOLVED">): CommentaryDispatchOutput[] {
	const payload = event.payload as CommentaryEventPayloadByType["SPIN_RESOLVED"];
	return [
		{
			ruleId: "spin_resolved_feed",
			eventType: "SPIN_RESOLVED",
			channel: "feed",
			score: 95,
			dedupeKey: `spin-resolved:${payload.spinId}`,
			budgetKey: "none",
			budgetType: "none",
			meta: { lobbyId: event.lobbyId, spinId: payload.spinId, week: payload.week, auto: !!payload.auto },
			comment: {
				lobbyId: event.lobbyId,
				type: "SUMMARY",
				rendered: `Wheel spun. Punishment: “${payload.text}”`,
				payload: {
					type: "SPIN_RESOLVED",
					week: payload.week,
					spinId: payload.spinId,
					startedAt: payload.startedAt,
					winnerItemId: payload.winnerItemId,
					auto: !!payload.auto,
				},
				visibility: "feed",
			},
		},
	];
}

function readyChangedRule(event: CommentaryEventRecord<"READY_CHANGED">, ctx: CommentaryRuleContext): CommentaryDispatchOutput[] {
	const payload = event.payload as CommentaryEventPayloadByType["READY_CHANGED"];
	const name = displayName(ctx, payload.playerId);
	const rendered = payload.ready ? `${name} fears no punishment. Ready.` : `${name} is not ready yet.`;
	return [
		{
			ruleId: "ready_changed_feed",
			eventType: "READY_CHANGED",
			channel: "feed",
			score: 45,
			dedupeKey: `ready:${payload.playerId}:${payload.ready ? "1" : "0"}`,
			budgetKey: `${event.lobbyId}:ready:${payload.playerId}`,
			budgetType: "feed_per_lobby_per_minute",
			meta: { lobbyId: event.lobbyId, playerId: payload.playerId, ready: payload.ready },
			comment: {
				lobbyId: event.lobbyId,
				type: "SUMMARY",
				rendered,
				payload: { type: "READY_CHANGED", ready: payload.ready },
				visibility: "feed",
				primaryPlayerId: payload.playerId,
			},
		},
	];
}

function allReadyRule(event: CommentaryEventRecord<"ALL_READY">): CommentaryDispatchOutput[] {
	const payload = event.payload as CommentaryEventPayloadByType["ALL_READY"];
	return [
		{
			ruleId: "all_ready_feed",
			eventType: "ALL_READY",
			channel: "feed",
			score: 80,
			dedupeKey: `all-ready:${payload.readyPlayerIds.slice().sort().join(",")}`,
			budgetKey: "none",
			budgetType: "none",
			meta: { lobbyId: event.lobbyId, readyCount: payload.readyPlayerIds.length },
			comment: {
				lobbyId: event.lobbyId,
				type: "SUMMARY",
				rendered: "All athletes ready. Bell rings soon.",
				payload: { type: "ALL_READY", readyPlayerIds: payload.readyPlayerIds },
				visibility: "feed",
			},
		},
	];
}

function punishmentResolvedRule(event: CommentaryEventRecord<"PUNISHMENT_RESOLVED">, ctx: CommentaryRuleContext): CommentaryDispatchOutput[] {
	const payload = event.payload as CommentaryEventPayloadByType["PUNISHMENT_RESOLVED"];
	if (!payload.playerId) return [];
	const name = displayName(ctx, payload.playerId);
	return [
		{
			ruleId: "punishment_resolved_feed",
			eventType: "PUNISHMENT_RESOLVED",
			channel: "feed",
			score: 65,
			dedupeKey: `punishment-resolved:${payload.punishmentId}`,
			budgetKey: `${event.lobbyId}:punishment:${payload.punishmentId}`,
			budgetType: "none",
			meta: {
				lobbyId: event.lobbyId,
				punishmentId: payload.punishmentId,
				playerId: payload.playerId,
				userId: payload.userId ?? null,
			},
			comment: {
				lobbyId: event.lobbyId,
				type: "SUMMARY",
				rendered: `${name} cleared a punishment.`,
				payload: {
					type: "PUNISHMENT_RESOLVED",
					punishmentId: payload.punishmentId,
					userId: payload.userId ?? null,
				},
				visibility: "feed",
				primaryPlayerId: payload.playerId,
			},
		},
	];
}

function weeklyMissedRule(event: CommentaryEventRecord<"WEEKLY_MISSED_TARGET_GROUP">): CommentaryDispatchOutput[] {
	const payload = event.payload as CommentaryEventPayloadByType["WEEKLY_MISSED_TARGET_GROUP"];
	const names = summarizeNames(payload.players.map((p) => p.name || "Athlete"));
	const totalHeartsLost = payload.players.reduce((sum, p) => sum + Math.max(0, Number(p.heartsLost || 0)), 0);
	const rendered = payload.players.length === 1
		? `Arena tax collected: ${names} missed weekly target and lost ${totalHeartsLost} heart.`
		: `Arena tax collected: ${names} missed weekly target and lost ${totalHeartsLost} hearts combined.`;
	return [
		{
			ruleId: "weekly_missed_group",
			eventType: "WEEKLY_MISSED_TARGET_GROUP",
			channel: "history",
			score: 100,
			dedupeKey: `weekly-missed:${payload.weekStart}:${payload.players.map((p) => p.id).sort().join(",")}`,
			budgetKey: "none",
			budgetType: "none",
			meta: { lobbyId: event.lobbyId, weekStart: payload.weekStart },
			comment: {
				lobbyId: event.lobbyId,
				type: "HEARTS",
				rendered,
				payload: {
					weeklyMissedTargetGroup: true,
					weekStart: payload.weekStart,
					weeklyTarget: payload.weeklyTarget,
					players: payload.players,
				},
				visibility: "both",
			},
		},
	];
}

function weeklyHitRule(event: CommentaryEventRecord<"WEEKLY_HIT_TARGET_GROUP">): CommentaryDispatchOutput[] {
	const payload = event.payload as CommentaryEventPayloadByType["WEEKLY_HIT_TARGET_GROUP"];
	const names = summarizeNames(payload.players.map((p) => p.name || "Athlete"));
	const totalHeartsGained = payload.players.reduce((sum, p) => sum + Math.max(0, Number(p.heartsGained || 0)), 0);
	const rendered = payload.players.length === 1
		? `Heart restored: ${names} hit weekly target and gained ${totalHeartsGained} heart.`
		: `Heart restored: ${names} hit weekly target and gained ${totalHeartsGained} hearts combined.`;
	return [
		{
			ruleId: "weekly_hit_group",
			eventType: "WEEKLY_HIT_TARGET_GROUP",
			channel: "history",
			score: 95,
			dedupeKey: `weekly-hit:${payload.weekStart}:${payload.players.map((p) => p.id).sort().join(",")}`,
			budgetKey: "none",
			budgetType: "none",
			meta: { lobbyId: event.lobbyId, weekStart: payload.weekStart },
			comment: {
				lobbyId: event.lobbyId,
				type: "HEARTS",
				rendered,
				payload: {
					weeklyHitTargetGroup: true,
					weekStart: payload.weekStart,
					weeklyTarget: payload.weeklyTarget,
					players: payload.players,
				},
				visibility: "both",
			},
		},
	];
}

function weeklyGhostRule(event: CommentaryEventRecord<"WEEKLY_GHOST_GROUP">): CommentaryDispatchOutput[] {
	const payload = event.payload as CommentaryEventPayloadByType["WEEKLY_GHOST_GROUP"];
	const names = summarizeNames(payload.players.map((p) => p.name || "Athlete"));
	const rendered = payload.players.length === 1
		? `Ghost week warning: ${names} is 0/${payload.weeklyTarget} so far.`
		: `Ghost week warning: ${names} are 0/${payload.weeklyTarget} so far.`;
	return [{
		ruleId: "weekly_ghost_group",
		eventType: "WEEKLY_GHOST_GROUP",
		channel: "feed",
		score: 60,
		dedupeKey: `weekly-ghost:${payload.weekStart}:${payload.players.map((p) => p.id).sort().join(",")}`,
		budgetKey: `${event.lobbyId}:${payload.weekStart}:ghost`,
		budgetType: "feed_per_lobby_per_minute",
		meta: { lobbyId: event.lobbyId, weekStart: payload.weekStart },
		comment: {
			lobbyId: event.lobbyId,
			type: "SUMMARY",
			rendered,
			payload: { ghostWeekGroup: payload.weekStart, weeklyTarget: payload.weeklyTarget, players: payload.players.map((p) => p.id) },
			visibility: "feed",
		},
	}];
}

function weeklyHypeRule(event: CommentaryEventRecord<"WEEKLY_HYPE_GROUP">): CommentaryDispatchOutput[] {
	const payload = event.payload as CommentaryEventPayloadByType["WEEKLY_HYPE_GROUP"];
	const names = summarizeNames(payload.players.map((p) => p.name || "Athlete"));
	return [{
		ruleId: "weekly_hype_group",
		eventType: "WEEKLY_HYPE_GROUP",
		channel: "feed",
		score: 55,
		dedupeKey: `weekly-hype:${payload.weekStart}:${payload.players.map((p) => p.id).sort().join(",")}`,
		budgetKey: `${event.lobbyId}:${payload.weekStart}:hype`,
		budgetType: "feed_per_lobby_per_minute",
		meta: { lobbyId: event.lobbyId, weekStart: payload.weekStart },
		comment: {
			lobbyId: event.lobbyId,
			type: "SUMMARY",
			rendered: `Weekly hype: ${names} need 1 more to hit ${payload.weeklyTarget}.`,
			payload: { hype: true, weekStart: payload.weekStart, weeklyTarget: payload.weeklyTarget, players: payload.players.map((p) => p.id) },
			visibility: "feed",
		},
	}];
}

function weeklyPerfectRule(event: CommentaryEventRecord<"WEEKLY_PERFECT_GROUP">): CommentaryDispatchOutput[] {
	const payload = event.payload as CommentaryEventPayloadByType["WEEKLY_PERFECT_GROUP"];
	const names = summarizeNames(payload.players.map((p) => p.name || "Athlete"));
	const rendered = payload.players.length === 1
		? `Perfect week badge: ${names} hit ${payload.weeklyTarget}/${payload.weeklyTarget}.`
		: `Perfect week badges: ${names} hit ${payload.weeklyTarget}/${payload.weeklyTarget}.`;
	return [{
		ruleId: "weekly_perfect_group",
		eventType: "WEEKLY_PERFECT_GROUP",
		channel: "feed",
		score: 50,
		dedupeKey: `weekly-perfect:${payload.weekStart}:${payload.players.map((p) => p.id).sort().join(",")}`,
		budgetKey: `${event.lobbyId}:${payload.weekStart}:perfect`,
		budgetType: "feed_per_lobby_per_minute",
		meta: { lobbyId: event.lobbyId, weekStart: payload.weekStart },
		comment: {
			lobbyId: event.lobbyId,
			type: "SUMMARY",
			rendered,
			payload: { perfectWeekGroup: true, weekStart: payload.weekStart, weeklyTarget: payload.weeklyTarget, players: payload.players.map((p) => p.id) },
			visibility: "feed",
		},
	}];
}

function weeklyResetRule(event: CommentaryEventRecord<"WEEKLY_RESET">): CommentaryDispatchOutput[] {
	const payload = event.payload as CommentaryEventPayloadByType["WEEKLY_RESET"];
	return [{
		ruleId: "weekly_reset",
		eventType: "WEEKLY_RESET",
		channel: "history",
		score: 110,
		dedupeKey: `weekly-reset:${payload.weekStart}`,
		budgetKey: "none",
		budgetType: "none",
		meta: { lobbyId: event.lobbyId, weekStart: payload.weekStart },
		comment: {
			lobbyId: event.lobbyId,
			type: "SUMMARY",
			rendered: "The arena resets. New week begins.",
			payload: { type: "WEEK_RESET", weekStart: payload.weekStart },
			visibility: "both",
		},
	}];
}

function weeklyTightRaceRule(event: CommentaryEventRecord<"WEEKLY_TIGHT_RACE">): CommentaryDispatchOutput[] {
	const payload = event.payload as CommentaryEventPayloadByType["WEEKLY_TIGHT_RACE"];
	const names = summarizeNames(payload.names);
	return [{
		ruleId: "weekly_tight_race",
		eventType: "WEEKLY_TIGHT_RACE",
		channel: "feed",
		score: 65,
		dedupeKey: `weekly-tight-race:${payload.weekStart}:${payload.pot}:${payload.names.slice().sort().join(",")}`,
		budgetKey: `${event.lobbyId}:${payload.weekStart}:tight-race`,
		budgetType: "feed_per_lobby_per_minute",
		meta: { lobbyId: event.lobbyId, weekStart: payload.weekStart },
		comment: {
			lobbyId: event.lobbyId,
			type: "SUMMARY",
			rendered: `Tight race: ${names} tied on hearts with a $${payload.pot} pot.`,
			payload: { tightRace: true, pot: payload.pot, names: payload.names.slice(0, 3) },
			visibility: "feed",
		},
	}];
}

export function buildRuleOutputs(event: CommentaryEventRecord, ctx: CommentaryRuleContext): CommentaryDispatchOutput[] {
	switch (event.type) {
		case "ACTIVITY_LOGGED":
			return activityRule(event as CommentaryEventRecord<"ACTIVITY_LOGGED">, ctx);
		case "DAILY_REMINDER_DUE":
			return dailyReminderRule(event as CommentaryEventRecord<"DAILY_REMINDER_DUE">, ctx);
		case "VOTE_RESOLVED":
			return voteResolvedRule(event as CommentaryEventRecord<"VOTE_RESOLVED">, ctx);
		case "POT_CHANGED":
			return potChangedRule(event as CommentaryEventRecord<"POT_CHANGED">);
		case "SPIN_RESOLVED":
			return spinResolvedRule(event as CommentaryEventRecord<"SPIN_RESOLVED">);
		case "READY_CHANGED":
			return readyChangedRule(event as CommentaryEventRecord<"READY_CHANGED">, ctx);
		case "ALL_READY":
			return allReadyRule(event as CommentaryEventRecord<"ALL_READY">);
		case "PUNISHMENT_RESOLVED":
			return punishmentResolvedRule(event as CommentaryEventRecord<"PUNISHMENT_RESOLVED">, ctx);
		case "WEEKLY_MISSED_TARGET_GROUP":
			return weeklyMissedRule(event as CommentaryEventRecord<"WEEKLY_MISSED_TARGET_GROUP">);
		case "WEEKLY_HIT_TARGET_GROUP":
			return weeklyHitRule(event as CommentaryEventRecord<"WEEKLY_HIT_TARGET_GROUP">);
		case "WEEKLY_GHOST_GROUP":
			return weeklyGhostRule(event as CommentaryEventRecord<"WEEKLY_GHOST_GROUP">);
		case "WEEKLY_HYPE_GROUP":
			return weeklyHypeRule(event as CommentaryEventRecord<"WEEKLY_HYPE_GROUP">);
		case "WEEKLY_PERFECT_GROUP":
			return weeklyPerfectRule(event as CommentaryEventRecord<"WEEKLY_PERFECT_GROUP">);
		case "WEEKLY_RESET":
			return weeklyResetRule(event as CommentaryEventRecord<"WEEKLY_RESET">);
		case "WEEKLY_TIGHT_RACE":
			return weeklyTightRaceRule(event as CommentaryEventRecord<"WEEKLY_TIGHT_RACE">);
		default:
			return [];
	}
}
