import { getServerSupabase } from "./supabaseClient";
import type { Activity } from "@/lib/types";

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
	await supabase.from("comments").insert(rows).select("id");
}

export async function onActivityLogged(lobbyId: string, activity: Activity): Promise<void> {
	const quips = generateQuips({ now: new Date(), lobbyId, activity });
	await insertQuips(lobbyId, quips);
}

export async function onVoteResolved(lobbyId: string, activity: Activity, status: 'approved'|'rejected'): Promise<void> {
	const ev = { type: status === "approved" ? "VOTE_APPROVED" : "VOTE_REJECTED", playerId: activity.playerId, activityId: activity.id };
	const quips = generateQuips({ now: new Date(), lobbyId, event: ev });
	await insertQuips(lobbyId, quips);
}

export async function onHeartsChanged(lobbyId: string, playerId: string, delta: number, reason: string): Promise<void> {
	const rendered = delta < 0 ? `{name} lost a heart. ${reason || ""}`.trim() : `New week, new life — {name} back in the fight ❤️`;
	await insertQuips(lobbyId, [{ type: "HEARTS", rendered, payload: { delta, reason }, primaryPlayerId: playerId, visibility: "both" }]);
}

export async function onWeeklyRollover(lobbyId: string): Promise<void> {
	// placeholder: could summarise here
}

export async function onPotChanged(lobbyId: string, delta: number): Promise<void> {
	const supabase = getServerSupabase();
	if (!supabase) return;
	const { data: lobby } = await supabase.from("lobby").select("cash_pool").eq("id", lobbyId).maybeSingle();
	const rendered = `Ante collected. Pot climbs to $${(lobby?.cash_pool ?? 0)}`;
	await insertQuips(lobbyId, [{ type: "POT", rendered, payload: { delta, pot: lobby?.cash_pool ?? 0 }, visibility: "feed" } as Quip]);
}

export async function onKO(lobbyId: string, loserId: string, potAtKO: number): Promise<void> {
	const ev = { type: "KO", loserId, pot: potAtKO };
	const quips = generateQuips({ now: new Date(), lobbyId, event: ev });
	await insertQuips(lobbyId, quips);
}

export async function onStreakMilestone(lobbyId: string, playerId: string, streak: number): Promise<void> {
	// Dedupe: skip if same milestone already recorded in last 24h
	const supabase = getServerSupabase();
	if (!supabase) return;
	const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
	const rendered = `{name} hits ${streak}-day streak — pressure’s on.`;
	const { data: exists } = await supabase
		.from("comments")
		.select("id").eq("lobby_id", lobbyId)
		.eq("primary_player_id", playerId)
		.eq("type", "SUMMARY")
		.gte("created_at", since)
		.eq("rendered", rendered)
		.limit(1);
	if (exists && exists.length) return;
	await insertQuips(lobbyId, [{ type: "SUMMARY", rendered, payload: { streak }, primaryPlayerId: playerId, visibility: "both" }]);
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
	await insertQuips(lobbyId, [{ type: "SUMMARY", rendered, payload: { streak }, primaryPlayerId: playerId, visibility: "both" }]);
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


