import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
	const { searchParams } = new URL(req.url);
	const playerId = searchParams.get("playerId");
	const lobbyId = searchParams.get("lobbyId") ?? "kevin-nelly";
	if (!playerId) {
		return NextResponse.json({ error: "Missing playerId" }, { status: 400 });
	}

	const clientId = process.env.STRAVA_CLIENT_ID;
	const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
	if (!clientId || !baseUrl) {
		return NextResponse.json({ error: "Missing STRAVA_CLIENT_ID or NEXT_PUBLIC_BASE_URL" }, { status: 500 });
	}

	const redirectUri = `${baseUrl}/api/strava/callback`;
	const authorizeUrl = new URL("https://www.strava.com/oauth/authorize");
	authorizeUrl.searchParams.set("client_id", clientId);
	authorizeUrl.searchParams.set("response_type", "code");
	authorizeUrl.searchParams.set("redirect_uri", redirectUri);
	authorizeUrl.searchParams.set("approval_prompt", "auto");
	authorizeUrl.searchParams.set("scope", "read,activity:read_all");
	authorizeUrl.searchParams.set("state", JSON.stringify({ playerId, lobbyId }));

	return NextResponse.redirect(authorizeUrl.toString(), { status: 302 });
}


