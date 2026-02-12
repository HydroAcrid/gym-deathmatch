import test from "node:test";
import assert from "node:assert/strict";
import { authJson, bearerJson, assertJsonResponse, hasRequired, integrationConfig } from "./_helpers.mjs";

const cfg = integrationConfig();
const ready = hasRequired(cfg.baseUrl, cfg.authToken, cfg.cronSecret, cfg.lobbyId);

test("daily reminder is push-only (no feed/history reminder quips)", { skip: !ready }, async () => {
	const startedAt = new Date().toISOString();
	const run = await bearerJson(
		cfg.baseUrl,
		`/api/cron/commentary/daily?lobbyId=${encodeURIComponent(cfg.lobbyId)}&process=true`,
		cfg.cronSecret,
		{ method: "POST", body: JSON.stringify({}) }
	);
	assert.equal(run.response.status, 200, `daily cron failed: ${run.text}`);
	assertJsonResponse(run.response, run.json, "daily cron");
	assert.equal(run.json?.ok, true);

	const feed = await authJson(
		cfg.baseUrl,
		`/api/lobby/${encodeURIComponent(cfg.lobbyId)}/feed?limit=120`,
		cfg.authToken
	);
	assert.equal(feed.response.status, 200, `feed failed: ${feed.text}`);
	assertJsonResponse(feed.response, feed.json, "feed");
	const feedItems = (feed.json?.items ?? []).filter((item) => String(item?.createdAt || "") >= startedAt);
	const hasReminderInFeed = feedItems.some((item) =>
		String(item?.text || "").toLowerCase().includes("hasn't logged an activity today")
	);
	assert.equal(hasReminderInFeed, false, "daily reminder should not be emitted to feed comments");

	const history = await authJson(
		cfg.baseUrl,
		`/api/lobby/${encodeURIComponent(cfg.lobbyId)}/history?limit=120`,
		cfg.authToken
	);
	assert.equal(history.response.status, 200, `history failed: ${history.text}`);
	assertJsonResponse(history.response, history.json, "history");
	const historyComments = (history.json?.comments ?? []).filter((comment) => String(comment?.created_at || "") >= startedAt);
	const hasReminderInHistory = historyComments.some((comment) =>
		String(comment?.rendered || "").toLowerCase().includes("hasn't logged an activity today")
	);
	assert.equal(hasReminderInHistory, false, "daily reminder should not be emitted to history comments");
});
