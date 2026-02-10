import { getServerSupabase } from "./supabaseClient";
import type { Activity } from "@/lib/types";
import { sendPushToLobby, sendPushToUser } from "./push";
import { createHash } from "crypto";

export type QuipType = 'ACTIVITY'|'VOTE'|'HEARTS'|'POT'|'KO'|'SUMMARY';
export type Quip = {
	type: QuipType;
	rendered: string;
	payload: Record<string, any>;
	visibility?: 'feed'|'history'|'both';
	primaryPlayerId?: string;
	secondaryPlayerId?: string;
	activityId?: string;
};

export const copyStyle = { spicy: false };

type EngineContext = {
	now: Date;
	lobbyId: string;
	activity?: Activity;
	event?: any;
};

type IdempotencyClaimResult = "claimed" | "duplicate" | "unavailable";

function stableSerialize(value: unknown): string {
	if (value === null || value === undefined) return "null";
	if (Array.isArray(value)) {
		return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
	}
	if (typeof value === "object") {
		const obj = value as Record<string, unknown>;
		const keys = Object.keys(obj).sort();
		return `{${keys.map((k) => `${JSON.stringify(k)}:${stableSerialize(obj[k])}`).join(",")}}`;
	}
	return JSON.stringify(value);
}

function hashKey(value: string): string {
	return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

function buildIdempotencyKey(opts: {
	dedupeMs: number;
	dedupeScope: Record<string, unknown>;
	primaryPlayerId?: string;
	secondaryPlayerId?: string;
}): string {
	const windowBucket = Math.floor(Date.now() / opts.dedupeMs);
	const serialized = stableSerialize({
		windowBucket,
		primaryPlayerId: opts.primaryPlayerId ?? null,
		secondaryPlayerId: opts.secondaryPlayerId ?? null,
		scope: opts.dedupeScope
	});
	return `${windowBucket}:${hashKey(serialized)}`;
}

async function claimCommentaryEvent(opts: {
	lobbyId: string;
	eventType: QuipType;
	idempotencyKey: string;
	sourceType?: string;
	sourceId?: string;
	metadata?: Record<string, unknown>;
}): Promise<IdempotencyClaimResult> {
	const supabase = getServerSupabase();
	if (!supabase) return "unavailable";
	const { data, error } = await supabase
		.from("commentary_emitted")
		.upsert({
			lobby_id: opts.lobbyId,
			event_type: opts.eventType,
			idempotency_key: opts.idempotencyKey,
			source_type: opts.sourceType ?? null,
			source_id: opts.sourceId ?? null,
			metadata: opts.metadata ?? {}
		}, {
			onConflict: "lobby_id,event_type,idempotency_key",
			ignoreDuplicates: true
		})
		.select("id");
	if (error) {
		if (error.code === "42P01" || String(error.message || "").toLowerCase().includes("commentary_emitted")) {
			return "unavailable";
		}
		throw error;
	}
	return (data && data.length > 0) ? "claimed" : "duplicate";
}

async function releaseCommentaryClaim(opts: {
	lobbyId: string;
	eventType: QuipType;
	idempotencyKey: string;
}) {
	const supabase = getServerSupabase();
	if (!supabase) return;
	await supabase
		.from("commentary_emitted")
		.delete()
		.eq("lobby_id", opts.lobbyId)
		.eq("event_type", opts.eventType)
		.eq("idempotency_key", opts.idempotencyKey);
}

async function insertQuipOnce(opts: {
	lobbyId: string;
	type: QuipType;
	rendered: string;
	payload?: Record<string, any>;
	primaryPlayerId?: string;
	secondaryPlayerId?: string;
	visibility?: 'feed'|'history'|'both';
	dedupeMs?: number;
	dedupeKey?: Record<string, any>;
}): Promise<boolean> {
	const supabase = getServerSupabase();
	if (!supabase) return false;
	const dedupeMs = opts.dedupeMs ?? 6 * 60 * 60 * 1000;
	const dedupeScope = opts.dedupeKey ?? { rendered: opts.rendered };
	const idempotencyKey = buildIdempotencyKey({
		dedupeMs,
		dedupeScope,
		primaryPlayerId: opts.primaryPlayerId,
		secondaryPlayerId: opts.secondaryPlayerId
	});

	const claim = await claimCommentaryEvent({
		lobbyId: opts.lobbyId,
		eventType: opts.type,
		idempotencyKey,
		sourceType: "insertQuipOnce",
		metadata: {
			primaryPlayerId: opts.primaryPlayerId ?? null,
			secondaryPlayerId: opts.secondaryPlayerId ?? null,
			dedupeScope
		}
	});
	if (claim === "duplicate") return false;

	if (claim === "unavailable") {
		const since = new Date(Date.now() - dedupeMs).toISOString();
		let query = supabase
			.from("comments")
			.select("id")
			.eq("lobby_id", opts.lobbyId)
			.eq("type", opts.type)
			.gte("created_at", since)
			.limit(1);
		if (opts.primaryPlayerId) query = query.eq("primary_player_id", opts.primaryPlayerId);
		if (opts.dedupeKey) {
			query = query.contains("payload", opts.dedupeKey as any);
		} else {
			query = query.eq("rendered", opts.rendered);
		}
		const { data: exists } = await query;
		if (exists && exists.length) return false;
	}

	try {
		await insertQuips(opts.lobbyId, [{
			type: opts.type,
			rendered: opts.rendered,
			payload: opts.payload ?? {},
			primaryPlayerId: opts.primaryPlayerId,
			secondaryPlayerId: opts.secondaryPlayerId,
			visibility: opts.visibility ?? "feed"
		}]);
		return true;
	} catch (err) {
		if (claim === "claimed") {
			await releaseCommentaryClaim({
				lobbyId: opts.lobbyId,
				eventType: opts.type,
				idempotencyKey
			});
		}
		throw err;
	}
}

export function generateQuips(ctx: EngineContext): Quip[] {
	const q: Quip[] = [];
	const now = ctx.now ?? new Date();
	// Activity-based
	if (ctx.activity) {
		const a = ctx.activity;
		const mins = a.durationMinutes ?? 0;
		const km = a.distanceKm ?? 0;
		const timeOfDay = now.getHours();
		let td: string | null = null;
		if (timeOfDay >= 5 && timeOfDay < 7) td = "up before the sun ☀️";
		if (timeOfDay >= 22 || timeOfDay < 2) td = "training after hours 🌙";
		if (timeOfDay >= 11 && timeOfDay < 13) td = "midday hustle 🍔➡️🏋️";

		let base = "";
		const name = "{name}";
		switch ((a.type || "other").toLowerCase()) {
			case "run": base = `${name} knocked out ${km ? km.toFixed(1) + " km" : mins + "m"} — ${td ?? "solid pace"}`; break;
			case "ride": base = `${name} rode ${km ? km.toFixed(1) + " km" : mins + "m"} — wheels keep turning 🚴`; break;
			case "swim": base = `${name} swam ${mins}m — pool discipline 🏊`; break;
			case "gym": base = `${name} logged ${mins}m in the iron chapel ⛪️`; break;
			default: base = `${name} trained ${mins}m — steady grind`; break;
		}
		if (a.source === "manual") {
			if (a.notes && a.notes.trim().length > 0) {
				base += ` — “${a.notes.trim()}”`;
			} else {
				base += ` — silent grind`;
			}
		}
		q.push({
			type: "ACTIVITY",
			rendered: base,
			payload: { type: a.type, mins, km, timeOfDay },
			visibility: "both",
			primaryPlayerId: a.playerId,
			activityId: a.id
		});
	}
	// Other events (placeholder examples)
	if (ctx.event?.type === "VOTE_APPROVED") {
		q.push({ type: "VOTE", rendered: `Verdict: legit. {name}’s workout stands 🧑‍⚖️`, payload: ctx.event, visibility: "both", primaryPlayerId: ctx.event.playerId, activityId: ctx.event.activityId });
	}
	if (ctx.event?.type === "VOTE_REJECTED") {
		q.push({ type: "VOTE", rendered: `Verdict: SUS. {name}’s post doesn’t count 🕵️`, payload: ctx.event, visibility: "both", primaryPlayerId: ctx.event.playerId, activityId: ctx.event.activityId });
	}
	if (ctx.event?.type === "KO") {
		q.push({ type: "KO", rendered: `DEATHMATCH OVER — {loser} hit 0 hearts. Pot: $${ctx.event.pot}`, payload: ctx.event, visibility: "both", primaryPlayerId: ctx.event.loserId });
	}
	return q;
}

async function insertQuips(lobbyId: string, quips: Quip[]) {
	if (!quips.length) return;
	const supabase = getServerSupabase();
	if (!supabase) return;
	// Resolve basic names for placeholders
	const ids = Array.from(new Set(quips.map(q => q.primaryPlayerId).filter(Boolean) as string[]));
	let names = new Map<string, string>();
	if (ids.length) {
		const { data: prows } = await supabase.from("player").select("id,name").in("id", ids as any);
		for (const p of (prows ?? [])) names.set(p.id as string, p.name as string);
	}
	// naive dedupe: rely on unique index for activity + rendered
	const rows = quips.map(q => {
		let rendered = q.rendered;
		if (q.primaryPlayerId && rendered.includes("{name}")) {
			const nm = names.get(q.primaryPlayerId) || "Athlete";
			rendered = rendered.replaceAll("{name}", nm);
		}
		// Duo placeholders
		if (q.payload?.a && q.payload?.b && rendered.includes("{a}") && rendered.includes("{b}")) {
			const aName = names.get(q.payload.a as string) || "A";
			const bName = names.get(q.payload.b as string) || "B";
			rendered = rendered.replace("{a}", aName).replace("{b}", bName);
		}
		return {
		lobby_id: lobbyId,
		type: q.type,
		primary_player_id: q.primaryPlayerId ?? null,
		secondary_player_id: q.secondaryPlayerId ?? null,
		activity_id: q.activityId ?? null,
		payload: q.payload,
		rendered,
		visibility: q.visibility ?? "both"
	}});
	const { error } = await supabase.from("comments").insert(rows).select("id");
	if (error) throw error;
}

export async function onActivityLogged(lobbyId: string, activity: Activity): Promise<void> {
	const quips = generateQuips({ now: new Date(), lobbyId, activity });
	await insertQuips(lobbyId, quips);
	// Push: let lobby know someone posted (exclude the poster)
	try {
		const supabase = getServerSupabase();
		let actorUserId: string | undefined;
		let actorName: string | undefined;
		if (supabase && activity.playerId) {
			const { data: pl } = await supabase.from("player").select("user_id,name").eq("id", activity.playerId).maybeSingle();
			actorUserId = pl?.user_id as string | undefined;
			actorName = pl?.name as string | undefined;
		}
		await sendPushToLobby(lobbyId, {
			title: actorName ? `${actorName} just logged a workout` : "New workout posted",
			body: "Tap to see what they did.",
			url: `/lobby/${lobbyId}/history`
		}, { excludeUserId: actorUserId });
	} catch { /* ignore */ }

	// Extra flavor scenarios to keep the feed lively
	try {
		const supabase = getServerSupabase();
		if (!supabase) return;
		const now = new Date();
		const hour = now.getHours();
		const dayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;

		// Deterministic hash helper for template selection
		const pickTemplate = (tmpls: string[], seed: string) => {
			const h = seed.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
			return tmpls[h % tmpls.length];
		};

		// Time-of-day callouts (late-night / lunch)
		if (hour >= 22 || hour < 5) {
			const templates = [
				"Late-night grinder. {name} punched the clock after hours 🌙",
				"{name} is stealing reps from tomorrow's sleep schedule 🦉",
				"No bedtime, just sets. {name} keeps the lights on in the arena."
			];
			await insertQuipOnce({
				lobbyId,
				type: "SUMMARY",
				rendered: pickTemplate(templates, lobbyId + (activity.playerId ?? "") + dayKey + "late"),
				payload: { timeWindow: "late-night", day: dayKey },
				primaryPlayerId: activity.playerId,
				visibility: "both",
				dedupeMs: 6 * 60 * 60 * 1000,
				dedupeKey: { timeWindow: "late-night", day: dayKey }
			});
		} else if (hour >= 11 && hour < 14) {
			const templates = [
				"Lunchtime warrior: {name} traded sandwiches for sweat 🥪➡️🏋️",
				"Clocked out, clocked in. {name} owns the lunch hour.",
				"Midday raid by {name}. The cafe can wait."
			];
			await insertQuipOnce({
				lobbyId,
				type: "SUMMARY",
				rendered: pickTemplate(templates, lobbyId + (activity.playerId ?? "") + dayKey + "mid"),
				payload: { timeWindow: "midday", day: dayKey },
				primaryPlayerId: activity.playerId,
				visibility: "both",
				dedupeMs: 6 * 60 * 60 * 1000,
				dedupeKey: { timeWindow: "midday", day: dayKey }
			});
		}

		// Double-header: 2+ workouts same day (manual data)
		const startDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
		const endDay = new Date(startDay.getTime() + 24 * 60 * 60 * 1000);
		const { data: dayActs } = await supabase
			.from("manual_activities")
			.select("id,date")
			.eq("lobby_id", lobbyId)
			.eq("player_id", activity.playerId)
			.gte("date", startDay.toISOString())
			.lt("date", endDay.toISOString());
		if ((dayActs?.length ?? 0) >= 2) {
			const templates = [
				"Double-header for {name}. Arena tax prepaid.",
				"{name} ran back another session today. Respect.",
				"Two-a-day unlocked. {name} is farming XP."
			];
			await insertQuipOnce({
				lobbyId,
				type: "SUMMARY",
				rendered: pickTemplate(templates, lobbyId + (activity.playerId ?? "") + dayKey + "dbl"),
				payload: { doubleHeaderDate: dayKey },
				primaryPlayerId: activity.playerId,
				visibility: "both",
				dedupeMs: 12 * 60 * 60 * 1000,
				dedupeKey: { doubleHeaderDate: dayKey }
			});
		}

		// Consistency: 3-day streak (manual data by day)
		const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
		const { data: recentActs } = await supabase
			.from("manual_activities")
			.select("date")
			.eq("lobby_id", lobbyId)
			.eq("player_id", activity.playerId)
			.gte("date", threeDaysAgo.toISOString());
		const distinctDays = new Set(
			(recentActs ?? []).map(r => {
				const d = new Date(r.date as string);
				return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
			})
		);
		if (distinctDays.size >= 3) {
			const templates = [
				"Three days straight. {name} found a groove.",
				"Consistency badge: {name} is on a 3-day heater.",
				"Alarm clock setting: OFF. {name} shows up three days running."
			];
			await insertQuipOnce({
				lobbyId,
				type: "SUMMARY",
				rendered: pickTemplate(templates, lobbyId + (activity.playerId ?? "") + "streak3"),
				payload: { streakDays: 3 },
				primaryPlayerId: activity.playerId,
				visibility: "both",
				dedupeMs: 24 * 60 * 60 * 1000,
				dedupeKey: { streakDays: 3 }
			});
		}

		// Underdog alert: lowest hearts posts a workout
		const { data: heartRows } = await supabase.from("player").select("id,lives_remaining").eq("lobby_id", lobbyId);
		if (heartRows && heartRows.length) {
			const minHearts = Math.min(...heartRows.map(r => (r.lives_remaining as number) ?? 0));
			const maxHearts = Math.max(...heartRows.map(r => (r.lives_remaining as number) ?? 0));
			const isUnderdog = heartRows.find(r => r.id === activity.playerId && (r.lives_remaining as number) === minHearts && minHearts < maxHearts);
			if (isUnderdog) {
				const templates = [
					"Underdog swings back. {name} fights off elimination.",
					"{name} climbing out of the basement — hearts on the line.",
					"Lowest hearts, highest effort. {name} stays alive."
				];
				await insertQuipOnce({
					lobbyId,
					type: "SUMMARY",
					rendered: pickTemplate(templates, lobbyId + (activity.playerId ?? "") + dayKey + "underdog"),
					payload: { underdog: true, day: dayKey },
					primaryPlayerId: activity.playerId,
					visibility: "both",
					dedupeMs: 12 * 60 * 60 * 1000,
					dedupeKey: { underdog: true, day: dayKey }
				});
			}
		}

		// Idle to active: first workout after 48h idle
		const since48 = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();
		const { data: prevAct } = await supabase
			.from("manual_activities")
			.select("date")
			.eq("lobby_id", lobbyId)
			.eq("player_id", activity.playerId)
			.lt("date", since48)
			.order("date", { ascending: false })
			.limit(1);
		const hadOld = (prevAct ?? []).length > 0;
		const { data: recentWithin48 } = await supabase
			.from("manual_activities")
			.select("id")
			.eq("lobby_id", lobbyId)
			.eq("player_id", activity.playerId)
			.gte("date", since48)
			.limit(2);
		const onlyThisOne = (recentWithin48?.length ?? 0) <= 1;
		if (hadOld && onlyThisOne) {
			const templates = [
				"Back from the shadows — {name} returns after a pause.",
				"48h idle breaker. {name} re-enters the arena.",
				"Rust shaken. {name} clocks back in."
			];
			await insertQuipOnce({
				lobbyId,
				type: "SUMMARY",
				rendered: pickTemplate(templates, lobbyId + (activity.playerId ?? "") + dayKey + "idle"),
				payload: { idleBreak: true, day: dayKey },
				primaryPlayerId: activity.playerId,
				visibility: "both",
				dedupeMs: 24 * 60 * 60 * 1000,
				dedupeKey: { idleBreak: true, day: dayKey }
			});
		}

		// Weekend opener / Monday motivation (once per day per lobby)
		const weekday = now.getDay(); // 0 = Sun, 1 = Mon, 6 = Sat
		if (weekday === 6) {
			await insertQuipOnce({
				lobbyId,
				type: "SUMMARY",
				rendered: "Weekend opener — {name} sets the tempo.",
				payload: { weekend: true, day: dayKey },
				primaryPlayerId: activity.playerId,
				visibility: "both",
				dedupeMs: 24 * 60 * 60 * 1000,
				dedupeKey: { weekend: true, day: dayKey }
			});
		} else if (weekday === 1) {
			await insertQuipOnce({
				lobbyId,
				type: "SUMMARY",
				rendered: "Monday motivation drop by {name}. Alarm clocks everywhere.",
				payload: { monday: true, day: dayKey },
				primaryPlayerId: activity.playerId,
				visibility: "both",
				dedupeMs: 24 * 60 * 60 * 1000,
				dedupeKey: { monday: true, day: dayKey }
			});
		}

		// Photo of the day: first photo comment each day
		await insertQuipOnce({
			lobbyId,
			type: "SUMMARY",
			rendered: "Photo of the day nominee from {name}.",
			payload: { photoDay: dayKey },
			primaryPlayerId: activity.playerId,
			visibility: "feed",
			dedupeMs: 24 * 60 * 60 * 1000,
			dedupeKey: { photoDay: dayKey }
		});
	} catch {
		// best-effort flavor; ignore errors
	}
}

export async function onVoteResolved(lobbyId: string, activity: Activity, status: 'approved'|'rejected'): Promise<void> {
	const ev = { type: status === "approved" ? "VOTE_APPROVED" : "VOTE_REJECTED", playerId: activity.playerId, activityId: activity.id };
	const quips = generateQuips({ now: new Date(), lobbyId, event: ev });
	await insertQuips(lobbyId, quips);
}

export async function onHeartsChanged(lobbyId: string, playerId: string, delta: number, reason: string): Promise<void> {
	const lostTemplates = [
		`Arena tax collected. {name} lost a heart. ${reason || ""}`.trim(),
		`Ouch. {name} drops a heart — ${reason || "keep swinging"}`.trim(),
		`{name} hands a heart to the void. ${reason || ""}`.trim()
	];
	const gainTemplates = [
		`Borrowed heart returned — {name} back in the fight ❤️`,
		`Refilled. {name} gains a heart and momentum.`,
		`Second wind for {name}. Heart restored.`
	];
	// Deterministic selection: hash playerId+reason so the same event always picks the same template
	const hashSeed = (playerId + reason).split("").reduce((a, c) => a + c.charCodeAt(0), 0);
	const templates = delta < 0 ? lostTemplates : gainTemplates;
	const rendered = templates[hashSeed % templates.length];
	// Stronger dedupe using insertQuipOnce to avoid races
	const inserted = await insertQuipOnce({
		lobbyId,
		type: "HEARTS",
		rendered,
		payload: { delta, reason },
		primaryPlayerId: playerId,
		visibility: "both",
		dedupeMs: 7 * 24 * 60 * 60 * 1000,
		dedupeKey: { delta, reason }
	});
	if (!inserted) return;

	// Push: heart change
	try {
		const title = delta < 0 ? "Heart dropped" : "Heart gained";
		await sendPushToLobby(lobbyId, {
			title,
			body: rendered.replace("{name}", "An athlete"),
			url: `/lobby/${lobbyId}/history`
		});
	} catch { /* ignore */ }
}

export async function onWeeklyRollover(lobbyId: string): Promise<void> {
	// placeholder: could summarise here
}

export async function onPotChanged(lobbyId: string, delta: number, potOverride?: number): Promise<void> {
	const supabase = getServerSupabase();
	if (!supabase) return;
	let potVal = potOverride;
	if (potVal === undefined) {
		const { data: lobby } = await supabase.from("lobby").select("cash_pool").eq("id", lobbyId).maybeSingle();
		potVal = lobby?.cash_pool ?? 0;
	}
	potVal = Number(potVal ?? 0);
	const renderedBase = `Ante collected. Pot climbs to $${potVal}`;
	const receipts = ["🧾", "💸", "📜", "🏦"];
	// Deterministic flair to keep dedupe stable
	const flair = receipts[(Math.abs(Math.floor(potVal)) + receipts.length) % receipts.length];
	const inserted = await insertQuipOnce({
		lobbyId,
		type: "POT",
		rendered: `${renderedBase} ${flair}`,
		payload: { delta, pot: potVal },
		visibility: "feed",
		dedupeMs: 7 * 24 * 60 * 60 * 1000,
		dedupeKey: { delta, pot: potVal }
	});

	// Push: pot change alert to lobby
	if (inserted) {
		try {
			await sendPushToLobby(lobbyId, {
				title: "Pot climbed",
				body: `${renderedBase}. Stakes rising.`,
				url: `/lobby/${lobbyId}/history`
			});
		} catch { /* ignore */ }
	}

	// Milestone shout-outs
	const milestones = [50, 100, 250, 500];
	const hit = milestones.find(m => potVal >= m && potVal - delta < m);
	if (hit) {
		const options = [
			`Pot milestone: $${hit}+ on the board.`,
			`Arena kitty hits $${hit}. Stakes rising.`,
			`Bank rolls to $${hit}. Gloves tighter.`
		];
		// Deterministic pick based on milestone value
		const rendered = options[hit % options.length];
		await insertQuipOnce({
			lobbyId,
			type: "SUMMARY",
			rendered,
			payload: { potMilestone: hit, pot: potVal },
			visibility: "feed",
			dedupeMs: 24 * 60 * 60 * 1000,
			dedupeKey: { potMilestone: hit }
		});
	}
}

export async function onKO(lobbyId: string, loserId: string, potAtKO: number): Promise<void> {
	const ev = { type: "KO", loserId, pot: potAtKO };
	const quips = generateQuips({ now: new Date(), lobbyId, event: ev });
	await insertQuips(lobbyId, quips);

	// Push: KO event to lobby
	try {
		await sendPushToLobby(lobbyId, {
			title: "KO in the arena",
			body: `A player just hit 0 hearts. Pot: $${potAtKO}.`,
			url: `/lobby/${lobbyId}/history`
		});
	} catch { /* ignore */ }
}

export async function onSpin(lobbyId: string, text: string): Promise<void> {
	const rendered = `Wheel spun. Punishment: “${text}”`;
	await insertQuips(lobbyId, [{ type: "SUMMARY", rendered, payload: { text }, visibility: "feed" }]);
}

export async function onReadyChanged(lobbyId: string, playerId: string, ready: boolean): Promise<void> {
	const rendered = ready ? `{name} fears no punishment. Ready ✅` : `{name} is not ready yet ⏳`;
	await insertQuips(lobbyId, [{ type: "SUMMARY", rendered, payload: { ready }, primaryPlayerId: playerId, visibility: "feed" }]);
}

export async function onPunishmentResolved(lobbyId: string, playerId: string): Promise<void> {
	const rendered = `{name} cleared a punishment ✅`;
	await insertQuipOnce({
		lobbyId,
		type: "SUMMARY",
		rendered,
		payload: {},
		primaryPlayerId: playerId,
		visibility: "feed",
		dedupeMs: 30 * 60 * 1000,
		dedupeKey: { punishmentResolved: true }
	});
}

export async function onAllReady(lobbyId: string): Promise<void> {
	const rendered = `All athletes ready. Bell rings soon.`;
	await insertQuipOnce({
		lobbyId,
		type: "SUMMARY",
		rendered,
		payload: { type: "ALL_READY" },
		visibility: "feed",
		dedupeMs: 60 * 60 * 1000,
		dedupeKey: { type: "ALL_READY" }
	});
}

export async function onWeeklyReset(lobbyId: string, weekStartIso: string): Promise<void> {
	const rendered = `The arena resets. New week begins.`;
	await insertQuipOnce({
		lobbyId,
		type: "SUMMARY",
		rendered,
		payload: { type: "WEEK_RESET", weekStart: weekStartIso },
		visibility: "feed",
		dedupeMs: 8 * 24 * 60 * 60 * 1000,
		dedupeKey: { type: "WEEK_RESET", weekStart: weekStartIso }
	});
}

export async function onStreakMilestone(lobbyId: string, playerId: string, streak: number): Promise<void> {
	const rendered = `{name} hits ${streak}-day streak — pressure’s on.`;
	await insertQuipOnce({
		lobbyId,
		type: "SUMMARY",
		rendered,
		payload: { streak },
		primaryPlayerId: playerId,
		visibility: "both",
		dedupeMs: 24 * 60 * 60 * 1000,
		dedupeKey: { streakMilestone: streak }
	});
}

export async function onGhostWeek(lobbyId: string, playerId: string, weekStart: string, weeklyTarget: number) {
	const rendered = `Ghost week warning: {name} is 0/${weeklyTarget} so far.`;
	await insertQuipOnce({
		lobbyId,
		type: "SUMMARY",
		rendered,
		payload: { weekStart, weeklyTarget },
		primaryPlayerId: playerId,
		visibility: "both",
		dedupeMs: 48 * 60 * 60 * 1000,
		dedupeKey: { ghostWeek: weekStart, weeklyTarget }
	});
}

export async function onPerfectWeek(lobbyId: string, playerId: string, workouts: number, weekStart?: string) {
	const rendered = `Perfect week badge: {name} went ${workouts}/${workouts}.`;
	await insertQuipOnce({
		lobbyId,
		type: "SUMMARY",
		rendered,
		payload: { perfectWeek: workouts, weekStart: weekStart ?? null },
		primaryPlayerId: playerId,
		visibility: "both",
		dedupeMs: 8 * 24 * 60 * 60 * 1000,
		dedupeKey: { perfectWeek: workouts, weekStart: weekStart ?? null }
	});
}

export async function onWeeklyHype(lobbyId: string, players: Array<{ id: string; name?: string | null }>, weeklyTarget: number) {
	if (!players.length) return;
	const names = players.map(p => p.name || "Athlete").slice(0, 3).join(" • ");
	const rendered = `Weekly hype: ${names} need 1 more to hit ${weeklyTarget}.`;
	await insertQuipOnce({
		lobbyId,
		type: "SUMMARY",
		rendered,
		payload: { hype: true, weeklyTarget, players: players.map((p) => p.id) },
		visibility: "both",
		dedupeMs: 24 * 60 * 60 * 1000,
		dedupeKey: { hype: true, weeklyTarget, players: players.map((p) => p.id).sort() }
	});
}

export async function onTightRace(lobbyId: string, playerNames: string[], pot: number) {
	if (playerNames.length < 2) return;
	const names = playerNames.slice(0, 3).join(" • ");
	const rendered = `Tight race: ${names} tied on hearts with a $${pot} pot.`;
	await insertQuipOnce({
		lobbyId,
		type: "SUMMARY",
		rendered,
		payload: { tightRace: true, pot, names: playerNames.slice(0, 3) },
		visibility: "feed",
		dedupeMs: 12 * 60 * 60 * 1000,
		dedupeKey: { tightRace: true, pot, names: playerNames.slice(0, 3).sort() }
	});
}

export async function onDailyReminder(lobbyId: string, playerId: string, playerName: string, dayKey?: string): Promise<void> {
	const supabase = getServerSupabase();
	if (!supabase) return;
	const resolvedDayKey = dayKey ?? new Date().toISOString().slice(0, 10);
	const rendered = `{name} hasn't logged an activity today — time to move 💪`;
	const inserted = await insertQuipOnce({
		lobbyId,
		type: "SUMMARY",
		rendered,
		payload: { reminder: true, day: resolvedDayKey },
		primaryPlayerId: playerId,
		visibility: "both",
		dedupeMs: 24 * 60 * 60 * 1000,
		dedupeKey: { reminder: true, day: resolvedDayKey }
	});
	if (!inserted) return;

	// Push: nudge the player only
	try {
		const { data: pl } = await supabase.from("player").select("user_id").eq("id", playerId).maybeSingle();
		const userId = pl?.user_id as string | null | undefined;
		if (userId) {
			await sendPushToUser(userId, {
				title: "Move check-in",
				body: `${playerName}, no workout logged yet today. Tap to post.`,
				url: `/lobby/${lobbyId}/history`
			});
		}
	} catch {
		// ignore
	}
}

export async function onStreakPR(lobbyId: string, playerId: string, streak: number): Promise<void> {
	const supabase = getServerSupabase();
	if (!supabase) return;
	// If there exists a PR comment with streak >= current, skip; otherwise insert.
	const { data: prior } = await supabase
		.from("comments")
		.select("payload")
		.eq("lobby_id", lobbyId)
		.eq("primary_player_id", playerId)
		.eq("type", "SUMMARY")
		.like("rendered", "New PR streak for%")
		.order("created_at", { ascending: false })
		.limit(1);
	const prevStreak = Number(prior?.[0]?.payload?.streak || 0);
	if (prevStreak >= streak) return;
	const rendered = `New PR streak for {name}: ${streak} days 🔥`;
	await insertQuipOnce({
		lobbyId,
		type: "SUMMARY",
		rendered,
		payload: { streak },
		primaryPlayerId: playerId,
		visibility: "both",
		dedupeMs: 365 * 24 * 60 * 60 * 1000,
		dedupeKey: { streakPR: streak }
	});
}

// Social coincidence helpers
export async function onSocialBurst(lobbyId: string, playerIdA: string, playerIdB: string) {
	const supabase = getServerSupabase();
	if (!supabase) return;
	// cooldown: 10 minutes
	const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
	const { data: recent } = await supabase
		.from("comments")
		.select("id")
		.eq("lobby_id", lobbyId)
		.like("rendered", "Back-to-back hits%")
		.gte("created_at", since)
		.limit(1);
	if (recent && recent.length) return;
	const rendered = `Back-to-back hits from {a} & {b} — the arena wakes up 👀`;
	// We'll substitute names inside insert by using payload
	await insertQuips(lobbyId, [{
		type: "SUMMARY",
		rendered,
		payload: { a: playerIdA, b: playerIdB },
		primaryPlayerId: playerIdA,
		secondaryPlayerId: playerIdB,
		visibility: "feed"
	}]);
}

export async function onRivalryPulse(lobbyId: string, playerIdA: string, playerIdB: string) {
	const supabase = getServerSupabase();
	if (!supabase) return;
	const key = [playerIdA, playerIdB].sort().join("-");
	const sinceWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
	const { data: recent } = await supabase
		.from("comments")
		.select("id")
		.eq("lobby_id", lobbyId)
		.eq("type", "SUMMARY")
		.contains("payload", { rivalryKey: key } as any)
		.gte("created_at", sinceWeek);
	const count = (recent ?? []).length;
	if (count >= 2) {
		const renderedOptions = [
			"Rivalry watch: {a} vs {b}. Another close post.",
			"{a} and {b} keep trading blows within minutes.",
			"Smells like a duel — {a} and {b} stay neck and neck."
		];
		// Deterministic pick from rivalry key
		const keyHash = key.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
		const rendered = renderedOptions[keyHash % renderedOptions.length];
		const since = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
		const { data: exists } = await supabase
			.from("comments")
			.select("id")
			.eq("lobby_id", lobbyId)
			.eq("type", "SUMMARY")
			.eq("rendered", rendered)
			.contains("payload", { rivalryKey: key } as any)
			.gte("created_at", since)
			.limit(1);
		if (exists && exists.length) return;
		await insertQuips(lobbyId, [{
			type: "SUMMARY",
			rendered,
			payload: { rivalryKey: key },
			primaryPlayerId: playerIdA,
			secondaryPlayerId: playerIdB,
			visibility: "both"
		}]);
	} else {
		await insertQuipOnce({
			lobbyId,
			type: "SUMMARY",
			rendered: "Rivalry marker",
			payload: { rivalryKey: key, marker: true },
			primaryPlayerId: playerIdA,
			secondaryPlayerId: playerIdB,
			visibility: "history",
			dedupeMs: 60 * 60 * 1000
		});
	}
}

export async function onThemeHour(lobbyId: string, type: string) {
	const supabase = getServerSupabase();
	if (!supabase) return;
	const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
	const { data: recent } = await supabase
		.from("comments")
		.select("id")
		.eq("lobby_id", lobbyId)
		.like("rendered", "Theme hour:%")
		.gte("created_at", since)
		.limit(1);
	if (recent && recent.length) return;
	const rendered = `Theme hour: ${type.toLowerCase()} — the arena syncs up ⏱️`;
	await insertQuips(lobbyId, [{ type: "SUMMARY", rendered, payload: { type }, visibility: "feed" }]);
}
