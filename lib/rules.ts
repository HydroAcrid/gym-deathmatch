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


