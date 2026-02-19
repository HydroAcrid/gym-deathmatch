import { NextRequest, NextResponse } from "next/server";
import { resolveLobbyAccess } from "@/lib/lobbyAccess";
import { resolvePunishmentWeek } from "@/lib/challengeWeek";

type SummaryPrimaryCard =
	| { kind: "pot"; amount: number; subtitle: string }
	| { kind: "punishment"; text: string; suggestedBy?: string | null; weekLabel?: string | null };

type SummaryToplineStats = {
	heartsLeadersShort: string;
	pointsLeaderShort: string;
};

type SummaryPayload = {
	mode?: string;
	daily?: {
		dateKey: string;
		totalWorkouts: number;
		topPerformer?: { name: string; count: number } | null;
	};
	weekly?: {
		weekKey: string;
		totalWorkouts: number;
		topPerformer?: { name: string; count: number } | null;
	};
	pot?: number;
	hearts?: {
		leaders: string[];
		low: string[];
		max: number;
		min: number;
	};
	heartsDebug?: {
		playerCount: number;
		leadersRaw: Array<{ name: string; lives: number }>;
		lowRaw: Array<{ name: string; lives: number }>;
	};
	quips?: Array<{ text: string; created_at: string }>;
	quipsDaily?: Array<{ text: string; created_at: string }>;
	quipsWeekly?: Array<{ text: string; created_at: string }>;
	primarySummaryCard?: SummaryPrimaryCard;
	toplineStats?: SummaryToplineStats;
};

type SummaryPlayerRow = { id: string; name: string; lives_remaining?: number | null; hearts?: number | null };
type SummaryCountRow = { player_id: string };
type SummaryLobbyRow = {
	cash_pool?: number | null;
	mode?: string | null;
	status?: string | null;
	season_start?: string | null;
};
type SummaryPunishmentRow = {
	text?: string | null;
	created_by?: string | null;
	week?: number | null;
};
type SummaryHistoryEventRow = {
	type?: string | null;
	payload?: Record<string, unknown> | null;
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ lobbyId: string }> }) {
	const { lobbyId } = await params;
	const access = await resolveLobbyAccess(req, lobbyId);
	if (!access.ok) return NextResponse.json({ error: access.message }, { status: access.status });
	if (!access.memberPlayerId && !access.isOwner) return NextResponse.json({ error: "Not a member of lobby" }, { status: 403 });
	const supabase = access.supabase;

	const now = new Date();
	const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const startOfNextDay = new Date(startOfDay);
	startOfNextDay.setDate(startOfDay.getDate() + 1);
	const dayKey = `${startOfDay.getFullYear()}-${startOfDay.getMonth() + 1}-${startOfDay.getDate()}`;
	const startOfWeek = new Date(startOfDay);
	const day = startOfDay.getDay(); // 0 Sunday
	const diff = startOfDay.getDate() - day + (day === 0 ? -6 : 1); // Monday as start
	startOfWeek.setDate(diff);
	const startOfNextWeek = new Date(startOfWeek);
	startOfNextWeek.setDate(startOfWeek.getDate() + 7);
	const weekKey = `${startOfWeek.getFullYear()}-${startOfWeek.getMonth() + 1}-${startOfWeek.getDate()}`;

	const [manualDay, manualWeek, stravaDay, stravaWeek, playersRes, quipsDailyRes, quipsWeeklyRes, lobbyRes] = await Promise.all([
		supabase
			.from("manual_activities")
			.select("player_id,date")
			.eq("lobby_id", lobbyId)
			.in("status", ["approved", "pending"])
			.gte("date", startOfDay.toISOString())
			.lt("date", startOfNextDay.toISOString()),
		supabase
			.from("manual_activities")
			.select("player_id,date")
			.eq("lobby_id", lobbyId)
			.in("status", ["approved", "pending"])
			.gte("date", startOfWeek.toISOString())
			.lt("date", startOfNextWeek.toISOString()),
		supabase
			.from("strava_activities")
			.select("player_id,start_date")
			.eq("lobby_id", lobbyId)
			.gte("start_date", startOfDay.toISOString())
			.lt("start_date", startOfNextDay.toISOString()),
		supabase
			.from("strava_activities")
			.select("player_id,start_date")
			.eq("lobby_id", lobbyId)
			.gte("start_date", startOfWeek.toISOString())
			.lt("start_date", startOfNextWeek.toISOString()),
		supabase.from("player").select("id,name,lives_remaining,hearts").eq("lobby_id", lobbyId),
		supabase
			.from("comments")
			.select("rendered,created_at,type")
			.eq("lobby_id", lobbyId)
			.in("type", ["SUMMARY", "HEARTS", "POT"])
			.gte("created_at", startOfDay.toISOString())
			.lt("created_at", startOfNextDay.toISOString())
			.order("created_at", { ascending: false })
			.limit(25),
		supabase
			.from("comments")
			.select("rendered,created_at,type")
			.eq("lobby_id", lobbyId)
			.in("type", ["SUMMARY", "HEARTS", "POT"])
			.gte("created_at", startOfWeek.toISOString())
			.lt("created_at", startOfNextWeek.toISOString())
			.order("created_at", { ascending: false })
			.limit(50),
		supabase.from("lobby").select("cash_pool,mode,status,season_start").eq("id", lobbyId).maybeSingle()
	]);

	const playerMap = new Map<string, { name: string; lives: number }>();
	let playersData = (playersRes.data ?? []) as Array<{ id: string; name: string; lives_remaining?: number | null; hearts?: number | null }>;
	if ((!playersData || playersData.length === 0) && playersRes.error) {
		console.error("summary players error", playersRes.error);
	}
		if (!playersData || playersData.length === 0) {
			// Defensive retry in case a policy blocked the first query
			const { data: retry } = await supabase.from("player").select("*").eq("lobby_id", lobbyId);
			playersData = (retry as SummaryPlayerRow[] | null) ?? [];
		}
	for (const p of playersData) {
		const lives = Number(p.lives_remaining ?? p.hearts ?? 0);
		playerMap.set(p.id as string, { name: p.name as string, lives });
	}

		const countMap = (rows: SummaryCountRow[]) => {
			const m = new Map<string, number>();
			for (const r of rows ?? []) {
				const pid = r.player_id;
			m.set(pid, (m.get(pid) ?? 0) + 1);
		}
		return m;
	};

	const mergeCounts = (left: Map<string, number>, right: Map<string, number>) => {
		const merged = new Map<string, number>(left);
		for (const [pid, count] of right.entries()) {
			merged.set(pid, (merged.get(pid) ?? 0) + count);
		}
		return merged;
	};

	const manualDayCounts = countMap(manualDay.data ?? []);
	const manualWeekCounts = countMap(manualWeek.data ?? []);
	const stravaDayCounts = countMap((stravaDay.data as Array<{ player_id: string }> | null) ?? []);
	const stravaWeekCounts = countMap((stravaWeek.data as Array<{ player_id: string }> | null) ?? []);
	const dayCounts = mergeCounts(manualDayCounts, stravaDayCounts);
	const weekCounts = mergeCounts(manualWeekCounts, stravaWeekCounts);

	const topFromMap = (m: Map<string, number>) => {
		let best: { name: string; count: number } | null = null;
		for (const [pid, count] of m.entries()) {
			const nm = playerMap.get(pid)?.name || "Athlete";
			if (!best || count > best.count) best = { name: nm, count };
		}
		return best;
	};

	const hearts = (() => {
		if (!playerMap.size) return undefined;
		const lives = Array.from(playerMap.values()).map(p => p.lives);
		const max = Math.max(...lives);
		const min = Math.min(...lives);
		const leaders = Array.from(playerMap.values()).filter((v) => v.lives === max).map((v) => v.name || "Athlete");
		const low = Array.from(playerMap.values()).filter((v) => v.lives === min).map((v) => v.name || "Athlete");
		return { leaders, low, max, min };
	})();

	const heartsDebug = (() => {
		const playersArr = Array.from(playerMap.values()).map((v) => ({ name: v.name, lives: v.lives }));
		if (!playersArr.length) return { playerCount: 0, leadersRaw: [], lowRaw: [] };
		const maxLives = Math.max(...playersArr.map(p => p.lives));
		const minLives = Math.min(...playersArr.map(p => p.lives));
		return {
			playerCount: playersArr.length,
			leadersRaw: playersArr.filter(p => p.lives === maxLives),
			lowRaw: playersArr.filter(p => p.lives === minLives)
		};
	})();

	const quipsDaily = (quipsDailyRes.data ?? []).map((q) => ({ text: q.rendered as string, created_at: q.created_at as string }));
	const quipsWeekly = (quipsWeeklyRes.data ?? []).map((q) => ({ text: q.rendered as string, created_at: q.created_at as string }));
	const lobbyRow = (lobbyRes.data as SummaryLobbyRow | null) ?? null;
	const lobbyMode = String(lobbyRow?.mode ?? "MONEY_SURVIVAL");
	const isChallengeMode = lobbyMode.startsWith("CHALLENGE_");
	const weeklyTop = topFromMap(weekCounts);
	const shortNames = (names: string[]) => {
		if (!names.length) return "—";
		if (names.length <= 2) return names.join(" • ");
		return `${names.slice(0, 2).join(" • ")} +${names.length - 2}`;
	};
	let primarySummaryCard: SummaryPrimaryCard = {
		kind: "pot",
		amount: Number(lobbyRow?.cash_pool ?? 0),
		subtitle: "Stakes climbing."
	};
	if (isChallengeMode) {
		let selectedPunishment: { text: string; suggestedBy?: string | null; weekLabel?: string | null } | null = null;
		try {
			const week = await resolvePunishmentWeek(supabase, lobbyId, {
				mode: lobbyRow?.mode ?? null,
				status: lobbyRow?.status ?? null,
				seasonStart: lobbyRow?.season_start ?? null
			});
			const { data: activeData } = await supabase
				.from("lobby_punishments")
				.select("text,created_by,week")
				.eq("lobby_id", lobbyId)
				.eq("week", week)
				.eq("active", true)
				.maybeSingle();
			const active = (activeData as SummaryPunishmentRow | null) ?? null;
			if (active?.text) {
				const createdByName = active.created_by ? (playerMap.get(String(active.created_by))?.name ?? null) : null;
				selectedPunishment = {
					text: String(active.text),
					suggestedBy: createdByName,
					weekLabel: `Week ${Number(active.week ?? week)}`
				};
			}
			if (!selectedPunishment) {
				const { data: eventData } = await supabase
					.from("history_events")
					.select("type,payload")
					.eq("lobby_id", lobbyId)
					.in("type", ["PUNISHMENT_SPUN", "WEEK_STARTED"])
					.order("created_at", { ascending: false })
					.limit(5);
				const events = (eventData as SummaryHistoryEventRow[] | null) ?? [];
				for (const row of events) {
					const payload = row.payload ?? {};
					const textValue = payload.text ?? payload.punishment;
					if (typeof textValue === "string" && textValue.trim()) {
						const payloadWeek = payload.week;
						const weekLabel =
							typeof payloadWeek === "number" && Number.isFinite(payloadWeek)
								? `Week ${payloadWeek}`
								: null;
						selectedPunishment = { text: textValue.trim(), weekLabel };
						break;
					}
				}
			}
		} catch {
			// Keep fallback card when punishment lookup fails.
		}
		primarySummaryCard = selectedPunishment
			? {
					kind: "punishment",
					text: selectedPunishment.text,
					suggestedBy: selectedPunishment.suggestedBy ?? null,
					weekLabel: selectedPunishment.weekLabel ?? null
				}
			: {
					kind: "punishment",
					text: "Awaiting roulette punishment",
					suggestedBy: null,
					weekLabel: null
				};
	}

	const payload: SummaryPayload = {
		mode: lobbyMode,
		daily: {
			dateKey: dayKey,
			totalWorkouts: (manualDay.data?.length ?? 0) + (stravaDay.data?.length ?? 0),
			topPerformer: topFromMap(dayCounts)
		},
		weekly: {
			weekKey,
			totalWorkouts: (manualWeek.data?.length ?? 0) + (stravaWeek.data?.length ?? 0),
			topPerformer: topFromMap(weekCounts)
		},
		pot: Number(lobbyRow?.cash_pool ?? 0),
		hearts,
		heartsDebug,
		quips: quipsWeekly.slice(0, 5),
		quipsDaily: quipsDaily.slice(0, 10),
		quipsWeekly: quipsWeekly.slice(0, 20),
		primarySummaryCard,
		toplineStats: {
			heartsLeadersShort: shortNames(hearts?.leaders ?? []),
			pointsLeaderShort: weeklyTop ? weeklyTop.name : "—"
		}
	};

	return NextResponse.json({ summary: payload });
}
