import test from "node:test";
import assert from "node:assert/strict";
import { authJson, assertJsonResponse, hasRequired, integrationConfig } from "./_helpers.mjs";

const cfg = integrationConfig();
const ready = hasRequired(cfg.baseUrl, cfg.authToken, cfg.lobbyId);

test("share/join flow responds explicitly for member and non-member states", { skip: !ready }, async () => {
	const access = await authJson(
		cfg.baseUrl,
		`/api/lobby/${encodeURIComponent(cfg.lobbyId)}/access-state${cfg.inviteToken ? `?t=${encodeURIComponent(cfg.inviteToken)}` : ""}`,
		cfg.authToken
	);

	assertJsonResponse(access.response, access.json, "access-state precheck");
	if (access.response.status !== 200) return;

	const { state, canJoin } = access.json;
	assert.ok(["member", "not_member"].includes(state), `unexpected state: ${state}`);

	if (state === "member") {
		assert.equal(canJoin, true, "members should always have canJoin=true");
		return;
	}

	const payload = {
		name: "Integration User",
		location: "Integration Test",
		quip: "integration",
		avatarUrl: null,
		inviteToken: cfg.inviteToken || undefined,
	};

	const joined = await authJson(
		cfg.baseUrl,
		`/api/lobby/${encodeURIComponent(cfg.lobbyId)}/invite`,
		cfg.authToken,
		{
			method: "POST",
			body: JSON.stringify(payload),
		}
	);

	assert.ok(
		[200, 403].includes(joined.response.status),
		`unexpected invite status ${joined.response.status}`
	);
	assertJsonResponse(joined.response, joined.json, "invite join");
});
