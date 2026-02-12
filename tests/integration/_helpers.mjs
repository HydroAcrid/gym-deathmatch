import assert from "node:assert/strict";

export function integrationConfig() {
	return {
		baseUrl: process.env.TEST_BASE_URL ?? "",
		authToken: process.env.TEST_AUTH_TOKEN ?? "",
		ownerAuthToken: process.env.TEST_OWNER_AUTH_TOKEN ?? process.env.TEST_AUTH_TOKEN ?? "",
		lobbyId: process.env.TEST_LOBBY_ID ?? "",
		rouletteLobbyId: process.env.TEST_ROULETTE_LOBBY_ID ?? process.env.TEST_LOBBY_ID ?? "",
		inviteToken: process.env.TEST_INVITE_TOKEN ?? "",
	};
}

export function hasRequired(...values) {
	return values.every((value) => typeof value === "string" && value.length > 0);
}

export function toUrl(baseUrl, path) {
	return `${baseUrl.replace(/\/+$/, "")}${path}`;
}

export async function authJson(baseUrl, path, token, init = {}) {
	const response = await fetch(toUrl(baseUrl, path), {
		...init,
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
			...(init.headers ?? {}),
		},
	});
	const text = await response.text();
	let json = null;
	try {
		json = text ? JSON.parse(text) : null;
	} catch {
		json = null;
	}
	return { response, json, text };
}

export function assertJsonResponse(response, json, context) {
	assert.ok(response, `${context}: missing response`);
	assert.ok(json !== null, `${context}: expected JSON body`);
}
