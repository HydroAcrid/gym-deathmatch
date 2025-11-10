export interface StravaTokens {
	accessToken: string;
	refreshToken: string;
	expiresAt: number; // epoch seconds
}

const STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token";
const STRAVA_ACTIVITIES_URL = "https://www.strava.com/api/v3/athlete/activities?per_page=10";

export async function exchangeCodeForToken(code: string): Promise<StravaTokens> {
	try {
		const clientId = process.env.STRAVA_CLIENT_ID;
		const clientSecret = process.env.STRAVA_CLIENT_SECRET;
		if (!clientId || !clientSecret) {
			throw new Error("Missing STRAVA_CLIENT_ID or STRAVA_CLIENT_SECRET");
		}

		const body = new URLSearchParams({
			client_id: String(clientId),
			client_secret: String(clientSecret),
			code,
			grant_type: "authorization_code"
		});

		const res = await fetch(STRAVA_TOKEN_URL, {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded"
			},
			body
		});
		if (!res.ok) {
			const text = await res.text();
			console.error("Strava token exchange failed:", res.status, text);
			throw new Error("Failed to exchange Strava code for token");
		}
		const data = await res.json();
		return {
			accessToken: data.access_token,
			refreshToken: data.refresh_token,
			expiresAt: data.expires_at
		};
	} catch (err) {
		console.error("exchangeCodeForToken error", err);
		throw err;
	}
}

export async function fetchRecentActivities(accessToken: string): Promise<unknown[]> {
	try {
		const res = await fetch(STRAVA_ACTIVITIES_URL, {
			headers: {
				Authorization: `Bearer ${accessToken}`
			}
		});
		if (!res.ok) {
			const text = await res.text();
			console.error("Strava activities fetch failed:", res.status, text);
			throw new Error("Failed to fetch Strava activities");
		}
		return await res.json();
	} catch (err) {
		console.error("fetchRecentActivities error", err);
		return [];
	}
}


