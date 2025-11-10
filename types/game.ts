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
}


