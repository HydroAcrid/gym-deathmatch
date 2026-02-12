import test from "node:test";
import assert from "node:assert/strict";
import { authJson, bearerJson, assertJsonResponse, hasRequired, integrationConfig } from "./_helpers.mjs";

const cfg = integrationConfig();
const ready = hasRequired(cfg.baseUrl, cfg.authToken, cfg.lobbyId);

async function sleep(ms) {
	await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchFeedItems() {
	const feed = await authJson(
		cfg.baseUrl,
		`/api/lobby/${encodeURIComponent(cfg.lobbyId)}/feed?limit=100`,
		cfg.authToken
	);
	assert.equal(feed.response.status, 200, `feed failed: ${feed.text}`);
	assertJsonResponse(feed.response, feed.json, "feed");
	return Array.isArray(feed.json?.items) ? feed.json.items : [];
}

test("commentary contracts: max one feed quip per workout token and history audit remains", { skip: !ready }, async (t) => {
	const token = `it-note-${Date.now()}`;
	const posted = await authJson(
		cfg.baseUrl,
		`/api/lobby/${encodeURIComponent(cfg.lobbyId)}/activities/manual`,
		cfg.authToken,
		{
			method: "POST",
			body: JSON.stringify({
				type: "gym",
				durationMinutes: 20,
				distanceKm: null,
				notes: token,
				photoUrl: "https://example.com/integration-test.jpg",
				caption: `integration-caption-${token}`,
			}),
		}
	);
	assert.equal(posted.response.status, 201, `manual post failed: ${posted.text}`);
	assertJsonResponse(posted.response, posted.json, "manual post");
	const activityId = posted.json?.id;
	assert.ok(activityId, "manual post missing activity id");

	if (cfg.cronSecret) {
		await bearerJson(
			cfg.baseUrl,
			`/api/cron/commentary/process?lobbyId=${encodeURIComponent(cfg.lobbyId)}&limit=200&maxMs=3000`,
			cfg.cronSecret,
			{ method: "POST", body: JSON.stringify({}) }
		);
	}

	let matched = [];
	for (let i = 0; i < 12; i += 1) {
		const items = await fetchFeedItems();
		matched = items.filter((item) => String(item?.text || "").includes(token));
		if (matched.length > 0) break;
		await sleep(500);
	}
	assert.ok(matched.length <= 1, `expected <=1 feed quip per workout token, got ${matched.length}`);

	const history = await authJson(
		cfg.baseUrl,
		`/api/lobby/${encodeURIComponent(cfg.lobbyId)}/history?limit=120`,
		cfg.authToken
	);
	assert.equal(history.response.status, 200, `history failed: ${history.text}`);
	assertJsonResponse(history.response, history.json, "history");
	const events = Array.isArray(history.json?.events) ? history.json.events : [];
	const hasAuditEvent = events.some(
		(event) => event?.type === "ACTIVITY_LOGGED" && String(event?.payload?.activityId || "") === String(activityId)
	);
	assert.ok(hasAuditEvent, "expected ACTIVITY_LOGGED audit event for posted workout");

	t.diagnostic(`activityId=${activityId} tokenMatches=${matched.length}`);
});
