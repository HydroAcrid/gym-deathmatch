import { redirect } from "next/navigation";

export default async function JoinLobbyPage({ params }: { params: Promise<{ lobbyId: string }> }) {
	const { lobbyId } = await params;
	redirect(`/onboard/${encodeURIComponent(lobbyId)}`);
}
