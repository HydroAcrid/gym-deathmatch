import { LobbySwitcher } from "@/components/LobbySwitcher";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getServerSupabase } from "@/lib/supabaseClient";
import type { Lobby, Player } from "@/types/game";

export default async function LobbyPage({
	params
}: {
	params: Promise<{ lobbyId: string }>;
}) {
	const { lobbyId } = await params;
	// DB-only lobby fetch
	try {
		const supabase = getServerSupabase();
		if (!supabase) return notFound();
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
		const lobby: Lobby = {
			id: lobbyId,
			name: lrow.name,
			players,
			seasonNumber: lrow.season_number ?? 1,
			seasonStart: lrow.season_start ?? new Date().toISOString(),
			seasonEnd: lrow.season_end ?? new Date().toISOString(),
			cashPool: lrow.cash_pool ?? 0,
			weeklyTarget: lrow.weekly_target ?? 3,
			initialLives: lrow.initial_lives ?? 3,
			initialPot: (lrow.initial_pot as number) ?? 0,
			weeklyAnte: (lrow.weekly_ante as number) ?? 10,
			scalingEnabled: !!lrow.scaling_enabled,
			perPlayerBoost: (lrow.per_player_boost as number) ?? 0,
			ownerId: lrow.owner_id ?? undefined,
			ownerUserId: lrow.owner_user_id ?? undefined,
			status: lrow.status ?? "active",
			stage: (lrow.stage as any) || (lrow.status === "completed" ? "COMPLETED" : lrow.status === "active" || lrow.status === "transition_spin" ? "ACTIVE" : "PRE_STAGE"),
			seasonSummary: lrow.season_summary ? (lrow.season_summary as any) : null,
			scheduledStart: lrow.scheduled_start ?? null,
			mode: (lrow.mode as any) || "MONEY_SURVIVAL",
			suddenDeathEnabled: !!lrow.sudden_death_enabled,
			challengeSettings: (lrow.challenge_settings as any) ?? null,
			inviteEnabled: (lrow as any).invite_enabled !== false,
			inviteExpiresAt: ((lrow as any).invite_expires_at as string | null) ?? null,
			inviteTokenRequired: (lrow as any).invite_token_required === true
		};
		return <LobbySwitcher lobby={lobby} />;
	} catch {
		return notFound();
	}
}

export async function generateMetadata({ params }: { params: Promise<{ lobbyId: string }> }): Promise<Metadata> {
	const { lobbyId } = await params;
	const base = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
	// Owner invite text
	let desc = "Join the Deathmatch and put your money where your mouth is.";
	try {
		const supabase = getServerSupabase();
		if (supabase) {
			const { data: lrow } = await supabase.from("lobby").select("owner_id,name").eq("id", lobbyId).single();
			if (lrow) {
				let owner = "Your friend";
				if (lrow.owner_id) {
					const { data: prow } = await supabase.from("player").select("name").eq("id", lrow.owner_id).maybeSingle();
					if (prow?.name) owner = prow.name;
				}
				desc = `${owner} is inviting you to the Deathmatch — ${lrow.name}.`;
			}
		}
	} catch { /* ignore */ }
	const title = "Gym Deathmatch";
	const image = `${base}/og/lobby/${encodeURIComponent(lobbyId)}`;
	const url = `${base}/onboard/${encodeURIComponent(lobbyId)}`;
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
