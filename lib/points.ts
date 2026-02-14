export type PointsInput = {
	workouts?: number | null;
	streak?: number | null;
	longestStreak?: number | null;
	penalties?: number | null;
};

type TieBreakInput = {
	athleteName?: string | null;
	name?: string | null;
	id?: string | null;
	tieBreakTimestamp?: number | string | Date | null;
	scoreReachedAt?: number | string | Date | null;
	firstWorkoutAt?: number | string | Date | null;
};

export const POINTS_FORMULA_TEXT = "Points = workouts + best streak - penalties";

export function calculatePoints(input: PointsInput): number {
	const workouts = Number(input.workouts ?? 0);
	const streak = Number(input.longestStreak ?? input.streak ?? 0);
	const penalties = Number(input.penalties ?? 0);
	return workouts + Math.max(0, streak) - penalties;
}

function toMs(value: number | string | Date | null | undefined): number | null {
	if (value == null) return null;
	if (value instanceof Date) {
		const ms = value.getTime();
		return Number.isFinite(ms) ? ms : null;
	}
	const numeric = Number(value);
	if (Number.isFinite(numeric)) return numeric;
	const parsed = new Date(String(value)).getTime();
	return Number.isFinite(parsed) ? parsed : null;
}

function resolveTieBreakMs(input: TieBreakInput): number | null {
	return (
		toMs(input.tieBreakTimestamp) ??
		toMs(input.scoreReachedAt) ??
		toMs(input.firstWorkoutAt) ??
		null
	);
}

function resolveDisplayName(input: TieBreakInput): string {
	const raw = input.athleteName ?? input.name ?? input.id ?? "";
	return String(raw).trim();
}

export function compareByPointsDesc<T extends PointsInput & TieBreakInput>(a: T, b: T): number {
	const pointDiff = calculatePoints(b) - calculatePoints(a);
	if (pointDiff !== 0) return pointDiff;

	const workoutDiff = Number(b.workouts ?? 0) - Number(a.workouts ?? 0);
	if (workoutDiff !== 0) return workoutDiff;

	const streakDiff = Number(b.streak ?? 0) - Number(a.streak ?? 0);
	if (streakDiff !== 0) return streakDiff;

	const aTieMs = resolveTieBreakMs(a);
	const bTieMs = resolveTieBreakMs(b);
	if (aTieMs !== null && bTieMs !== null && aTieMs !== bTieMs) {
		return aTieMs - bTieMs;
	}
	if (aTieMs !== null && bTieMs === null) return -1;
	if (aTieMs === null && bTieMs !== null) return 1;

	const aName = resolveDisplayName(a);
	const bName = resolveDisplayName(b);
	if (aName && bName && aName !== bName) {
		return aName.localeCompare(bName, undefined, { sensitivity: "base" });
	}

	return 0;
}
