import { NextRequest, NextResponse } from "next/server";
import { resolveLobbyAccess } from "@/lib/lobbyAccess";

type SummaryPayload = {
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
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ lobbyId: string }> }) {
	const { lobbyId } = await params;
	const access = await resolveLobbyAccess(req, lobbyId);
	if (!access.ok) return NextResponse.json({ error: access.message }, { status: access.status });
	if (!access.memberPlayerId) return NextResponse.json({ error: "Not a member of lobby" }, { status: 403 });
	const supabase = access.supabase;

	const now = new Date();
	const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const dayKey = `${startOfDay.getFullYear()}-${startOfDay.getMonth() + 1}-${startOfDay.getDate()}`;
	const startOfWeek = new Date(startOfDay);
	const day = startOfDay.getDay(); // 0 Sunday
	const diff = startOfDay.getDate() - day + (day === 0 ? -6 : 1); // Monday as start
	startOfWeek.setDate(diff);
	const weekKey = `${startOfWeek.getFullYear()}-${startOfWeek.getMonth() + 1}-${startOfWeek.getDate()}`;

	const [actDay, actWeek, playersRes, quipsRes, lobbyRes] = await Promise.all([
		supabase
			.from("manual_activities")
			.select("player_id,date")
			.eq("lobby_id", lobbyId)
			.gte("date", startOfDay.toISOString()),
		supabase
			.from("manual_activities")
			.select("player_id,date")
			.eq("lobby_id", lobbyId)
			.gte("date", startOfWeek.toISOString()),
		supabase.from("player").select("id,name,lives_remaining,hearts").eq("lobby_id", lobbyId),
		supabase
			.from("comments")
			.select("rendered,created_at,type")
			.eq("lobby_id", lobbyId)
			.in("type", ["SUMMARY", "HEARTS", "POT"])
			.order("created_at", { ascending: false })
			.limit(5),
		supabase.from("lobby").select("cash_pool").eq("id", lobbyId).maybeSingle()
	]);

	const playerMap = new Map<string, { name: string; lives: number }>();
	let playersData = (playersRes.data ?? []) as Array<{ id: string; name: string; lives_remaining?: number | null; hearts?: number | null }>;
	if ((!playersData || playersData.length === 0) && playersRes.error) {
		console.error("summary players error", playersRes.error);
	}
	if (!playersData || playersData.length === 0) {
		// Defensive retry in case a policy blocked the first query
		const { data: retry } = await supabase.from("player").select("*").eq("lobby_id", lobbyId);
		playersData = retry as any[] ?? [];
	}
	for (const p of playersData) {
		const lives = Number(p.lives_remaining ?? p.hearts ?? 0);
		playerMap.set(p.id as string, { name: p.name as string, lives });
	}

	const countMap = (rows: any[]) => {
		const m = new Map<string, number>();
		for (const r of rows ?? []) {
			const pid = r.player_id as string;
			m.set(pid, (m.get(pid) ?? 0) + 1);
		}
		return m;
	};

	const dayCounts = countMap(actDay.data ?? []);
	const weekCounts = countMap(actWeek.data ?? []);

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
		const leaders = Array.from(playerMap.entries()).filter(([, v]) => v.lives === max).map(([id]) => playerMap.get(id)?.name || "Athlete");
		const low = Array.from(playerMap.entries()).filter(([, v]) => v.lives === min).map(([id]) => playerMap.get(id)?.name || "Athlete");
		return { leaders, low, max, min };
	})();

	const heartsDebug = (() => {
		const playersArr = Array.from(playerMap.entries()).map(([id, v]) => ({ name: v.name, lives: v.lives }));
		if (!playersArr.length) return { playerCount: 0, leadersRaw: [], lowRaw: [] };
		const maxLives = Math.max(...playersArr.map(p => p.lives));
		const minLives = Math.min(...playersArr.map(p => p.lives));
		return {
			playerCount: playersArr.length,
			leadersRaw: playersArr.filter(p => p.lives === maxLives),
			lowRaw: playersArr.filter(p => p.lives === minLives)
		};
	})();

	const quips = (quipsRes.data ?? []).map(q => ({ text: q.rendered as string, created_at: q.created_at as string }));

	const payload: SummaryPayload = {
		daily: {
			dateKey: dayKey,
			totalWorkouts: actDay.data?.length ?? 0,
			topPerformer: topFromMap(dayCounts)
		},
		weekly: {
			weekKey,
			totalWorkouts: actWeek.data?.length ?? 0,
			topPerformer: topFromMap(weekCounts)
		},
		pot: Number(lobbyRes.data?.cash_pool ?? 0),
		hearts,
		heartsDebug,
		quips
	};

	return NextResponse.json({ summary: payload });
}
