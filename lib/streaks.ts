// Activities are Strava activity objects (we only care about start_date)
type Activity = { start_date?: string; start_date_local?: string; date?: string; startDate?: string; start_date_local_string?: string };

function toDate(activity: Activity): Date | null {
	const iso = activity.start_date_local ?? activity.start_date ?? activity.date ?? activity.startDate ?? activity.start_date_local_string;
	if (!iso) return null;
	const d = new Date(iso);
	return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Infers timezone offset in minutes from activities that have both UTC and local timestamps.
 * Strava activities have both start_date (UTC) and start_date_local (local timezone).
 * Manual activities may only have a date field (UTC), but if there are Strava activities,
 * we can infer the offset from those and apply it to all activities.
 * Returns 0 if no offset can be inferred.
 */
function inferOffsetMinutesFromActivities(activities: Activity[]): number {
	// First, try to find a Strava activity with both UTC and local timestamps
	for (const a of activities) {
		// Strava activities have both start_date (UTC) and start_date_local (local)
		// AND they should be different (not just the same UTC value copied)
		if (a.start_date && a.start_date_local && a.start_date !== a.start_date_local) {
			const utc = new Date(a.start_date);
			const local = new Date(a.start_date_local);
			if (!Number.isNaN(utc.getTime()) && !Number.isNaN(local.getTime())) {
				// Calculate offset: local - UTC in minutes
				const offsetMs = local.getTime() - utc.getTime();
				const offsetMinutes = Math.round(offsetMs / 60000);
				// Round to nearest 15 minutes to avoid fractional issues
				return Math.round(offsetMinutes / 15) * 15;
			}
		}
	}
	// Default to 0 (UTC) if we can't infer (e.g., only manual activities with no Strava data)
	return 0;
}

/**
 * Creates a day key (YYYY-MM-DD) for a date using a timezone offset.
 * The offset is applied to shift the date into the athlete's local timezone before extracting the day.
 */
function makeDayKey(date: Date, offsetMinutes: number): string {
	// Shift by offset, then use UTC components to get YYYY-MM-DD
	const shifted = new Date(date.getTime() + offsetMinutes * 60_000);
	const y = shifted.getUTCFullYear();
	const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
	const d = String(shifted.getUTCDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
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

export function calculateStreakFromActivities(
	activities: Activity[],
	seasonStart?: string,
	seasonEnd?: string,
	options?: { now?: Date; timezoneOffsetMinutes?: number }
): number {
	if (!activities || activities.length === 0) return 0;

	const now = options?.now ?? new Date();
	const list = onlySeason(activities, seasonStart, seasonEnd);
	
	// Infer timezone offset from activities if not provided
	const inferredOffset = inferOffsetMinutesFromActivities(list);
	const offsetMinutes = options?.timezoneOffsetMinutes ?? inferredOffset;

	// Build a Set of dayKeys where at least one activity exists
	const daysWithActivity = new Set<string>();
	for (const a of list) {
		const raw =
			a.start_date_local ??
			a.start_date ??
			a.date ??
			a.startDate ??
			a.start_date_local_string ??
			null;

		if (!raw) continue;
		const d = new Date(raw);
		if (Number.isNaN(d.getTime())) continue;

		daysWithActivity.add(makeDayKey(d, offsetMinutes));
	}

	if (daysWithActivity.size === 0) return 0;

	// Walk backwards from today, counting contiguous days with activities
	let streak = 0;
	let currentDate = new Date(now.getTime());

	while (true) {
		const key = makeDayKey(currentDate, offsetMinutes);
		if (!daysWithActivity.has(key)) break;
		streak++;
		// Move one day back in LOCAL time (using the offset)
		currentDate = new Date(currentDate.getTime() - 24 * 60 * 60 * 1000);
	}

	return streak;
}

export function calculateLongestStreak(
	activities: Activity[],
	seasonStart?: string,
	seasonEnd?: string,
	options?: { timezoneOffsetMinutes?: number }
): number {
	if (!activities || activities.length === 0) return 0;

	const list = onlySeason(activities, seasonStart, seasonEnd);
	
	// Infer timezone offset from activities if not provided
	const inferredOffset = inferOffsetMinutesFromActivities(list);
	const offsetMinutes = options?.timezoneOffsetMinutes ?? inferredOffset;

	// Build a Set of dayKeys where at least one activity exists
	const daysWithActivity = new Set<string>();
	for (const a of list) {
		const raw =
			a.start_date_local ??
			a.start_date ??
			a.date ??
			a.startDate ??
			a.start_date_local_string ??
			null;

		if (!raw) continue;
		const d = new Date(raw);
		if (Number.isNaN(d.getTime())) continue;

		daysWithActivity.add(makeDayKey(d, offsetMinutes));
	}

	if (daysWithActivity.size === 0) return 0;

	// Convert dayKeys to sorted array of timestamps for consecutive day checking
	// We'll parse the YYYY-MM-DD strings back to dates for comparison
	const dayTimestamps = Array.from(daysWithActivity)
		.map(key => {
			// Parse YYYY-MM-DD back to a date at midnight in the shifted timezone
			const [y, m, d] = key.split('-').map(Number);
			// Create a date at midnight UTC, then subtract offset to get the actual local midnight
			const utcMidnight = Date.UTC(y, m - 1, d);
			return utcMidnight - (offsetMinutes * 60_000);
		})
		.sort((a, b) => a - b); // ascending

	if (dayTimestamps.length === 0) return 0;

	let best = 1;
	let cur = 1;
	for (let i = 1; i < dayTimestamps.length; i++) {
		const prev = dayTimestamps[i - 1];
		const next = dayTimestamps[i];
		// Check if days are consecutive (exactly 24 hours apart, with some tolerance for rounding)
		const diff = next - prev;
		const oneDay = 24 * 60 * 60 * 1000;
		if (diff >= oneDay - 1000 && diff <= oneDay + 1000) {
			cur += 1;
			if (cur > best) best = cur;
		} else {
			cur = 1;
		}
	}
	return best;
}

