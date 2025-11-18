// Activities are Strava activity objects (we only care about start_date)
type Activity = { start_date?: string; start_date_local?: string };

function toDate(activity: Activity): Date | null {
	const iso = activity.start_date_local ?? activity.start_date;
	if (!iso) return null;
	const d = new Date(iso);
	return Number.isNaN(d.getTime()) ? null : d;
}

function onlySeason(activities: Activity[], seasonStart?: string, seasonEnd?: string): Activity[] {
	if (!seasonStart && !seasonEnd) return activities;
	const start = seasonStart ? new Date(seasonStart) : undefined;
	const end = seasonEnd ? new Date(seasonEnd) : undefined;
	return activities.filter((a) => {
		const d = toDate(a);
		if (!d) return false;
		if (start && d < start) return false;
		if (end && d > end) return false;
		return true;
	});
}

export function calculateTotalWorkouts(activities: Activity[], seasonStart?: string, seasonEnd?: string): number {
	const list = onlySeason(activities, seasonStart, seasonEnd);
	return list.length;
}

export function calculateAverageWorkoutsPerWeek(activities: Activity[], seasonStart?: string, seasonEnd?: string): number {
	const list = onlySeason(activities, seasonStart, seasonEnd);
	if (!seasonStart) return list.length; // fallback if no season info
	const start = new Date(seasonStart);
	const end = seasonEnd ? new Date(seasonEnd) : new Date();
	const ms = Math.max(1, end.getTime() - start.getTime());
	const weeks = ms / (1000 * 60 * 60 * 24 * 7);
	return list.length / weeks;
}

export function calculateStreakFromActivities(activities: Activity[], seasonStart?: string, seasonEnd?: string): number {
	// Current-day streak based on consecutive calendar days with at least one workout.
	// Normalize all dates to UTC midnight for consistent comparison
	const list = onlySeason(activities, seasonStart, seasonEnd)
		.map((a) => toDate(a))
		.filter((d): d is Date => !!d)
		.map((d) => {
			// Convert to UTC date components to avoid timezone issues
			const utcYear = d.getUTCFullYear();
			const utcMonth = d.getUTCMonth();
			const utcDate = d.getUTCDate();
			return new Date(Date.UTC(utcYear, utcMonth, utcDate)).getTime();
		});
	const uniqueDays = Array.from(new Set(list)).sort((a, b) => b - a);
	if (uniqueDays.length === 0) return 0;
	// Use UTC for "today" to match activity date normalization
	const today = new Date();
	const todayMid = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())).getTime();
	let streak = 0;
	let expected = todayMid;
	for (const day of uniqueDays) {
		if (day === expected) {
			streak += 1;
			expected -= 24 * 60 * 60 * 1000;
		} else if (day > expected) {
			// skip extra workouts same day or later same-day adjustments
			continue;
		} else {
			break;
		}
	}
	return streak;
}

export function calculateLongestStreak(activities: Activity[], seasonStart?: string, seasonEnd?: string): number {
	const list = onlySeason(activities, seasonStart, seasonEnd)
		.map((a) => toDate(a))
		.filter((d): d is Date => !!d)
		.map((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime());
	const days = Array.from(new Set(list)).sort((a, b) => a - b); // ascending
	if (days.length === 0) return 0;
	let best = 1;
	let cur = 1;
	for (let i = 1; i < days.length; i++) {
		const prev = days[i - 1];
		const next = days[i];
		if (next - prev === 24 * 60 * 60 * 1000) {
			cur += 1;
			if (cur > best) best = cur;
		} else {
			cur = 1;
		}
	}
	return best;
}


