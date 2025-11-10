import type { ActivitySummary } from "@/types/game";

export function getActivityNickname(a: ActivitySummary): string {
	const t = a.type?.toLowerCase() || "";
	const night = a.isNight ? "night" : a.isMorning ? "morning" : "";
	const base = t.includes("run") ? "Run" :
		t.includes("ride") ? "Ride" :
		t.includes("bike") ? "Ride" :
		t.includes("swim") ? "Swim" :
		t.includes("hike") ? "Hike" :
		t.includes("walk") ? "Walk" : "Session";
	if (night) return `${capitalize(night)} ${base}`;
	return base;
}

export function getPlayerBadges(activities: ActivitySummary[]): string[] {
	const badges: string[] = [];
	const early = activities.some(a => a.isMorning && hour(a.startDate) < 7);
	const late = activities.some(a => a.isNight);
	const longest = maxBy(activities, a => a.durationMinutes);
	const climbing = activities.some(a => includesAny(a.name.toLowerCase(), ["hill", "mountain", "elevation"]));
	if (early) badges.push("🏆 Early Bird");
	if (late) badges.push("🌙 Night Owl");
	if (longest && longest.durationMinutes >= 60) badges.push("🚀 Longest Session");
	if (climbing) badges.push("🏔️ Mountain Goat");
	return badges.slice(0, 3);
}

export function getTauntMessage(aStats: { totalMinutes: number }, bStats: { totalMinutes: number }): string {
	if (aStats.totalMinutes > bStats.totalMinutes + 30) return "Pulling ahead ⛽";
	if (bStats.totalMinutes > aStats.totalMinutes + 30) return "Chasing hard 🔥";
	return "Neck and neck 👀";
}

export function oneLinerFromActivity(playerName: string, a: ActivitySummary): string {
	const nick = getActivityNickname(a);
	const nightEmoji = a.isNight ? " 🌙" : a.isMorning ? " ☀️" : "";
	return `${playerName} clocked a ${a.durationMinutes}-min ${nick}${nightEmoji} — ${a.name}`;
}

export function summarizeTypesThisWeek(activities: ActivitySummary[]): string {
	const set = new Set(activities.map(a => (a.type || "Other").toLowerCase()));
	return `trained in ${set.size} unique categories this week.`;
}

function hour(iso: string) { return new Date(iso).getHours(); }
function maxBy<T>(arr: T[], sel: (x: T)=>number) { return arr.reduce((m, x) => sel(x) > (m?sel(m):-Infinity) ? x : m, null as any); }
function includesAny(hay: string, needles: string[]) { return needles.some(n => hay.includes(n)); }
function capitalize(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }


