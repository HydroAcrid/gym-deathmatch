import { getServerSupabase } from "@/lib/supabaseClient";
import { logError } from "@/lib/logger";
import type { LiveLobbyResponse } from "@/types/api";
import type { Lobby, LobbyStage, Player, SeasonSummary, GameMode } from "@/types/game";
import { computeProjectedPot, projectKoTransition, resolveStageProjection } from "@/domains/lobby/services/feedProjectionService";
import { hydrateLobbyPlayers, prefetchManualActivities } from "@/domains/lobby/services/playerStatsService";
import { generateSeasonSummary } from "@/domains/lobby/services/seasonSummaryService";

type SeasonStatus = "pending" | "scheduled" | "transition_spin" | "active" | "completed";

type LobbyRow = {
	id: string;
	name: string;
	season_number: number | null;
	season_start: string | null;
	season_end: string | null;
	cash_pool: number | null;
	initial_pot: number | null;
	weekly_ante: number | null;
	scaling_enabled: boolean | null;
	per_player_boost: number | null;
	weekly_target: number | null;
	initial_lives: number | null;
	owner_id: string | null;
	owner_user_id: string | null;
	mode: GameMode | null;
	sudden_death_enabled: boolean | null;
	challenge_settings: Lobby["challengeSettings"] | null;
	invite_enabled: boolean | null;
	invite_expires_at: string | null;
	invite_token_required: boolean | null;
	status: SeasonStatus | null;
	stage: LobbyStage | null;
	scheduled_start: string | null;
	season_summary: SeasonSummary | null;
};

type PlayerRow = {
	id: string;
	name: string;
	avatar_url: string | null;
	location: string | null;
	user_id: string | null;
	quip: string | null;
	sudden_death: boolean | null;
};

type ReadyRow = {
	user_id: string;
	ready: boolean | null;
};

export type GetLobbySnapshotInput = {
	lobbyId: string;
	debugMode?: boolean;
	requestTimezoneOffsetMinutes?: number;
};

function fallbackSeasonEnd(seasonStart: string | null): string {
	const start = seasonStart ? new Date(seasonStart).getTime() : Date.now();
	return new Date(start + 14 * 24 * 60 * 60 * 1000).toISOString();
}

function toLobbyAndPlayers(input: {
	lobbyId: string;
	row: LobbyRow;
	playerRows: PlayerRow[];
	readyRows: ReadyRow[];
}): {
	lobby: Lobby;
	players: Player[];
	userIdByPlayer: Record<string, string | null>;
	seasonStartRaw: string | null;
	rawStatus?: SeasonStatus;
	rawStage: LobbyStage | null;
} {
	const readyByUser: Record<string, boolean> = {};
	for (const row of input.readyRows) {
		readyByUser[row.user_id] = !!row.ready;
	}

	const userIdByPlayer: Record<string, string | null> = {};
	const players: Player[] = input.playerRows.map((row) => {
		userIdByPlayer[row.id] = row.user_id ?? null;
		return {
			id: row.id,
			name: row.name,
			avatarUrl: row.avatar_url ?? "",
			location: row.location ?? "",
			userId: row.user_id ?? undefined,
			currentStreak: 0,
			longestStreak: 0,
			livesRemaining: input.row.initial_lives ?? 3,
			totalWorkouts: 0,
			averageWorkoutsPerWeek: 0,
			quip: row.quip ?? "",
			isStravaConnected: false,
			inSuddenDeath: !!row.sudden_death,
			ready: row.user_id ? !!readyByUser[row.user_id] : false,
		};
	});

	const lobby: Lobby = {
		id: input.lobbyId,
		name: input.row.name,
		players,
		seasonNumber: input.row.season_number ?? 1,
		seasonStart: input.row.season_start ?? input.row.scheduled_start ?? new Date().toISOString(),
		seasonEnd: input.row.season_end ?? fallbackSeasonEnd(input.row.season_start),
		cashPool: input.row.cash_pool ?? 0,
		initialPot: input.row.initial_pot ?? 0,
		weeklyAnte: input.row.weekly_ante ?? 10,
		scalingEnabled: !!input.row.scaling_enabled,
		perPlayerBoost: input.row.per_player_boost ?? 0,
		weeklyTarget: input.row.weekly_target ?? 3,
		initialLives: input.row.initial_lives ?? 3,
		ownerId: input.row.owner_id ?? undefined,
		ownerUserId: input.row.owner_user_id ?? undefined,
		mode: input.row.mode ?? "MONEY_SURVIVAL",
		suddenDeathEnabled: !!input.row.sudden_death_enabled,
		challengeSettings: input.row.challenge_settings ?? null,
		inviteEnabled: input.row.invite_enabled !== false,
		inviteExpiresAt: input.row.invite_expires_at ?? null,
		inviteTokenRequired: input.row.invite_token_required === true,
		status: input.row.status ?? "active",
		stage:
			input.row.stage ??
			(input.row.status === "completed"
				? "COMPLETED"
				: input.row.status === "active" || input.row.status === "transition_spin"
					? "ACTIVE"
					: "PRE_STAGE"),
		seasonSummary: input.row.season_summary ?? null,
	};

	return {
		lobby,
		players,
		userIdByPlayer,
		seasonStartRaw: input.row.season_start ?? null,
		rawStatus: input.row.status ?? "active",
		rawStage: input.row.stage ?? null,
	};
}

function applyScheduledAutostart(input: {
	status?: SeasonStatus;
	stage: LobbyStage | null;
	mode: string;
	scheduledStart?: string | null;
	nowMs?: number;
}): { status?: SeasonStatus; stage: LobbyStage | null } {
	if (input.status !== "scheduled" || !input.scheduledStart) {
		return { status: input.status, stage: input.stage };
	}
	const nowMs = input.nowMs ?? Date.now();
	const scheduledMs = new Date(input.scheduledStart).getTime();
	if (!Number.isFinite(scheduledMs) || scheduledMs > nowMs) {
		return { status: input.status, stage: input.stage };
	}
	const nextStatus: SeasonStatus = String(input.mode).startsWith("CHALLENGE_ROULETTE") ? "transition_spin" : "active";
	return { status: nextStatus, stage: "ACTIVE" };
}

export const LiveSnapshotService = {
	readRequestTimezoneOffsetMinutes(req: Request): number | undefined {
		const raw = req.headers.get("x-timezone-offset-minutes");
		if (!raw) return undefined;
		const parsed = Number(raw);
		if (!Number.isFinite(parsed)) return undefined;
		const rounded = Math.round(parsed);
		if (rounded < -840 || rounded > 840) return undefined;
		return rounded;
	},

	async getLobbySnapshot(input: GetLobbySnapshotInput): Promise<LiveLobbyResponse | null> {
		const supabase = getServerSupabase();
		if (!supabase) return null;

		try {
			const { data: lobbyRaw } = await supabase.from("lobby").select("*").eq("id", input.lobbyId).single();
			if (!lobbyRaw) return null;

			const { data: playerRaw } = await supabase
				.from("player")
				.select("id,name,avatar_url,location,user_id,quip,sudden_death")
				.eq("lobby_id", input.lobbyId);
			const { data: readyRaw } = await supabase
				.from("user_ready_states")
				.select("user_id,ready")
				.eq("lobby_id", input.lobbyId);

			const base = toLobbyAndPlayers({
				lobbyId: input.lobbyId,
				row: lobbyRaw as LobbyRow,
				playerRows: (playerRaw ?? []) as PlayerRow[],
				readyRows: (readyRaw ?? []) as ReadyRow[],
			});

			const autoStarted = applyScheduledAutostart({
				status: base.rawStatus,
				stage: base.rawStage,
				mode: String(base.lobby.mode ?? "MONEY_SURVIVAL"),
				scheduledStart: (lobbyRaw as LobbyRow).scheduled_start,
			});

			const stageProjection = resolveStageProjection({
				rawStatus: autoStarted.status,
				rawStage: autoStarted.stage,
				seasonEndIso: base.lobby.seasonEnd,
			});

			const weeklyTarget = base.lobby.weeklyTarget ?? 3;
			const initialLives = base.lobby.initialLives ?? 3;
			const manual = await prefetchManualActivities(input.lobbyId);

			const hydrated = await hydrateLobbyPlayers({
				lobby: base.lobby,
				lobbyId: input.lobbyId,
				players: base.players,
				userIdByPlayer: base.userIdByPlayer,
				seasonStart: base.seasonStartRaw ?? undefined,
				seasonEnd: base.lobby.seasonEnd,
				stage: stageProjection.stage,
				seasonStatus: stageProjection.seasonStatus,
				weeklyTarget,
				initialLives,
				requestTimezoneOffsetMinutes: input.requestTimezoneOffsetMinutes,
				debugMode: input.debugMode,
				manualByPlayer: manual.manualByPlayer,
				manualByUser: manual.manualByUser,
			});

			const currentPot = await computeProjectedPot(base.lobby, hydrated.updatedPlayers);
			const koProjection = projectKoTransition({
				seasonStatus: stageProjection.seasonStatus,
				mode: String(base.lobby.mode ?? "MONEY_SURVIVAL"),
				players: hydrated.updatedPlayers,
				currentPot,
			});

			const finalStageProjection = resolveStageProjection({
				rawStatus: koProjection.seasonStatus,
				rawStage: null,
				seasonEndIso: base.lobby.seasonEnd,
			});

			let seasonSummary = base.lobby.seasonSummary ?? null;
			if (finalStageProjection.stage === "COMPLETED" && !seasonSummary) {
				seasonSummary = generateSeasonSummary(
					hydrated.updatedPlayers,
					(base.lobby.mode ?? "MONEY_SURVIVAL") as GameMode,
					currentPot,
					base.lobby.seasonNumber
				);
			}

			const live: LiveLobbyResponse = {
				lobby: {
					...base.lobby,
					status: finalStageProjection.seasonStatus ?? base.lobby.status ?? "active",
					stage: finalStageProjection.stage,
					cashPool: currentPot,
					players: hydrated.updatedPlayers,
					seasonSummary,
				},
				fetchedAt: new Date().toISOString(),
				errors: hydrated.errors.length ? hydrated.errors : undefined,
				seasonStatus: finalStageProjection.seasonStatus,
				stage: finalStageProjection.stage,
				seasonSummary,
				koEvent: koProjection.koEvent,
			};

			if (input.debugMode) {
				(live as LiveLobbyResponse & { debug?: unknown }).debug = {
					seasonStart: base.lobby.seasonStart,
					players: hydrated.debugRecords,
				};
				try {
					console.log("[/live debug]", JSON.stringify((live as LiveLobbyResponse & { debug?: unknown }).debug, null, 2));
				} catch {
					// Ignore debug logging serialization errors.
				}
			}

			return live;
		} catch (err) {
			logError({
				route: "LiveSnapshotService.getLobbySnapshot",
				code: "LIVE_SNAPSHOT_BUILD_FAILED",
				err,
				lobbyId: input.lobbyId,
			});
			return null;
		}
	},
};

