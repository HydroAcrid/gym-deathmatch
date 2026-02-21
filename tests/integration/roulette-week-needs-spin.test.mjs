import test from "node:test";
import assert from "node:assert/strict";
import { authJson, assertJsonResponse, hasRequired, integrationConfig } from "./_helpers.mjs";

const cfg = integrationConfig();
const ready = hasRequired(cfg.baseUrl, cfg.ownerAuthToken, cfg.rouletteLobbyId);

test("roulette week state exposes needsSpin contract and active-phase spin recovery", { skip: !ready }, async (t) => {
	const live = await authJson(
		cfg.baseUrl,
		`/api/lobby/${encodeURIComponent(cfg.rouletteLobbyId)}/live?debug=1`,
		cfg.ownerAuthToken
	);
	assert.equal(live.response.status, 200, `live failed: ${live.text}`);
	assertJsonResponse(live.response, live.json, "live");
	const mode = String(live.json?.lobby?.mode || "");
	if (mode !== "CHALLENGE_ROULETTE") {
		t.diagnostic(`Skipping: roulette lobby mode is ${mode || "unknown"}`);
		return;
	}

	const punishments = await authJson(
		cfg.baseUrl,
		`/api/lobby/${encodeURIComponent(cfg.rouletteLobbyId)}/punishments`,
		cfg.ownerAuthToken
	);
	assert.equal(punishments.response.status, 200, `punishments failed: ${punishments.text}`);
	assertJsonResponse(punishments.response, punishments.json, "punishments");

	assert.equal(typeof punishments.json?.needsSpin, "boolean", "needsSpin should be a boolean");
	assert.ok(punishments.json?.weekContext && typeof punishments.json.weekContext === "object", "weekContext missing");
	assert.equal(typeof punishments.json?.weekContext?.week, "number", "weekContext.week should be numeric");
	assert.equal(typeof punishments.json?.weekContext?.hasSpinEvent, "boolean", "weekContext.hasSpinEvent should be boolean");
	assert.equal(typeof punishments.json?.weekContext?.hasActive, "boolean", "weekContext.hasActive should be boolean");

	if (!punishments.json?.needsSpin) {
		t.diagnostic("needsSpin=false for current roulette week; nothing to recover.");
		return;
	}

	if (Array.isArray(punishments.json?.items) && punishments.json.items.length > 0) {
		// Best-effort lock before spin to satisfy stricter challenge settings.
		await authJson(
			cfg.baseUrl,
			`/api/lobby/${encodeURIComponent(cfg.rouletteLobbyId)}/punishments/lock`,
			cfg.ownerAuthToken,
			{
				method: "POST",
				body: JSON.stringify({ locked: true }),
			}
		);
	}

	const spin = await authJson(
		cfg.baseUrl,
		`/api/lobby/${encodeURIComponent(cfg.rouletteLobbyId)}/spin`,
		cfg.ownerAuthToken,
		{
			method: "POST",
			body: JSON.stringify({}),
		}
	);

	// Regression target: when needsSpin=true, spin should never be blocked by INVALID_PHASE.
	if (spin.response.status === 409) {
		const code = String(spin.json?.error || "");
		assert.notEqual(code, "INVALID_PHASE", `spin rejected with INVALID_PHASE while needsSpin=true: ${spin.text}`);
		t.diagnostic(`Spin returned 409 with code=${code}; accepted for current fixture.`);
		return;
	}

	assert.equal(spin.response.status, 200, `spin should succeed when needsSpin=true: ${spin.text}`);
	assertJsonResponse(spin.response, spin.json, "spin");
	assert.equal(spin.json?.ok, true, "spin missing ok=true");
	assert.ok(spin.json?.spinEvent?.spinId, "spin response missing spinEvent.spinId");

	const after = await authJson(
		cfg.baseUrl,
		`/api/lobby/${encodeURIComponent(cfg.rouletteLobbyId)}/punishments`,
		cfg.ownerAuthToken
	);
	assert.equal(after.response.status, 200, `punishments after spin failed: ${after.text}`);
	assertJsonResponse(after.response, after.json, "punishments after spin");
	assert.equal(after.json?.needsSpin, false, "needsSpin should clear after successful spin");
});
