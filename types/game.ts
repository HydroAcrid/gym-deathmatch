export type PlayerId = string;
export type LobbyId = string;

export type GameMode =
	| "MONEY_SURVIVAL"
	| "MONEY_LAST_MAN"
	| "CHALLENGE_ROULETTE"
	| "CHALLENGE_CUMULATIVE";

export type PunishmentSelection = "ROULETTE" | "VOTING" | "HOST_DECIDES";
export type SpinFrequency = "WEEKLY" | "BIWEEKLY" | "SEASON_ONLY";
export type PunishmentVisibility = "PUBLIC" | "HIDDEN_ON_FAIL";

export interface ChallengeSettings {
	selection: PunishmentSelection;
	spinFrequency: SpinFrequency;
	visibility: PunishmentVisibility;
	stackPunishments: boolean;
	allowSuggestions: boolean;
	requireLockBeforeSpin: boolean;
	autoSpinAtWeekStart: boolean;
	showLeaderboard: boolean;
	profanityFilter: boolean;
	suggestionCharLimit: number; // 10..140
}

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
	inSuddenDeath?: boolean; // UI tag only; cannot win pot
	ready?: boolean;
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
	status?: "pending" | "scheduled" | "transition_spin" | "active" | "completed";
	scheduledStart?: string | null; // ISO when status === 'scheduled'
	mode?: GameMode;
	suddenDeathEnabled?: boolean;
	challengeSettings?: ChallengeSettings | null;
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


