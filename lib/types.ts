export type ActivitySource = "strava" | "manual";

export interface Activity {
	id: string;
	playerId: string;
	lobbyId: string;
	date: string; // ISO
	durationMinutes: number | null;
	distanceKm: number | null;
	type: "run" | "ride" | "gym" | "walk" | "other";
	source: ActivitySource;
	notes?: string | null;
}


