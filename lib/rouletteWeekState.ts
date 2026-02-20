import { currentWeekIndex, resolvePunishmentWeek } from "@/lib/challengeWeek";
import { getServerSupabase } from "@/lib/supabaseClient";

type SupabaseClient = NonNullable<ReturnType<typeof getServerSupabase>>;

type RouletteWeekStateInput = {
	supabase: SupabaseClient;
	lobbyId: string;
	mode?: string | null;
	status?: string | null;
	seasonStart?: string | null;
};

export type RouletteWeekStatus =
	| "PENDING_PUNISHMENT"
	| "PENDING_CONFIRMATION"
	| "ACTIVE"
	| "COMPLETE"
	| "UNKNOWN";

export type RouletteWeekState = {
	week: number;
	hasItems: boolean;
	hasSpinEvent: boolean;
	hasActive: boolean;
	needsSpin: boolean;
	weekStatus: RouletteWeekStatus;
};

type PunishmentWeekRow = {
	active: boolean | null;
	week_status: string | null;
};

function normalizeWeekStatus(rows: PunishmentWeekRow[], hasSpinEvent: boolean): RouletteWeekStatus {
	const activeRow = rows.find((row) => Boolean(row.active));
	const rawStatus = String(activeRow?.week_status || "").toUpperCase();

	if (rawStatus === "PENDING_PUNISHMENT") return "PENDING_PUNISHMENT";
	if (rawStatus === "PENDING_CONFIRMATION") return "PENDING_CONFIRMATION";
	if (rawStatus === "ACTIVE") return "ACTIVE";
	if (rawStatus === "COMPLETE") return "COMPLETE";
	if (rows.length > 0 && !hasSpinEvent) return "PENDING_PUNISHMENT";
	return "UNKNOWN";
}

export async function resolveRouletteWeekState(input: RouletteWeekStateInput): Promise<RouletteWeekState> {
	const { supabase, lobbyId } = input;
	const isRoulette = String(input.mode || "").startsWith("CHALLENGE_ROULETTE");
	const status = String(input.status || "");

	const week = isRoulette
		? status === "transition_spin"
			? await resolvePunishmentWeek(supabase, lobbyId, {
					mode: input.mode,
					status: input.status,
					seasonStart: input.seasonStart
				})
			: Math.max(1, currentWeekIndex(input.seasonStart))
		: Math.max(1, currentWeekIndex(input.seasonStart));

	const [{ data: rowsData }, { data: spinData }] = await Promise.all([
		supabase
			.from("lobby_punishments")
			.select("active,week_status")
			.eq("lobby_id", lobbyId)
			.eq("week", week),
		supabase
			.from("lobby_spin_events")
			.select("id")
			.eq("lobby_id", lobbyId)
			.eq("week", week)
			.limit(1)
			.maybeSingle()
	]);

	const rows = ((rowsData as PunishmentWeekRow[] | null) ?? []).map((row) => ({
		active: Boolean(row.active),
		week_status: row.week_status ?? null
	}));
	const hasItems = rows.length > 0;
	const hasSpinEvent = Boolean(spinData?.id);
	const hasActive = rows.some((row) => Boolean(row.active));
	const weekStatus = normalizeWeekStatus(rows, hasSpinEvent);
	const needsSpin = isRoulette && (!hasSpinEvent || !hasActive);

	return {
		week,
		hasItems,
		hasSpinEvent,
		hasActive,
		needsSpin,
		weekStatus
	};
}
