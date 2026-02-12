import test from "node:test";
import assert from "node:assert/strict";
import { authJson, bearerJson, assertJsonResponse, hasRequired, integrationConfig } from "./_helpers.mjs";

const cfg = integrationConfig();
const ready = hasRequired(cfg.baseUrl, cfg.authToken, cfg.lobbyId);

async function sleep(ms) {
	await new Promise((resolve) => setTimeout(resolve, ms));
}

test("visibility policy keeps feed chatter out of history comments", { skip: !ready }, async () => {
	const token = `visibility-token-${Date.now()}`;
	const posted = await authJson(
		cfg.baseUrl,
		`/api/lobby/${encodeURIComponent(cfg.lobbyId)}/activities/manual`,
		cfg.authToken,
		{
			method: "POST",
			body: JSON.stringify({
				type: "gym",
				durationMinutes: 15,
				distanceKm: null,
				notes: token,
				photoUrl: "https://example.com/visibility-test.jpg",
				caption: `visibility-${token}`,
			}),
		}
	);
	assert.equal(posted.response.status, 201, `manual post failed: ${posted.text}`);
	assertJsonResponse(posted.response, posted.json, "manual post");
	const startedAt = new Date().toISOString();

	if (cfg.cronSecret) {
		await bearerJson(
			cfg.baseUrl,
			`/api/cron/commentary/process?lobbyId=${encodeURIComponent(cfg.lobbyId)}&limit=200&maxMs=3000`,
			cfg.cronSecret,
			{ method: "POST", body: JSON.stringify({}) }
		);
	}

	let feedTokenHits = 0;
	for (let i = 0; i < 10; i += 1) {
		const feed = await authJson(
			cfg.baseUrl,
			`/api/lobby/${encodeURIComponent(cfg.lobbyId)}/feed?limit=120`,
			cfg.authToken
		);
		assert.equal(feed.response.status, 200, `feed failed: ${feed.text}`);
		assertJsonResponse(feed.response, feed.json, "feed");
		const items = (feed.json?.items ?? []).filter((item) => String(item?.createdAt || "") >= startedAt);
		feedTokenHits = items.filter((item) => String(item?.text || "").includes(token)).length;
		if (feedTokenHits > 0) break;
		await sleep(400);
	}
	assert.ok(feedTokenHits <= 1, `expected <=1 feed token hit, got ${feedTokenHits}`);

	const history = await authJson(
		cfg.baseUrl,
		`/api/lobby/${encodeURIComponent(cfg.lobbyId)}/history?limit=120`,
		cfg.authToken
	);
	assert.equal(history.response.status, 200, `history failed: ${history.text}`);
	assertJsonResponse(history.response, history.json, "history");
	const recentHistoryComments = (history.json?.comments ?? []).filter(
		(comment) => String(comment?.created_at || "") >= startedAt
	);
	const historyTokenHits = recentHistoryComments.filter((comment) =>
		String(comment?.rendered || "").includes(token)
	).length;
	assert.equal(historyTokenHits, 0, "feed-only activity highlight should not appear in history comments");
});
