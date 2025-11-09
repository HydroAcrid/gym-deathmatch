import { redirect } from "next/navigation";
import { getDefaultLobby } from "@/lib/lobbies";

export default function Home() {
	const defaultLobby = getDefaultLobby();
	redirect(`/lobby/${defaultLobby.id}`);
}
