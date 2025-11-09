// In a real implementation, compute from activity dates.
export function calculateStreakFromActivities(activities: unknown[]): number {
	// Example approach:
	// - Sort activities by date descending
	// - Count consecutive days/weeks meeting criteria
	return Array.isArray(activities) ? Math.min(7, activities.length) : 0;
}

export function calculateTotalWorkouts(activities: unknown[]): number {
	return Array.isArray(activities) ? activities.length : 0;
}


