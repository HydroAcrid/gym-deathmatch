import type { LobbyStage } from "@/types/game";
import type { AthleteHeartStatus } from "@/src/ui2/components/HeartsStatusBoard";
import type { Standing } from "@/src/ui2/components/Standings";

export type ArenaSeasonStatus = "pending" | "scheduled" | "transition_spin" | "active" | "completed" | null | undefined;

export type ArenaStageCode = "PRE_STAGE" | "ACTIVE" | "COMPLETED";

export type ArenaStageBadgeTone = "muted" | "primary" | "neutral";

export interface ArenaStageBadge {
	code: ArenaStageCode;
	label: "PRE-STAGE" | "ACTIVE" | "COMPLETED";
	tone: ArenaStageBadgeTone;
}

export interface ArenaStandingsPreviewEntry {
	athleteId?: string;
	athleteName: string;
	rank: number;
	points: number;
	workouts: number;
	streak: number;
	isCurrentUser: boolean;
}

export interface ArenaMyPlayerSummary {
	athleteId: string;
	name: string;
	rank: number | null;
	points: number | null;
	hearts: number;
	maxHearts: number;
	weeklyProgress: number;
	weeklyTarget: number;
	workouts: number;
	streak: number;
}

export interface ArenaWeekSummary {
	currentWeek: number;
	totalWeeks: number;
	progressPercent: number;
	timeRemaining: string;
}

export interface ArenaPotSummary {
	amount: number;
	weeklyAnte: number;
}

export interface ArenaChallengePunishmentSummary {
	text: string;
	week?: number | null;
	submittedByName?: string | null;
	submittedByAvatarUrl?: string | null;
}

export interface ArenaCommandCenterVM {
	currentLobby: {
		id: string;
		name: string;
	};
	seasonNumber: number;
	modeLabel: string;
	hostName: string;
	athleteCount: number;
	stageBadge: ArenaStageBadge;
	challengePunishment: ArenaChallengePunishmentSummary | null;
	myPlayerSummary: ArenaMyPlayerSummary | null;
	standingsPreview: {
		top: ArenaStandingsPreviewEntry[];
		myRank: ArenaStandingsPreviewEntry | null;
		totalAthletes: number;
	};
	weekSummary: ArenaWeekSummary;
	potSummary: ArenaPotSummary | null;
}

export interface ArenaCommandCenterInput {
	lobbyId: string;
	lobbyName: string;
	seasonNumber: number;
	stage?: LobbyStage | null;
	seasonStatus?: ArenaSeasonStatus;
	mode?: string | null;
	modeLabel?: string | null;
	hostName?: string | null;
	athleteCount?: number | null;
	challengePunishment?: ArenaChallengePunishmentSummary | null;
	myPlayerId?: string | null;
	myPlayerName?: string | null;
	standings: Standing[];
	hearts: AthleteHeartStatus[];
	currentWeek: number;
	totalWeeks: number;
	weekEndDate: Date;
	potAmount: number;
	weeklyAnte?: number;
	nowMs?: number;
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function toNumber(value: unknown, fallback = 0): number {
	const n = Number(value);
	return Number.isFinite(n) ? n : fallback;
}

export function resolveArenaStageBadge(
	stage?: LobbyStage | null,
	seasonStatus?: ArenaSeasonStatus
): ArenaStageBadge {
	if (stage === "COMPLETED" || seasonStatus === "completed") {
		return { code: "COMPLETED", label: "COMPLETED", tone: "neutral" };
	}
	if (
		stage === "PRE_STAGE" ||
		seasonStatus === "pending" ||
		seasonStatus === "scheduled"
	) {
		return { code: "PRE_STAGE", label: "PRE-STAGE", tone: "muted" };
	}
	return { code: "ACTIVE", label: "ACTIVE", tone: "primary" };
}

export function computeWeekProgressPercent(
	currentWeek: number,
	totalWeeks: number,
	weekEndDate: Date,
	nowMs = Date.now()
): number {
	const weekMs = 7 * 24 * 60 * 60 * 1000;
	const weekEndMs = weekEndDate.getTime();
	if (!Number.isFinite(weekEndMs)) return 0;
	const weekStartMs = weekEndMs - weekMs;
	const weekElapsed = clamp(nowMs - weekStartMs, 0, weekMs);
	const weekFraction = weekElapsed / weekMs;
	const completedWeeks = Math.max(0, currentWeek - 1);
	return clamp(((completedWeeks + weekFraction) / Math.max(1, totalWeeks)) * 100, 0, 100);
}

export function formatTimeRemaining(targetDate: Date, nowMs = Date.now()): string {
	const targetMs = targetDate.getTime();
	if (!Number.isFinite(targetMs)) return "--";
	const diff = targetMs - nowMs;
	if (diff <= 0) return "RESETTING...";

	const days = Math.floor(diff / (1000 * 60 * 60 * 24));
	const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
	const minutes = Math.floor((diff / 1000 / 60) % 60);

	if (days > 0) return `${days}D ${hours}H`;
	if (hours > 0) return `${hours}H ${minutes}M`;
	return `${Math.max(1, minutes)}M`;
}

export function buildStandingsPreviewEntries(
	standings: Standing[],
	myPlayerId?: string | null,
	myPlayerName?: string | null
): {
	top: ArenaStandingsPreviewEntry[];
	myRank: ArenaStandingsPreviewEntry | null;
	totalAthletes: number;
} {
	const sorted = [...standings]
		.map((standing, index) => {
			const fallbackRank = toNumber(standing.rank, index + 1);
			return {
				...standing,
				rank: fallbackRank,
				points: toNumber(standing.points, 0),
				workouts: toNumber(standing.workouts, 0),
				streak: toNumber(standing.streak, 0),
			};
		})
		.sort((a, b) => {
			if (b.points !== a.points) return b.points - a.points;
			if (b.workouts !== a.workouts) return b.workouts - a.workouts;
			if (b.streak !== a.streak) return b.streak - a.streak;
			return a.athleteName.localeCompare(b.athleteName);
		});

	let tieRank = 0;
	let previousPoints: number | null = null;
	const ranked: ArenaStandingsPreviewEntry[] = sorted.map((standing, index) => {
		if (previousPoints === null || standing.points !== previousPoints) {
			tieRank = index + 1;
			previousPoints = standing.points;
		}
		const isCurrentUser =
			Boolean(myPlayerId && standing.athleteId === myPlayerId) ||
			Boolean(myPlayerName && standing.athleteName.toLowerCase() === myPlayerName.toLowerCase());
		return {
			athleteId: standing.athleteId,
			athleteName: standing.athleteName,
			rank: tieRank,
			points: standing.points,
			workouts: standing.workouts,
			streak: standing.streak,
			isCurrentUser,
		};
	});

	const myRank = ranked.find((entry) => entry.isCurrentUser) ?? null;
	const top = ranked.slice(0, 3);
	return {
		top,
		myRank,
		totalAthletes: ranked.length,
	};
}

export function buildArenaCommandCenterVM(input: ArenaCommandCenterInput): ArenaCommandCenterVM {
	const nowMs = input.nowMs ?? Date.now();
	const stageBadge = resolveArenaStageBadge(input.stage, input.seasonStatus);
	const standingsPreview = buildStandingsPreviewEntries(input.standings, input.myPlayerId, input.myPlayerName);
	const myHearts = input.myPlayerId ? input.hearts.find((athlete) => athlete.id === input.myPlayerId) : null;
	const myRankEntry = standingsPreview.myRank;
	const isChallengeRoulette = String(input.mode ?? "").startsWith("CHALLENGE_ROULETTE");
	const challengePunishment = isChallengeRoulette && input.challengePunishment?.text
		? {
			text: input.challengePunishment.text,
			week: input.challengePunishment.week ?? null,
			submittedByName: input.challengePunishment.submittedByName ?? null,
			submittedByAvatarUrl: input.challengePunishment.submittedByAvatarUrl ?? null,
		}
		: null;

	const myPlayerSummary: ArenaMyPlayerSummary | null =
		myHearts && input.myPlayerId
			? {
				athleteId: myHearts.id,
				name: myHearts.name,
				rank: myRankEntry?.rank ?? null,
				points: myRankEntry?.points ?? null,
				hearts: toNumber(myHearts.hearts, 0),
				maxHearts: Math.max(1, toNumber(myHearts.maxHearts, 3)),
				weeklyProgress: Math.max(0, toNumber(myHearts.weeklyProgress, 0)),
				weeklyTarget: Math.max(1, toNumber(myHearts.weeklyTarget, 3)),
				workouts: toNumber(myHearts.totalWorkouts, 0),
				streak: toNumber(myHearts.currentStreak, 0),
			}
			: null;

	const weekSummary: ArenaWeekSummary = {
		currentWeek: Math.max(1, toNumber(input.currentWeek, 1)),
		totalWeeks: Math.max(1, toNumber(input.totalWeeks, 1)),
		progressPercent: computeWeekProgressPercent(input.currentWeek, input.totalWeeks, input.weekEndDate, nowMs),
		timeRemaining: formatTimeRemaining(input.weekEndDate, nowMs),
	};

	const showPot = String(input.mode ?? "").startsWith("MONEY_");
	const potSummary = showPot
		? {
				amount: Math.max(0, toNumber(input.potAmount, 0)),
				weeklyAnte: Math.max(0, toNumber(input.weeklyAnte, 0)),
			}
		: null;

	return {
		currentLobby: {
			id: input.lobbyId,
			name: input.lobbyName,
		},
		seasonNumber: Math.max(1, toNumber(input.seasonNumber, 1)),
		modeLabel: String(input.modeLabel ?? input.mode ?? "MONEY_SURVIVAL").replace(/_/g, " "),
		hostName: input.hostName?.trim() ? input.hostName.trim() : "Host",
		athleteCount: Math.max(
			0,
			toNumber(input.athleteCount, Math.max(input.standings.length, input.hearts.length))
		),
		stageBadge,
		challengePunishment,
		myPlayerSummary,
		standingsPreview,
		weekSummary,
		potSummary,
	};
}
