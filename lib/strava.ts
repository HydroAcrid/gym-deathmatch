export interface StravaTokens {
	accessToken: string;
	refreshToken: string;
	expiresAt: number; // epoch seconds
}

const STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token";
const STRAVA_ACTIVITIES_URL = "https://www.strava.com/api/v3/athlete/activities?per_page=10";

// Simple in-memory cache for recent activities to reduce API pressure
// Keyed by access token; TTL 5 minutes
const activitiesCache = new Map<string, { data: unknown[]; expiresAt: number }>();
const DEFAULT_TTL_MS = 5 * 60 * 1000;
const cooldown = new Map<string, number>(); // key -> epoch ms until we can call again

function getKey(token: string) {
	return token || "__anon__";
}

export function getCachedActivities(accessToken: string): unknown[] | null {
	const key = getKey(accessToken);
	const entry = activitiesCache.get(key);
	if (entry && entry.expiresAt > Date.now()) {
		return entry.data;
	}
	return null;
}

function setCachedActivities(accessToken: string, data: unknown[], ttlMs = DEFAULT_TTL_MS) {
	const key = getKey(accessToken);
	activitiesCache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

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
		// serve from cache if fresh
		const cached = getCachedActivities(accessToken);
		if (cached) return cached;
		// respect cooldown if recently rate-limited
		const key = getKey(accessToken);
		const until = cooldown.get(key) ?? 0;
		if (until > Date.now()) {
			const stale = getCachedActivities(accessToken);
			if (stale) return stale;
			return [];
		}

		const res = await fetch(STRAVA_ACTIVITIES_URL, {
			headers: {
				Authorization: `Bearer ${accessToken}`
			}
		});
			if (!res.ok) {
				const text = await res.text();
				console.error("Strava activities fetch failed:", res.status, text);
				const err = new Error("Failed to fetch Strava activities") as Error & { status?: number };
				err.status = res.status;
			// On 429, prefer serving stale cache if present
			if (res.status === 429) {
				// enter short cooldown
				const retryAfter = Number(res.headers.get("retry-after")) || 60;
				cooldown.set(key, Date.now() + Math.min(5 * 60, Math.max(15, retryAfter)) * 1000);
				const stale = getCachedActivities(accessToken);
				if (stale) return stale;
			}
			throw err;
		}
		const json = await res.json();
		setCachedActivities(accessToken, json);
		return json;
	} catch (err) {
		console.error("fetchRecentActivities error", err);
		// Deliver stale cache if available to avoid breaking UI
		const stale = getCachedActivities(accessToken);
		if (stale) return stale;
		return [];
	}
}

export async function refreshAccessToken(refreshToken: string): Promise<StravaTokens> {
	try {
		const clientId = process.env.STRAVA_CLIENT_ID;
		const clientSecret = process.env.STRAVA_CLIENT_SECRET;
		if (!clientId || !clientSecret) {
			throw new Error("Missing STRAVA_CLIENT_ID or STRAVA_CLIENT_SECRET");
		}
		const body = new URLSearchParams({
			client_id: String(clientId),
			client_secret: String(clientSecret),
			grant_type: "refresh_token",
			refresh_token: refreshToken
		});
		const res = await fetch(STRAVA_TOKEN_URL, {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body
		});
		if (!res.ok) {
			const text = await res.text();
			console.error("Strava token refresh failed:", res.status, text);
			throw new Error("Failed to refresh token");
		}
		const data = await res.json();
		return {
			accessToken: data.access_token,
			refreshToken: data.refresh_token ?? refreshToken,
			expiresAt: data.expires_at
		};
	} catch (e) {
		console.error("refreshAccessToken error", e);
		throw e;
	}
}

export type RawStravaActivity = {
	name: string;
	type: string;
	start_date?: string;
	start_date_local?: string;
	moving_time?: number; // seconds
	distance?: number; // meters
};

export function toActivitySummary(raw: RawStravaActivity) {
	const start = raw.start_date_local || raw.start_date || new Date().toISOString();
	const d = new Date(start);
	const hour = d.getHours();
	const durationMinutes = Math.round((raw.moving_time || 0) / 60);
	const distanceKm = Math.round(((raw.distance || 0) / 1000) * 100) / 100;
	return {
		name: raw.name || "Workout",
		type: raw.type || "Workout",
		startDate: d.toISOString(),
		durationMinutes,
		distanceKm,
		isMorning: hour >= 5 && hour <= 10,
		isNight: hour >= 20 || hour < 5
	};
}

