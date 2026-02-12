import test from "node:test";
import assert from "node:assert/strict";
import { authJson, assertJsonResponse, hasRequired, integrationConfig } from "./_helpers.mjs";

const cfg = integrationConfig();
const ready = hasRequired(cfg.baseUrl, cfg.authToken, cfg.lobbyId);

test("access-state returns a valid state for authenticated callers", { skip: !ready }, async () => {
	const { response, json } = await authJson(
		cfg.baseUrl,
		`/api/lobby/${encodeURIComponent(cfg.lobbyId)}/access-state`,
		cfg.authToken
	);

	assert.ok([200, 403, 404].includes(response.status), `unexpected status ${response.status}`);
	assertJsonResponse(response, json, "access-state");

	if (response.status === 200) {
		assert.ok(["member", "not_member"].includes(json.state), `unexpected state: ${json.state}`);
		assert.equal(typeof json.canJoin, "boolean");
		assert.ok(json.invite && typeof json.invite === "object", "invite info missing");
	}
});
