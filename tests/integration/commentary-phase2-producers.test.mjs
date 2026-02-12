import test from "node:test";
import assert from "node:assert/strict";
import { authJson, assertJsonResponse, hasRequired, integrationConfig } from "./_helpers.mjs";

const cfg = integrationConfig();

async function sleep(ms) {
	await new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollFeedForText(lobbyId, token, startedAtIso, pattern, attempts = 12, delayMs = 400) {
	const matcher = typeof pattern === "string" ? (text) => text.includes(pattern) : pattern;
	for (let i = 0; i < attempts; i += 1) {
		const feed = await authJson(
			cfg.baseUrl,
			`/api/lobby/${encodeURIComponent(lobbyId)}/feed?limit=120`,
			token
		);
		assert.equal(feed.response.status, 200, `feed failed: ${feed.text}`);
		assertJsonResponse(feed.response, feed.json, "feed");
		const items = Array.isArray(feed.json?.items) ? feed.json.items : [];
		const recent = items.filter((item) => String(item?.createdAt || "") >= startedAtIso);
		if (recent.some((item) => matcher(String(item?.text || "")))) return true;
		await sleep(delayMs);
	}
	return false;
}

test("phase2 producer contract: vote override emits vote commentary", { skip: !hasRequired(cfg.baseUrl, cfg.authToken, cfg.ownerAuthToken, cfg.lobbyId) }, async () => {
	const marker = `phase2-vote-${Date.now()}`;
	const posted = await authJson(
		cfg.baseUrl,
		`/api/lobby/${encodeURIComponent(cfg.lobbyId)}/activities/manual`,
		cfg.authToken,
		{
			method: "POST",
			body: JSON.stringify({
				type: "gym",
				durationMinutes: 12,
				distanceKm: null,
				notes: marker,
				photoUrl: "https://example.com/phase2-vote.jpg",
				caption: `phase2-vote-caption-${marker}`,
			}),
		}
	);
	assert.equal(posted.response.status, 201, `manual post failed: ${posted.text}`);
	assertJsonResponse(posted.response, posted.json, "manual post");
	const activityId = String(posted.json?.id || "");
	assert.ok(activityId, "missing activity id");

	const startedAt = new Date().toISOString();
	const override = await authJson(
		cfg.baseUrl,
		`/api/activities/${encodeURIComponent(activityId)}/override`,
		cfg.ownerAuthToken,
		{
			method: "POST",
			body: JSON.stringify({ newStatus: "rejected", reason: "phase2-contract" }),
		}
	);
	assert.equal(override.response.status, 200, `override failed: ${override.text}`);
	assertJsonResponse(override.response, override.json, "override");
	assert.equal(override.json?.ok, true);

	const history = await authJson(
		cfg.baseUrl,
		`/api/lobby/${encodeURIComponent(cfg.lobbyId)}/history?limit=200`,
		cfg.authToken
	);
	assert.equal(history.response.status, 200, `history failed: ${history.text}`);
	assertJsonResponse(history.response, history.json, "history");
	const comments = Array.isArray(history.json?.comments) ? history.json.comments : [];
	const voteRows = comments.filter(
		(row) =>
			String(row?.created_at || "") >= startedAt &&
			String(row?.type || "").toUpperCase() === "VOTE"
	);
	assert.ok(voteRows.length >= 1, "expected at least one VOTE commentary row after override");
});

test("phase2 producer contract: pot update emits feed pot commentary", { skip: !hasRequired(cfg.baseUrl, cfg.ownerAuthToken, cfg.lobbyId) }, async () => {
	const live = await authJson(
		cfg.baseUrl,
		`/api/lobby/${encodeURIComponent(cfg.lobbyId)}/live?debug=1`,
		cfg.ownerAuthToken
	);
	assert.equal(live.response.status, 200, `live failed: ${live.text}`);
	assertJsonResponse(live.response, live.json, "live");

	const currentPot = Number(live.json?.lobby?.cashPool ?? 0);
	const targetPot = currentPot + 1;
	const startedAt = new Date().toISOString();

	const updated = await authJson(
		cfg.baseUrl,
		`/api/lobby/${encodeURIComponent(cfg.lobbyId)}/pot`,
		cfg.ownerAuthToken,
		{
			method: "POST",
			body: JSON.stringify({ targetPot }),
		}
	);
	assert.equal(updated.response.status, 200, `pot update failed: ${updated.text}`);
	assertJsonResponse(updated.response, updated.json, "pot update");
	assert.equal(updated.json?.ok, true);

	const found = await pollFeedForText(cfg.lobbyId, cfg.ownerAuthToken, startedAt, `Pot climbs to $${targetPot}`);
	assert.equal(found, true, "expected pot commentary in feed after pot update");

	// Best-effort revert so integration runs do not permanently drift the pot.
	await authJson(
		cfg.baseUrl,
		`/api/lobby/${encodeURIComponent(cfg.lobbyId)}/pot`,
		cfg.ownerAuthToken,
		{
			method: "POST",
			body: JSON.stringify({ targetPot: currentPot }),
		}
	);
});

test("phase2 producer contract: ready endpoint emits ready commentary", { skip: !hasRequired(cfg.baseUrl, cfg.authToken, cfg.lobbyId) }, async () => {
	const startedAt = new Date().toISOString();
	const readyRes = await authJson(
		cfg.baseUrl,
		`/api/lobby/${encodeURIComponent(cfg.lobbyId)}/ready`,
		cfg.authToken,
		{
			method: "POST",
			body: JSON.stringify({ ready: true }),
		}
	);
	assert.equal(readyRes.response.status, 200, `ready failed: ${readyRes.text}`);
	assertJsonResponse(readyRes.response, readyRes.json, "ready");
	assert.equal(readyRes.json?.ok, true);

	const found = await pollFeedForText(
		cfg.lobbyId,
		cfg.authToken,
		startedAt,
		(text) => text.includes("Ready.") || text.includes("ready")
	);
	assert.equal(found, true, "expected ready commentary in feed after ready update");
});

test("phase2 producer contract: spin endpoint emits spin commentary when spin succeeds", { skip: !hasRequired(cfg.baseUrl, cfg.ownerAuthToken, cfg.rouletteLobbyId) }, async (t) => {
	const startedAt = new Date().toISOString();
	const spun = await authJson(
		cfg.baseUrl,
		`/api/lobby/${encodeURIComponent(cfg.rouletteLobbyId)}/spin`,
		cfg.ownerAuthToken,
		{
			method: "POST",
			body: JSON.stringify({}),
		}
	);
	assert.ok([200, 409].includes(spun.response.status), `unexpected spin status: ${spun.response.status} ${spun.text}`);
	assertJsonResponse(spun.response, spun.json, "spin");

	if (spun.response.status === 409) {
		t.diagnostic("Spin currently not allowed (likely not in transition phase); contract check skipped.");
		return;
	}

	const found = await pollFeedForText(
		cfg.rouletteLobbyId,
		cfg.ownerAuthToken,
		startedAt,
		"Wheel spun. Punishment:"
	);
	assert.equal(found, true, "expected spin commentary in feed after successful spin");
});
