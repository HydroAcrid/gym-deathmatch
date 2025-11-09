import { getLobbyById } from "@/lib/lobbies";
import { LobbyLayout } from "@/components/LobbyLayout";
import { notFound } from "next/navigation";

export default async function LobbyPage({
	params
}: {
	params: Promise<{ lobbyId: string }>;
}) {
	const { lobbyId } = await params;
	const lobby = getLobbyById(lobbyId);
	if (!lobby) return notFound();
	return <LobbyLayout lobby={lobby} />;
}


