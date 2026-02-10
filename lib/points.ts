export type PointsInput = {
	workouts?: number | null;
	streak?: number | null;
	penalties?: number | null;
};

export const POINTS_FORMULA_TEXT = "Points = workouts + streak - penalties";

export function calculatePoints(input: PointsInput): number {
	const workouts = Number(input.workouts ?? 0);
	const streak = Number(input.streak ?? 0);
	const penalties = Number(input.penalties ?? 0);
	return workouts + streak - penalties;
}

export function compareByPointsDesc<T extends PointsInput>(a: T, b: T): number {
	const pointDiff = calculatePoints(b) - calculatePoints(a);
	if (pointDiff !== 0) return pointDiff;

	const workoutDiff = Number(b.workouts ?? 0) - Number(a.workouts ?? 0);
	if (workoutDiff !== 0) return workoutDiff;

	return Number(b.streak ?? 0) - Number(a.streak ?? 0);
}
