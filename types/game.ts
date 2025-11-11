export type PlayerId = string;
export type LobbyId = string;

export interface Player {
	id: PlayerId;
	name: string;
	avatarUrl: string;
	location?: string;
	userId?: string; // auth user id when available
	currentStreak: number;
	longestStreak: number;
	livesRemaining: number; // 0–3
	totalWorkouts: number;
	averageWorkoutsPerWeek: number;
	quip: string;
	isStravaConnected?: boolean;
	weeklyTarget?: number;
	heartsTimeline?: { weekStart: string; workouts: number; heartsLost: number; heartsGained: number }[];
	taunt?: string | null;
}

export interface Lobby {
	id: LobbyId;
	name: string;
	players: Player[];
	seasonNumber: number;
	seasonStart: string; // ISO date
	seasonEnd: string;   // ISO date
	cashPool: number;
	initialPot?: number;
	weeklyAnte?: number;
	scalingEnabled?: boolean;
	perPlayerBoost?: number;
	weeklyTarget?: number;
	initialLives?: number;
	ownerId?: PlayerId;
	ownerUserId?: string; // Supabase auth user id of lobby owner
	status?: "pending" | "scheduled" | "active" | "completed";
	scheduledStart?: string | null; // ISO when status === 'scheduled'
}

export interface ActivitySummary {
	name: string;
	type: string;
	startDate: string; // ISO
	durationMinutes: number;
	distanceKm: number;
	isMorning: boolean;
	isNight: boolean;
	source?: "strava" | "manual";
}


