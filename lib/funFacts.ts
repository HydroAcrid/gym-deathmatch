export function getDailyTaunts(latestActivityDate?: Date | null, currentStreak?: number): string | null {
	const now = Date.now();
	if (currentStreak && currentStreak >= 5) {
		return `On a ${currentStreak}-day rampage 🔥`;
	}
	if (!latestActivityDate) return null;
	const diffDays = Math.floor((now - latestActivityDate.getTime()) / (24 * 60 * 60 * 1000));
	if (diffDays >= 5) return `Hasn't moved in ${diffDays} days 👀`;
	if (diffDays >= 2) return `Quiet for ${diffDays} days 👀`;
	return null;
}


