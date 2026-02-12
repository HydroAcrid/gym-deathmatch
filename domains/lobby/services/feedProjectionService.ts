import { computeEffectiveWeeklyAnte, weeksSince } from "@/lib/pot";
import { getServerSupabase } from "@/lib/supabaseClient";
import type { LiveLobbyResponse } from "@/types/api";
import type { Lobby, LobbyStage, Player } from "@/types/game";

type SeasonStatus = "pending" | "scheduled" | "transition_spin" | "active" | "completed";

function deriveStage(rawStatus: SeasonStatus | undefined, rawStage: LobbyStage | null): LobbyStage {
	if (rawStatus === "completed") return "COMPLETED";
	if (rawStage) return rawStage;
	if (rawStatus === "active" || rawStatus === "transition_spin") return "ACTIVE";
	return "PRE_STAGE";
}

export function resolveStageProjection(input: {
	rawStatus?: SeasonStatus;
	rawStage: LobbyStage | null;
	seasonEndIso: string;
	nowMs?: number;
}): { seasonStatus?: SeasonStatus; stage: LobbyStage } {
	const nowMs = input.nowMs ?? Date.now();
	const seasonEndTime = new Date(input.seasonEndIso).getTime();
	let seasonStatus = input.rawStatus;
	let stage = deriveStage(input.rawStatus, input.rawStage);

	if (stage === "ACTIVE" && Number.isFinite(seasonEndTime) && seasonEndTime <= nowMs) {
		seasonStatus = "completed";
		stage = "COMPLETED";
	}
	if (seasonStatus === "completed" && stage !== "COMPLETED") {
		stage = "COMPLETED";
	}

	return { seasonStatus, stage };
}

export async function computeProjectedPot(lobby: Lobby, players: Player[]): Promise<number> {
	const mode = lobby.mode || "MONEY_SURVIVAL";
	if (!String(mode).startsWith("MONEY_")) return lobby.cashPool ?? 0;

	const playerCount = players.length;
	const weeks = weeksSince(lobby.seasonStart);
	const effectiveAnte = computeEffectiveWeeklyAnte(
		{
			initialPot: lobby.initialPot ?? 0,
			weeklyAnte: lobby.weeklyAnte ?? 10,
			scalingEnabled: !!lobby.scalingEnabled,
			perPlayerBoost: lobby.perPlayerBoost ?? 0,
		},
		playerCount
	);
	void weeks;
	void effectiveAnte;

	let contributionsSum = 0;
	try {
		const supabase = getServerSupabase();
		if (supabase) {
			const { data } = await supabase
				.from("weekly_pot_contributions")
				.select("amount")
				.eq("lobby_id", lobby.id);
			contributionsSum = (data ?? []).reduce((sum, row) => {
				const amount = typeof row.amount === "number" ? row.amount : Number(row.amount ?? 0);
				return sum + (Number.isFinite(amount) ? amount : 0);
			}, 0);
		}
	} catch {
		// Keep fallback computation when contribution rows are unavailable.
	}

	if (Number.isFinite(lobby.cashPool)) return Number(lobby.cashPool);
	return (lobby.initialPot ?? 0) + contributionsSum;
}

export function projectKoTransition(input: {
	seasonStatus?: SeasonStatus;
	mode: string;
	players: Player[];
	currentPot: number;
}): { seasonStatus?: SeasonStatus; koEvent?: LiveLobbyResponse["koEvent"] } {
	const { mode, players, currentPot } = input;
	let seasonStatus = input.seasonStatus;
	let koEvent: LiveLobbyResponse["koEvent"] | undefined;

	const aliveNonSuddenDeath = players.filter((p) => p.livesRemaining > 0 && !p.inSuddenDeath);
	const zeroHeartPlayer = players.find((p) => p.livesRemaining === 0 && !p.inSuddenDeath);

	if (seasonStatus !== "active") {
		return { seasonStatus, koEvent };
	}

	if (mode === "MONEY_SURVIVAL") {
		if (zeroHeartPlayer) {
			seasonStatus = "completed";
			koEvent = { loserPlayerId: zeroHeartPlayer.id, potAtKO: currentPot };
		}
	} else if (mode === "MONEY_LAST_MAN") {
		if (aliveNonSuddenDeath.length === 1) {
			const winner = aliveNonSuddenDeath[0];
			seasonStatus = "completed";
			koEvent = { loserPlayerId: "", winnerPlayerId: winner.id, potAtKO: currentPot };
		}
	}

	return { seasonStatus, koEvent };
}
