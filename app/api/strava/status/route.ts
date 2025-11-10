import { NextRequest, NextResponse } from "next/server";
import { getTokensForPlayer } from "@/lib/stravaStore";
import { fetchRecentActivities } from "@/lib/strava";

export async function GET(req: NextRequest) {
	const { searchParams } = new URL(req.url);
	const playerId = searchParams.get("playerId");
	if (!playerId) {
		return NextResponse.json({ error: "Missing playerId" }, { status: 400 });
	}
	const tokens = getTokensForPlayer(playerId);
	if (!tokens) {
		return NextResponse.json({ connected: false, reason: "no_tokens" }, { status: 200 });
	}
	try {
		const activities = await fetchRecentActivities(tokens.accessToken);
		return NextResponse.json({
			connected: true,
			activityCount: Array.isArray(activities) ? activities.length : 0
		});
	} catch (e) {
		console.error("status check failed", e);
		return NextResponse.json({ connected: false, reason: "fetch_failed" }, { status: 200 });
	}
}


