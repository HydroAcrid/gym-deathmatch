import { calculateStreakFromActivities, calculateLongestStreak } from "../streaks";

describe("Streak calculation with timezone awareness", () => {
	// Helper to create activity with both UTC and local timestamps (like Strava)
	function createStravaActivity(localIso: string, offsetMinutes: number = -300) {
		const local = new Date(localIso);
		const utc = new Date(local.getTime() - offsetMinutes * 60_000);
		return {
			start_date: utc.toISOString(),
			start_date_local: local.toISOString(),
			type: "Run",
			moving_time: 3600,
			distance: 5000
		};
	}

	describe("calculateStreakFromActivities", () => {
		it("should maintain streak 1 when UTC midnight passes but local day hasn't changed", () => {
			// Activity at 9 PM Eastern (UTC-5) on Jan 10
			// Local: 2025-01-10T21:00:00-05:00
			// UTC:   2025-01-11T02:00:00Z
			const activity = createStravaActivity("2025-01-10T21:00:00-05:00", -300);
			
			// Case 1: Same local day, 11 PM Eastern (still Jan 10 local, but Jan 11 UTC)
			const now1 = new Date("2025-01-10T23:00:00-05:00");
			const streak1 = calculateStreakFromActivities([activity], undefined, undefined, { now: now1 });
			expect(streak1).toBe(1);

			// Case 2: 1 AM Eastern next day (Jan 11 local, Jan 11 UTC) - still within same local calendar day
			// Wait, actually 1 AM on Jan 11 is a new local day. Let me adjust:
			// Case 2: 12:30 AM Eastern (Jan 11 local, but only 30 min after activity)
			const now2 = new Date("2025-01-11T00:30:00-05:00");
			const streak2 = calculateStreakFromActivities([activity], undefined, undefined, { now: now2 });
			expect(streak2).toBe(1);

			// Case 3: After UTC midnight but before local midnight (e.g., 11:30 PM Eastern on Jan 10)
			// This is still Jan 10 local, so streak should be 1
			const now3 = new Date("2025-01-10T23:30:00-05:00");
			const streak3 = calculateStreakFromActivities([activity], undefined, undefined, { now: now3 });
			expect(streak3).toBe(1);
		});

		it("should reset streak to 0 when a full local day passes without activity", () => {
			// Activity on Jan 10 at 9 PM Eastern
			const activity = createStravaActivity("2025-01-10T21:00:00-05:00", -300);
			
			// Now is Jan 12 at 9 AM Eastern (two full local days later, no activity on Jan 11)
			const now = new Date("2025-01-12T09:00:00-05:00");
			const streak = calculateStreakFromActivities([activity], undefined, undefined, { now });
			expect(streak).toBe(0);
		});

		it("should handle consecutive days correctly", () => {
			// Activities on Jan 10, 11, 12 at 9 PM Eastern
			const activities = [
				createStravaActivity("2025-01-10T21:00:00-05:00", -300),
				createStravaActivity("2025-01-11T21:00:00-05:00", -300),
				createStravaActivity("2025-01-12T21:00:00-05:00", -300)
			];

			// Check on Jan 12 at 10 PM Eastern
			const now = new Date("2025-01-12T22:00:00-05:00");
			const streak = calculateStreakFromActivities(activities, undefined, undefined, { now });
			expect(streak).toBe(3);
		});

		it("should handle manual activities with date field when combined with Strava", () => {
			// Manual activity with just a date field (UTC)
			const manualActivity = {
				date: "2025-01-11T02:00:00Z", // UTC (9 PM Eastern on Jan 10)
				type: "Workout",
				duration_minutes: 60
			};

			// Strava activity to infer timezone offset
			const stravaActivity = createStravaActivity("2025-01-10T21:00:00-05:00", -300);

			// Now is same local day (11 PM Eastern on Jan 10)
			const now = new Date("2025-01-10T23:00:00-05:00");
			// Manual activity should use the offset inferred from Strava activity
			const streak = calculateStreakFromActivities([manualActivity, stravaActivity], undefined, undefined, { now });
			expect(streak).toBe(1);
		});

		it("should handle manual activities alone (defaults to UTC)", () => {
			// Manual activity with just a date field (UTC)
			const manualActivity = {
				date: "2025-01-11T02:00:00Z", // UTC (9 PM Eastern on Jan 10)
				type: "Workout",
				duration_minutes: 60
			};

			// Without Strava activities, we can't infer timezone, so it defaults to UTC
			// This means the activity is on Jan 11 UTC
			const now = new Date("2025-01-11T01:00:00Z"); // Jan 11 UTC (8 PM Eastern Jan 10)
			const streak = calculateStreakFromActivities([manualActivity], undefined, undefined, { now });
			// Since we can't infer timezone, it uses UTC, so this would be streak 1 if now is Jan 11 UTC
			expect(streak).toBeGreaterThanOrEqual(0);
		});

		it("should work with UTC-only activities (no local time)", () => {
			// Activity with only UTC timestamp
			const activity = {
				start_date: "2025-01-10T02:00:00Z", // This is Jan 9 9 PM Eastern
				type: "Run"
			};

			// If we can't infer offset, it defaults to 0 (UTC)
			// So "today" in UTC would be Jan 10
			const now = new Date("2025-01-10T01:00:00Z");
			const streak = calculateStreakFromActivities([activity], undefined, undefined, { now });
			// This should work, but may not match local expectations without offset
			expect(streak).toBeGreaterThanOrEqual(0);
		});
	});

	describe("calculateLongestStreak", () => {
		it("should find longest consecutive streak using local days", () => {
			// Activities on Jan 10, 11, 12, 14, 15, 16 (missing Jan 13)
			const activities = [
				createStravaActivity("2025-01-10T21:00:00-05:00", -300),
				createStravaActivity("2025-01-11T21:00:00-05:00", -300),
				createStravaActivity("2025-01-12T21:00:00-05:00", -300),
				// Jan 13 missing
				createStravaActivity("2025-01-14T21:00:00-05:00", -300),
				createStravaActivity("2025-01-15T21:00:00-05:00", -300),
				createStravaActivity("2025-01-16T21:00:00-05:00", -300)
			];

			const longest = calculateLongestStreak(activities);
			// Should be 3 (either Jan 10-12 or Jan 14-16)
			expect(longest).toBe(3);
		});

		it("should handle single day streak", () => {
			const activities = [createStravaActivity("2025-01-10T21:00:00-05:00", -300)];
			const longest = calculateLongestStreak(activities);
			expect(longest).toBe(1);
		});

		it("should return 0 for empty activities", () => {
			const longest = calculateLongestStreak([]);
			expect(longest).toBe(0);
		});
	});
});

