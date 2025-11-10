import { getLobbyById } from "@/lib/lobbies";
import { LobbyLayout } from "@/components/LobbyLayout";
import { notFound } from "next/navigation";
import { getServerSupabase } from "@/lib/supabaseClient";
import type { Lobby, Player } from "@/types/game";

export default async function LobbyPage({
	params
}: {
	params: Promise<{ lobbyId: string }>;
}) {
	const { lobbyId } = await params;
	let lobby = getLobbyById(lobbyId);
	if (!lobby) {
		// Try to read from Supabase so new lobbies can render
		try {
			const supabase = getServerSupabase();
			if (supabase) {
				const { data: lrow } = await supabase.from("lobby").select("*").eq("id", lobbyId).single();
				if (!lrow) return notFound();
				const { data: prows } = await supabase.from("player").select("*").eq("lobby_id", lobbyId);
				const players: Player[] = (prows ?? []).map((p: any) => ({
					id: p.id,
					name: p.name,
					avatarUrl: p.avatar_url ?? "",
					location: p.location ?? "",
					currentStreak: 0,
					longestStreak: 0,
					livesRemaining: (lrow.initial_lives as number) ?? 3,
					totalWorkouts: 0,
					averageWorkoutsPerWeek: 0,
					quip: p.quip ?? "",
					isStravaConnected: false
				}));
				lobby = {
					id: lobbyId,
					name: lrow.name,
					players,
					seasonNumber: lrow.season_number ?? 1,
					seasonStart: lrow.season_start ?? new Date().toISOString(),
					seasonEnd: lrow.season_end ?? new Date().toISOString(),
					cashPool: lrow.cash_pool ?? 0,
					weeklyTarget: lrow.weekly_target ?? 3,
					initialLives: lrow.initial_lives ?? 3,
					ownerId: lrow.owner_id ?? undefined
				} as Lobby;
			} else {
				return notFound();
			}
		} catch {
			return notFound();
		}
	}
	return <LobbyLayout lobby={lobby} />;
}


