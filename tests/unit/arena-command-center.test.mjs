import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import ts from "typescript";

const adapterPath = resolve(process.cwd(), "src/ui2/adapters/arenaCommandCenter.ts");

async function loadAdapter() {
	const source = await readFile(adapterPath, "utf8");
	const { outputText } = ts.transpileModule(source, {
		compilerOptions: {
			target: ts.ScriptTarget.ES2022,
			module: ts.ModuleKind.ES2022,
		},
	});
	const encoded = Buffer.from(outputText).toString("base64");
	return import(`data:text/javascript;base64,${encoded}`);
}

function makeStanding(overrides = {}) {
	return {
		athleteId: "player-1",
		athleteName: "Athlete",
		rank: 1,
		workouts: 0,
		streak: 0,
		penalties: 0,
		points: 0,
		...overrides,
	};
}

function makeHeart(overrides = {}) {
	return {
		id: "player-1",
		name: "Athlete",
		initials: "AT",
		hearts: 3,
		maxHearts: 3,
		weeklyTarget: 3,
		weeklyProgress: 1,
		status: "safe",
		totalWorkouts: 5,
		currentStreak: 2,
		averageWorkoutsPerWeek: 3,
		longestStreak: 5,
		...overrides,
	};
}

test("standings preview applies tie ranks and resolves my rank", async () => {
	const adapter = await loadAdapter();
	const result = adapter.buildStandingsPreviewEntries(
		[
			makeStanding({ athleteId: "a", athleteName: "A", points: 10, workouts: 4 }),
			makeStanding({ athleteId: "b", athleteName: "B", points: 10, workouts: 3 }),
			makeStanding({ athleteId: "me", athleteName: "Me", points: 8, workouts: 3 }),
		],
		"me"
	);

	assert.equal(result.top.length, 3);
	assert.equal(result.top[0].rank, 1);
	assert.equal(result.top[1].rank, 1);
	assert.equal(result.top[2].rank, 3);
	assert.equal(result.myRank?.rank, 3);
});

test("standings preview handles missing current player", async () => {
	const adapter = await loadAdapter();
	const result = adapter.buildStandingsPreviewEntries(
		[
			makeStanding({ athleteId: "a", athleteName: "A", points: 12 }),
			makeStanding({ athleteId: "b", athleteName: "B", points: 9 }),
		],
		"missing-player"
	);

	assert.equal(result.myRank, null);
	assert.equal(result.totalAthletes, 2);
});

test("week progress and remaining time calculations stay stable", async () => {
	const adapter = await loadAdapter();
	const weekEndDate = new Date("2026-02-20T00:00:00.000Z");
	const halfWeekNow = new Date("2026-02-16T12:00:00.000Z").getTime();
	const progress = adapter.computeWeekProgressPercent(2, 4, weekEndDate, halfWeekNow);

	assert.equal(Number(progress.toFixed(1)), 37.5);
	assert.equal(adapter.formatTimeRemaining(new Date("2026-02-15T00:00:00.000Z"), halfWeekNow), "RESETTING...");
	assert.equal(adapter.formatTimeRemaining(weekEndDate, halfWeekNow), "3D 12H");
});

test("stage badge mapping covers pre-stage, active, and completed", async () => {
	const adapter = await loadAdapter();
	assert.deepEqual(adapter.resolveArenaStageBadge("PRE_STAGE", "pending"), {
		code: "PRE_STAGE",
		label: "PRE-STAGE",
		tone: "muted",
	});
	assert.deepEqual(adapter.resolveArenaStageBadge("ACTIVE", "active"), {
		code: "ACTIVE",
		label: "ACTIVE",
		tone: "primary",
	});
	assert.deepEqual(adapter.resolveArenaStageBadge("ACTIVE", "completed"), {
		code: "COMPLETED",
		label: "COMPLETED",
		tone: "neutral",
	});
});

test("command center VM includes pot only for money modes", async () => {
	const adapter = await loadAdapter();
	const baseInput = {
		lobbyId: "304-dreamers",
		lobbyName: "304 Dreamers",
		seasonNumber: 1,
		stage: "ACTIVE",
		seasonStatus: "active",
		myPlayerId: "me",
		myPlayerName: "Me",
		standings: [makeStanding({ athleteId: "me", athleteName: "Me", points: 9 })],
		hearts: [makeHeart({ id: "me", name: "Me" })],
		currentWeek: 1,
		totalWeeks: 3,
		weekEndDate: new Date("2026-02-20T00:00:00.000Z"),
		potAmount: 250,
		weeklyAnte: 10,
		nowMs: new Date("2026-02-15T00:00:00.000Z").getTime(),
	};

	const moneyVm = adapter.buildArenaCommandCenterVM({ ...baseInput, mode: "MONEY_SURVIVAL" });
	const challengeVm = adapter.buildArenaCommandCenterVM({ ...baseInput, mode: "CHALLENGE_ROULETTE" });

	assert.equal(moneyVm.potSummary?.amount, 250);
	assert.equal(challengeVm.potSummary, null);
	assert.equal(moneyVm.myPlayerSummary?.rank, 1);
});
