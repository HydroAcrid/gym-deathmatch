export type ActivitySource = "strava" | "manual";
export type ActivityStatus = "pending" | "approved" | "rejected";

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

export interface ManualActivity extends Activity {
	source: "manual";
	photoUrl: string;
	caption: string;
	status: ActivityStatus;
	voteDeadline: string | null;
	decidedAt?: string | null;
}


