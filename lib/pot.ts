export interface PotConfig {
	initialPot: number;
	weeklyAnte: number;
	scalingEnabled: boolean;
	perPlayerBoost: number;
}

export function computeEffectiveWeeklyAnte(config: PotConfig, playerCount: number): number {
	const base = Number(config.weeklyAnte || 0);
	const boost = config.scalingEnabled ? Number(config.perPlayerBoost || 0) * Math.max(playerCount - 1, 0) : 0;
	return Math.max(0, base + boost);
}

export function weeksSince(startIso: string, now: Date = new Date()): number {
	const start = new Date(startIso);
	if (!startIso || Number.isNaN(start.getTime())) return 0;
	const ms = Math.max(0, now.getTime() - start.getTime());
	return Math.floor(ms / (7 * 24 * 60 * 60 * 1000));
}


