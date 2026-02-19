import test from "node:test";
import assert from "node:assert/strict";
import { authJson, hasRequired, integrationConfig, toUrl } from "./_helpers.mjs";

const cfg = integrationConfig();
const ready = hasRequired(cfg.baseUrl, cfg.authToken);
const ELIGIBLE = new Set(["pending", "scheduled", "transition_spin", "active"]);

test("activity targets: GET unauthorized returns 401", { skip: !cfg.baseUrl }, async () => {
	const response = await fetch(toUrl(cfg.baseUrl, "/api/user/activity-targets"));
	assert.equal(response.status, 401);
});

test("activity targets: PUT sanitizes, dedupes, caps, and excludes completed", { skip: !ready }, async (t) => {
	const lobbiesRes = await authJson(cfg.baseUrl, "/api/lobbies", cfg.authToken);
	assert.equal(lobbiesRes.response.status, 200, `lobbies fetch failed: ${lobbiesRes.text}`);
	const rows = Array.isArray(lobbiesRes.json?.lobbies) ? lobbiesRes.json.lobbies : [];
	const eligibleIds = rows
		.filter((row) => ELIGIBLE.has(String(row?.status || "")))
		.map((row) => String(row.id));
	const completedIds = rows
		.filter((row) => String(row?.status || "") === "completed")
		.map((row) => String(row.id));

	if (!eligibleIds.length) {
		t.skip("No eligible lobbies available for this test token");
		return;
	}

	const preferred = eligibleIds.slice(0, Math.min(4, eligibleIds.length));
	const payloadIds = [
		...preferred,
		...preferred, // duplicate on purpose
		...(completedIds.length ? [completedIds[0]] : []),
		"not-a-real-lobby-id",
		...Array.from({ length: 40 }, (_, i) => `fake-${i}`),
	];

	const put = await authJson(cfg.baseUrl, "/api/user/activity-targets", cfg.authToken, {
		method: "PUT",
		body: JSON.stringify({ lobbyIds: payloadIds }),
	});
	assert.equal(put.response.status, 200, `PUT failed: ${put.text}`);
	assert.equal(put.json?.ok, true, "PUT response missing ok=true");

	const savedIds = Array.isArray(put.json?.lobbyIds) ? put.json.lobbyIds : [];
	assert.ok(savedIds.length <= 25, `expected <=25 lobby IDs, got ${savedIds.length}`);
	assert.equal(new Set(savedIds).size, savedIds.length, "expected deduped lobby IDs");
	for (const id of savedIds) {
		assert.ok(eligibleIds.includes(id), `returned id is not eligible: ${id}`);
	}
	if (completedIds.length) {
		assert.ok(!savedIds.includes(completedIds[0]), "completed lobby id should have been excluded");
	}

	const get = await authJson(cfg.baseUrl, "/api/user/activity-targets", cfg.authToken);
	assert.equal(get.response.status, 200, `GET failed: ${get.text}`);
	const fetchedIds = Array.isArray(get.json?.lobbyIds) ? get.json.lobbyIds : [];
	assert.deepEqual(fetchedIds, savedIds, "GET should reflect sanitized persisted targets");
});
