import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabaseClient";

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
	quips?: Array<{ text: string; created_at: string }>;
};

export async function GET(_req: NextRequest, { params }: { params: Promise<{ lobbyId: string }> }) {
	const { lobbyId } = await params;
	const supabase = getServerSupabase();
	if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 501 });

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
		supabase.from("player").select("id,name,lives_remaining").eq("lobby_id", lobbyId),
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
	for (const p of (playersRes.data ?? [])) {
		playerMap.set(p.id as string, { name: p.name as string, lives: Number(p.lives_remaining ?? 0) });
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
		quips
	};

	return NextResponse.json({ summary: payload });
}
