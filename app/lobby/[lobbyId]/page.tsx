import { LobbySwitcher } from "@/components/LobbySwitcher";
import type { Metadata } from "next";
import type { Lobby } from "@/types/game";

export default async function LobbyPage({
	params
}: {
	params: Promise<{ lobbyId: string }>;
}) {
	const { lobbyId } = await params;
	// Do not read lobby/player rows with service role in SSR.
	// The client fetches authenticated live data via /api/lobby/[id]/live.
	const nowIso = new Date().toISOString();
	const lobby: Lobby = {
		id: lobbyId,
		name: "Lobby",
		players: [],
		seasonNumber: 1,
		seasonStart: nowIso,
		seasonEnd: nowIso,
		cashPool: 0,
		weeklyTarget: 3,
		initialLives: 3,
		initialPot: 0,
		weeklyAnte: 10,
		scalingEnabled: false,
		perPlayerBoost: 0,
		status: "pending",
		stage: "PRE_STAGE",
		mode: "MONEY_SURVIVAL",
		challengeSettings: null,
		seasonSummary: null,
		inviteEnabled: true,
		inviteExpiresAt: null,
		inviteTokenRequired: true
	};
	return <LobbySwitcher lobby={lobby} />;
}

export async function generateMetadata({ params }: { params: Promise<{ lobbyId: string }> }): Promise<Metadata> {
	await params;
	const base = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
	const desc = "Join the Deathmatch and put your money where your mouth is.";
	const title = "Gym Deathmatch";
	const image = `${base}/icon-512.png`;
	const url = `${base}/lobbies`;
	return {
		title,
		description: desc,
		openGraph: {
			title,
			description: desc,
			type: "website",
			images: [{ url: image, width: 1200, height: 630 }],
			url
		},
		twitter: {
			card: "summary_large_image",
			title,
			description: desc,
			images: [image]
		}
	};
}
