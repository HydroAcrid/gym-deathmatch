export type LogManualActivityInput = {
	lobbyId: string;
	playerId: string;
	type: "run" | "ride" | "gym" | "walk" | "other";
	durationMinutes: number | null;
	distanceKm: number | null;
	notes: string | null;
	photoUrl: string;
	caption: string;
};

export type LogManualActivityResult = {
	activityId: string;
	createdAt: string;
};

export interface ActivityService {
	logManualActivity(input: LogManualActivityInput): Promise<LogManualActivityResult>;
}
