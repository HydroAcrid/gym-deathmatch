type Activity = { start_date?: string; start_date_local?: string };

function toDate(activity: Activity): Date | null {
	const iso = activity.start_date_local ?? activity.start_date;
	if (!iso) return null;
	const d = new Date(iso);
	return Number.isNaN(d.getTime()) ? null : d;
}

export interface LivesConfig {
	seasonStart: string;
	seasonEnd: string;
	weeklyTarget: number;
	initialLives: number;
}

export function computeLivesAndEvents(activities: Activity[], cfg: LivesConfig): { livesRemaining: number; events: Array<{ weekStart: string; met: boolean; count: number }> } {
	const start = new Date(cfg.seasonStart);
	const end = new Date(cfg.seasonEnd);
	const normalized = activities
		.map(toDate)
		.filter((d): d is Date => !!d)
		.filter((d) => d >= start && d <= end)
		.map((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()));

	let lives = cfg.initialLives;
	const events: Array<{ weekStart: string; met: boolean; count: number }> = [];

	// Iterate week by week from season start to 'now' (bounded by season end)
	const today = new Date();
	const stop = end < today ? end : today;
	let cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());

	while (cursor <= stop) {
		const weekStart = new Date(cursor);
		const weekEnd = new Date(cursor);
		weekEnd.setDate(weekEnd.getDate() + 7);

		const count = normalized.filter((d) => d >= weekStart && d < weekEnd).length;
		const met = count >= cfg.weeklyTarget;
		if (!met && lives > 0) lives -= 1;
		events.push({ weekStart: weekStart.toISOString(), met, count });

		cursor = weekEnd;
	}
	return { livesRemaining: lives, events };
}

// New weekly hearts computation (flexible, gain/lose by week)
export interface WeeklyRuleConfig {
	weeklyTarget?: number; // default 4
	maxHearts?: number; // default 3
	seasonEnd?: Date; // optional bound
}

export interface WeeklyResult {
	heartsRemaining: number;
	weeksEvaluated: number;
	events: { weekStart: string; workouts: number; heartsLost: number; heartsGained: number }[];
}

export function computeWeeklyHearts(
	activities: Activity[],
	seasonStart: Date,
	config?: WeeklyRuleConfig
): WeeklyResult {
	const weeklyTarget = Math.max(0, config?.weeklyTarget ?? 4);
	const maxHearts = Math.max(1, config?.maxHearts ?? 3);
	const start = new Date(seasonStart.getFullYear(), seasonStart.getMonth(), seasonStart.getDate());
	const endBound = config?.seasonEnd && !Number.isNaN(config.seasonEnd.getTime())
		? new Date(config.seasonEnd.getFullYear(), config.seasonEnd.getMonth(), config.seasonEnd.getDate())
		: new Date();

	// Normalize activity dates to midnight for grouping and within bounds
	const normalized = activities
		.map(toDate)
		.filter((d): d is Date => !!d)
		.filter((d) => d >= start && d <= endBound)
		.map((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()))
		.sort((a, b) => a.getTime() - b.getTime());

	let hearts = maxHearts;
	const events: WeeklyResult["events"] = [];
	let weeksEvaluated = 0;

	let cursor = new Date(start);
	while (cursor <= endBound) {
		const weekStart = new Date(cursor);
		const weekEnd = new Date(cursor);
		weekEnd.setDate(weekEnd.getDate() + 7);

		const workouts = normalized.filter((d) => d >= weekStart && d < weekEnd).length;
		let heartsLost = 0;
		let heartsGained = 0;

		if (workouts >= weeklyTarget && weeklyTarget > 0) {
			// Regain at most 1 heart if goal met
			if (hearts < maxHearts) {
				heartsGained = 1;
				hearts += 1;
			}
		} else {
			// Lose (target - workouts), capped by available hearts and by maxHearts
			const deficit = Math.max(0, weeklyTarget - workouts);
			if (deficit > 0 && hearts > 0) {
				heartsLost = Math.min(deficit, hearts, maxHearts);
				hearts -= heartsLost;
			}
		}

		events.push({
			weekStart: weekStart.toISOString(),
			workouts,
			heartsLost,
			heartsGained
		});
		weeksEvaluated += 1;
		cursor = weekEnd;
	}

	// Clamp to [0, maxHearts]
	if (hearts < 0) hearts = 0;
	if (hearts > maxHearts) hearts = maxHearts;

	return {
		heartsRemaining: hearts,
		weeksEvaluated,
		events
	};
}


