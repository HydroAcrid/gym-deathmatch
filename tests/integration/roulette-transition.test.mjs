import test from "node:test";
import assert from "node:assert/strict";
import { authJson, assertJsonResponse, hasRequired, integrationConfig } from "./_helpers.mjs";

const cfg = integrationConfig();
const ready = hasRequired(cfg.baseUrl, cfg.ownerAuthToken, cfg.rouletteLobbyId);

test("roulette transition flow: start-now enters transition and spin is phase-gated", { skip: !ready }, async (t) => {
	const beforeLive = await authJson(
		cfg.baseUrl,
		`/api/lobby/${encodeURIComponent(cfg.rouletteLobbyId)}/live?debug=1`,
		cfg.ownerAuthToken
	);
	assertJsonResponse(beforeLive.response, beforeLive.json, "live precheck");
	if (beforeLive.response.status !== 200) return;

	const mode = beforeLive.json?.lobby?.mode;
	if (mode !== "CHALLENGE_ROULETTE") {
		t.diagnostic(`Skipping roulette transition test: lobby mode is ${mode ?? "unknown"}`);
		return;
	}

	const stageSet = await authJson(
		cfg.baseUrl,
		`/api/lobby/${encodeURIComponent(cfg.rouletteLobbyId)}/stage`,
		cfg.ownerAuthToken,
		{
			method: "PATCH",
			body: JSON.stringify({ startNow: true }),
		}
	);
	assert.equal(stageSet.response.status, 200, `stage startNow failed: ${stageSet.text}`);
	assertJsonResponse(stageSet.response, stageSet.json, "stage startNow");
	assert.equal(stageSet.json?.ok, true);

	const afterLive = await authJson(
		cfg.baseUrl,
		`/api/lobby/${encodeURIComponent(cfg.rouletteLobbyId)}/live?debug=1`,
		cfg.ownerAuthToken
	);
	assert.equal(afterLive.response.status, 200, `live after startNow failed: ${afterLive.text}`);
	assertJsonResponse(afterLive.response, afterLive.json, "live after startNow");
	assert.equal(afterLive.json?.seasonStatus, "transition_spin");

	const spun = await authJson(
		cfg.baseUrl,
		`/api/lobby/${encodeURIComponent(cfg.rouletteLobbyId)}/spin`,
		cfg.ownerAuthToken,
		{
			method: "POST",
			body: JSON.stringify({}),
		}
	);
	assert.ok([200, 409].includes(spun.response.status), `unexpected spin status ${spun.response.status}`);
	assertJsonResponse(spun.response, spun.json, "spin");
	if (spun.response.status === 200) {
		assert.equal(spun.json?.ok, true);
		assert.ok(spun.json?.spinEvent?.spinId, "missing spin event id");
	}
});
