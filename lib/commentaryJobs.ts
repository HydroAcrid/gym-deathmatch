import { getServerSupabase } from "./supabaseClient";
import { computeWeeklyHearts } from "./rules";
import { fetchRecentActivities } from "./strava";
import { getUserStravaTokens } from "./persistence";
import { onDailyReminder, onGhostWeek, onHeartsChanged, onPerfectWeek, onTightRace, onWeeklyHype, onWeeklyReset } from "./commentary";
import { logError } from "./logger";

type LobbyRow = {
	id: string;
	season_start: string | null;
	weekly_target: number | null;
	mode: string | null;
	cash_pool: number | null;
	stage: string | null;
};

type PlayerRow = {
	id: string;
	name: string | null;
	user_id: string | null;
};

type LegacyTokenRow = {
	access_token: string | null;
	refresh_token: string | null;
	expires_at: string | null;
};

type PlayerIdRow = {
	player_id: string;
};

type ManualActivityLiteRow = {
	player_id: string;
	date: string;
	type: string | null;
	duration_minutes: number | null;
	distance_km: number | null;
};

type ActivityLike = {
	start_date?: string;
	start_date_local?: string;
	moving_time?: number;
	distance?: number;
	type?: string;
	__source?: "manual" | "strava";
};

function dayKeyUTC(d: Date): string {
	return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

async function fetchStravaActivitiesForPlayer(player: PlayerRow): Promise<ActivityLike[]> {
	let tokens: { accessToken: string } | null = null;
	if (player.user_id) {
		const fromUser = await getUserStravaTokens(player.user_id);
		if (fromUser?.accessToken) {
			tokens = { accessToken: fromUser.accessToken };
		}
	}
	if (!tokens) {
		const supabase = getServerSupabase();
		if (!supabase) return [];
		const { data: legacy } = await supabase
			.from("strava_token")
			.select("access_token,refresh_token,expires_at")
			.eq("player_id", player.id)
			.maybeSingle();
		const legacyRow = legacy as LegacyTokenRow | null;
		if (legacyRow?.access_token && legacyRow?.refresh_token && legacyRow?.expires_at) {
			tokens = {
				accessToken: legacyRow.access_token
			};
		}
	}
	if (!tokens) return [];

	const activities = await fetchRecentActivities(tokens.accessToken);
	return Array.isArray(activities) ? (activities as ActivityLike[]) : [];
}

export async function runDailyCommentaryJob(now = new Date()): Promise<{ lobbiesProcessed: number; remindersSent: number }> {
	const supabase = getServerSupabase();
	if (!supabase) return { lobbiesProcessed: 0, remindersSent: 0 };

	const { data: lobbies } = await supabase
		.from("lobby")
		.select("id,stage")
		.eq("stage", "ACTIVE");

	let remindersSent = 0;
	for (const lobby of (lobbies ?? []) as Array<{ id: string }>) {
		try {
			const { data: players } = await supabase.from("player").select("id,name").eq("lobby_id", lobby.id);
			if (!players || players.length === 0) continue;

			const utcStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
			const utcEnd = new Date(utcStart.getTime() + 24 * 60 * 60 * 1000);
			const todayKey = dayKeyUTC(now);

			const { data: manualToday } = await supabase
				.from("manual_activities")
				.select("player_id")
				.eq("lobby_id", lobby.id)
				.gte("date", utcStart.toISOString())
				.lt("date", utcEnd.toISOString());
			const manualSet = new Set(((manualToday ?? []) as PlayerIdRow[]).map((r) => r.player_id));

			const stravaSet = new Set<string>();
			const { data: stravaToday, error: stravaErr } = await supabase
				.from("strava_activities")
				.select("player_id")
				.eq("lobby_id", lobby.id)
				.gte("start_date", utcStart.toISOString())
				.lt("start_date", utcEnd.toISOString());
			if (!stravaErr) {
				for (const r of (stravaToday ?? []) as PlayerIdRow[]) stravaSet.add(r.player_id);
			}

			for (const p of players as Array<{ id: string; name: string | null }>) {
				if (manualSet.has(p.id) || stravaSet.has(p.id)) continue;
				await onDailyReminder(lobby.id, p.id, p.name ?? "Athlete", todayKey);
				remindersSent += 1;
			}
		} catch (e) {
			await logError({ route: "CRON /api/cron/commentary/daily", code: "DAILY_COMMENTARY_FAILED", err: e, lobbyId: lobby.id });
		}
	}

	return {
		lobbiesProcessed: (lobbies ?? []).length,
		remindersSent
	};
}

export async function runWeeklyCommentaryJob(now = new Date()): Promise<{ lobbiesProcessed: number; heartsEvents: number; ghostWarnings: number; hypeEvents: number; tightRaceEvents: number; resets: number }> {
	const supabase = getServerSupabase();
	if (!supabase) return { lobbiesProcessed: 0, heartsEvents: 0, ghostWarnings: 0, hypeEvents: 0, tightRaceEvents: 0, resets: 0 };

	const { data: lobbies } = await supabase
		.from("lobby")
		.select("id,season_start,weekly_target,mode,cash_pool,stage")
		.eq("stage", "ACTIVE");

	let heartsEvents = 0;
	let ghostWarnings = 0;
	let hypeEvents = 0;
	let tightRaceEvents = 0;
	let resets = 0;

	for (const lobby of (lobbies ?? []) as LobbyRow[]) {
		if (!lobby.season_start) continue;
		const weeklyTarget = lobby.weekly_target ?? 3;
		try {
			const { data: playersRaw } = await supabase
				.from("player")
				.select("id,name,user_id")
				.eq("lobby_id", lobby.id);
			const players = (playersRaw ?? []) as PlayerRow[];
			if (players.length === 0) continue;

			const { data: manualRows } = await supabase
				.from("manual_activities")
				.select("player_id,date,type,duration_minutes,distance_km")
				.eq("lobby_id", lobby.id)
				.in("status", ["approved", "pending"])
				.order("date", { ascending: false })
				.limit(2000);
			const manualByPlayer = new Map<string, ActivityLike[]>();
			for (const row of (manualRows ?? []) as ManualActivityLiteRow[]) {
				const pid = row.player_id;
				if (!manualByPlayer.has(pid)) manualByPlayer.set(pid, []);
				manualByPlayer.get(pid)?.push({
					start_date: row.date,
					start_date_local: row.date,
					moving_time: row.duration_minutes ? Number(row.duration_minutes) * 60 : 0,
					distance: (row.distance_km ?? 0) * 1000,
					type: row.type || "Workout",
					__source: "manual"
				});
			}

			const nowTs = now.getTime();
			const heartsByPlayer = new Map<string, number>();
			const currentWeekByPlayer = new Map<string, { weekStart: string; workouts: number } | null>();
			for (const player of players) {
				const manualActs = manualByPlayer.get(player.id) ?? [];
				const stravaActs = await fetchStravaActivitiesForPlayer(player);
				const combined = [...manualActs, ...stravaActs].sort((a, b) => {
					const ta = new Date(a.start_date || a.start_date_local || 0).getTime();
					const tb = new Date(b.start_date || b.start_date_local || 0).getTime();
					return tb - ta;
				});

				const seasonStart = new Date(lobby.season_start);
				const weekly = computeWeeklyHearts(combined, seasonStart, {
					weeklyTarget,
					maxHearts: 3,
					seasonEnd: new Date()
				});
				heartsByPlayer.set(player.id, weekly.heartsRemaining);

				const completed = (weekly.events || []).filter((e) => new Date(e.weekStart).getTime() + 7 * 24 * 60 * 60 * 1000 <= nowTs);
				if (completed.length) {
					const last = completed[completed.length - 1];
					const weekKey = dayKeyUTC(new Date(last.weekStart));
					if (last.heartsLost > 0) {
						await onHeartsChanged(lobby.id, player.id, -last.heartsLost, `missed weekly target (${last.workouts}/${weeklyTarget}) - week ${weekKey}`);
						heartsEvents += 1;
					}
					if (last.heartsGained > 0) {
						await onHeartsChanged(lobby.id, player.id, last.heartsGained, `hit weekly target (${last.workouts}/${weeklyTarget}) - week ${weekKey}`);
						heartsEvents += 1;
					}
					if (last.workouts >= weeklyTarget && weeklyTarget > 0) {
						await onPerfectWeek(lobby.id, player.id, last.workouts, last.weekStart);
					}
				}

				const currentWeek = (weekly.events || [])[weekly.events.length - 1];
				currentWeekByPlayer.set(
					player.id,
					currentWeek ? { weekStart: currentWeek.weekStart, workouts: currentWeek.workouts } : null
				);
				if (currentWeek) {
					const ws = new Date(currentWeek.weekStart);
					const we = new Date(ws.getTime() + 7 * 24 * 60 * 60 * 1000);
					const daysIn = (nowTs - ws.getTime()) / (24 * 60 * 60 * 1000);
					if (we.getTime() > nowTs && daysIn >= 3 && weeklyTarget > 0 && currentWeek.workouts === 0) {
						await onGhostWeek(lobby.id, player.id, currentWeek.weekStart, weeklyTarget);
						ghostWarnings += 1;
					}
				}
			}

			if (weeklyTarget > 0 && now.getUTCDay() === 5) {
				const hype: Array<{ id: string; name?: string | null }> = [];
				for (const player of players) {
					const current = currentWeekByPlayer.get(player.id);
					if (!current) continue;
					const we = new Date(new Date(current.weekStart).getTime() + 7 * 24 * 60 * 60 * 1000);
					if (we.getTime() < nowTs) continue;
					if (current.workouts === weeklyTarget - 1) {
						hype.push({ id: player.id, name: player.name ?? null });
					}
				}
				if (hype.length > 0) {
					await onWeeklyHype(lobby.id, hype, weeklyTarget);
					hypeEvents += 1;
				}
			}

			if (String(lobby.mode || "").startsWith("MONEY_") && Number(lobby.cash_pool ?? 0) >= 50) {
				const maxHearts = Math.max(...Array.from(heartsByPlayer.values()));
				const leaders = players.filter((p) => (heartsByPlayer.get(p.id) ?? 0) === maxHearts);
				if (leaders.length >= 2) {
					await onTightRace(lobby.id, leaders.map((p) => p.name || "Athlete"), Number(lobby.cash_pool ?? 0));
					tightRaceEvents += 1;
				}
			}

			if (now.getUTCDay() === 0 && now.getUTCHours() === 0 && now.getUTCMinutes() < 15) {
				const ws = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0)).toISOString();
				await onWeeklyReset(lobby.id, ws);
				await supabase.from("user_ready_states").update({ ready: false }).eq("lobby_id", lobby.id);
				resets += 1;
			}
		} catch (e) {
			await logError({ route: "CRON /api/cron/commentary/weekly", code: "WEEKLY_COMMENTARY_FAILED", err: e, lobbyId: lobby.id });
		}
	}

	return {
		lobbiesProcessed: (lobbies ?? []).length,
		heartsEvents,
		ghostWarnings,
		hypeEvents,
		tightRaceEvents,
		resets
	};
}
