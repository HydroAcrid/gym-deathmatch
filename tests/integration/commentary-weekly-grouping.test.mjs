import test from "node:test";
import assert from "node:assert/strict";
import { bearerJson, assertJsonResponse, hasRequired, integrationConfig } from "./_helpers.mjs";

const cfg = integrationConfig();
const ready = hasRequired(cfg.baseUrl, cfg.cronSecret, cfg.lobbyId);

test("weekly commentary emits grouped events and processor reports healthy stats", { skip: !ready }, async (t) => {
	const weekly = await bearerJson(
		cfg.baseUrl,
		`/api/cron/commentary/weekly?lobbyId=${encodeURIComponent(cfg.lobbyId)}&process=true`,
		cfg.cronSecret,
		{ method: "POST", body: JSON.stringify({}) }
	);
	assert.equal(weekly.response.status, 200, `weekly cron failed: ${weekly.text}`);
	assertJsonResponse(weekly.response, weekly.json, "weekly cron");
	assert.equal(weekly.json?.ok, true);

	const processor = weekly.json?.processor ?? {};
	assert.ok(typeof processor.processed === "number", "processor stats missing processed");
	assert.ok(typeof processor.emitted === "number", "processor stats missing emitted");
	assert.ok(typeof processor.failed === "number", "processor stats missing failed");
	assert.equal(processor.failed, 0, `processor failures detected: ${JSON.stringify(processor)}`);

	const groupedSignal =
		Number(weekly.json?.heartsEvents ?? 0) +
		Number(weekly.json?.ghostWarnings ?? 0) +
		Number(weekly.json?.hypeEvents ?? 0) +
		Number(weekly.json?.tightRaceEvents ?? 0) +
		Number(weekly.json?.resets ?? 0);

	if (groupedSignal === 0) {
		t.diagnostic("No weekly signal generated for this fixture run; skipping strict emitted>=signal assertion.");
		return;
	}

	assert.ok(
		Number(processor.emitted ?? 0) >= groupedSignal,
		`expected processor emitted >= grouped signal (${groupedSignal}), got ${processor.emitted}`
	);
});
