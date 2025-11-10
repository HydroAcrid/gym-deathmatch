import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForToken } from "@/lib/strava";
import { setTokensForPlayer } from "@/lib/stravaStore";
import { ensureLobbyAndPlayers, upsertStravaTokens } from "@/lib/persistence";

export async function GET(req: NextRequest) {
	const url = new URL(req.url);
	const code = url.searchParams.get("code");
	const stateParam = url.searchParams.get("state");
	if (!code || !stateParam) {
		return NextResponse.json({ error: "Missing code or state" }, { status: 400 });
	}
	let playerId = "";
	let lobbyId = "kevin-nelly";
	try {
		const state = JSON.parse(stateParam);
		playerId = state.playerId as string;
		if (state.lobbyId) lobbyId = state.lobbyId as string;
	} catch {
		return NextResponse.json({ error: "Invalid state" }, { status: 400 });
	}
	const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
	if (!baseUrl) {
		console.error("Missing NEXT_PUBLIC_BASE_URL");
		return NextResponse.json({ error: "Missing NEXT_PUBLIC_BASE_URL" }, { status: 500 });
	}
	try {
		const tokens = await exchangeCodeForToken(code);
		setTokensForPlayer(playerId, tokens);
		// ensure lobby and both default players exist before token upsert
		await ensureLobbyAndPlayers(lobbyId);
		await upsertStravaTokens(playerId, tokens);
		console.log("Strava connected for player", playerId);
	} catch (e) {
		console.error("Callback error", e);
		// Redirect with error flag to keep UX flowing
		return NextResponse.redirect(`${baseUrl}/lobby/${lobbyId}?stravaError=1&playerId=${encodeURIComponent(playerId)}`, {
			status: 302
		});
	}
	// Redirect to default lobby for now; in multi-lobby, store lobby ID in state too.
	return NextResponse.redirect(`${baseUrl}/lobby/${lobbyId}?stravaConnected=1&playerId=${encodeURIComponent(playerId)}`, {
		status: 302
	});
}


