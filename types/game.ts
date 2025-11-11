export type PlayerId = string;
export type LobbyId = string;

export interface Player {
	id: PlayerId;
	name: string;
	avatarUrl: string;
	location?: string;
	currentStreak: number;
	longestStreak: number;
	livesRemaining: number; // 0–3
	totalWorkouts: number;
	averageWorkoutsPerWeek: number;
	quip: string;
	isStravaConnected?: boolean;
}

export interface Lobby {
	id: LobbyId;
	name: string;
	players: Player[];
	seasonNumber: number;
	seasonStart: string; // ISO date
	seasonEnd: string;   // ISO date
	cashPool: number;
	weeklyTarget?: number;
	initialLives?: number;
	ownerId?: PlayerId;
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
}


