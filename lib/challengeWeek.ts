import { getServerSupabase } from "@/lib/supabaseClient";

type WeekContext = {
	mode?: string | null;
	status?: string | null;
	seasonStart?: string | null;
};

type SupabaseClient = NonNullable<ReturnType<typeof getServerSupabase>>;

export function currentWeekIndex(seasonStartIso?: string | null): number {
	const fallback = new Date().toISOString();
	const start = new Date(seasonStartIso || fallback);
	const now = new Date();
	const diffMs = now.getTime() - start.getTime();
	return Math.max(0, Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000))) + 1;
}

/**
 * Resolve which roulette week should be read/written for punishments.
 *
 * In `transition_spin`, we anchor to punishment rows rather than pure date math:
 * - If latest week is not started yet (no ACTIVE/COMPLETE status), keep that same week.
 * - If latest week is already ACTIVE/COMPLETE, transition targets the next week.
 */
export async function resolvePunishmentWeek(
	supabase: SupabaseClient,
	lobbyId: string,
	ctx: WeekContext
): Promise<number> {
	const byDateWeek = currentWeekIndex(ctx.seasonStart);
	const isRoulette = String(ctx.mode || "").startsWith("CHALLENGE_ROULETTE");
	if (!isRoulette || ctx.status !== "transition_spin") return byDateWeek;

	const { data: latestWeekRow } = await supabase
		.from("lobby_punishments")
		.select("week")
		.eq("lobby_id", lobbyId)
		.order("week", { ascending: false })
		.limit(1)
		.maybeSingle();

	if (!latestWeekRow || typeof latestWeekRow.week !== "number") {
		return 1;
	}

	const latestWeek = Number(latestWeekRow.week);
	const { data: latestWeekRows } = await supabase
		.from("lobby_punishments")
		.select("week_status")
		.eq("lobby_id", lobbyId)
		.eq("week", latestWeek);

	const started = (latestWeekRows || []).some((row: { week_status?: string | null }) => {
		const status = String(row?.week_status || "");
		return status === "ACTIVE" || status === "COMPLETE";
	});

	return started ? latestWeek + 1 : latestWeek;
}
