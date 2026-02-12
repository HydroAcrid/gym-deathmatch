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
