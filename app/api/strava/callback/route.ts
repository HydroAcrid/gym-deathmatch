import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForToken } from "@/lib/strava";
import { setTokensForPlayer } from "@/lib/stravaStore";

export async function GET(req: NextRequest) {
	const url = new URL(req.url);
	const code = url.searchParams.get("code");
	const stateParam = url.searchParams.get("state");
	if (!code || !stateParam) {
		return NextResponse.json({ error: "Missing code or state" }, { status: 400 });
	}
	let playerId = "";
	try {
		const state = JSON.parse(stateParam);
		playerId = state.playerId as string;
	} catch {
		return NextResponse.json({ error: "Invalid state" }, { status: 400 });
	}
	try {
		const tokens = await exchangeCodeForToken(code);
		setTokensForPlayer(playerId, tokens);
		console.log("Strava connected for player", playerId);
	} catch (e) {
		console.error("Callback error", e);
		// Continue redirecting to lobby even if token exchange fails, to keep UX flowing
	}
	// Redirect to default lobby for now; in multi-lobby, store lobby ID in state too.
	const lobbyId = "kevin-nelly";
	return NextResponse.redirect(`/lobby/${lobbyId}?stravaConnected=1&playerId=${encodeURIComponent(playerId)}`, {
		status: 302
	});
}


