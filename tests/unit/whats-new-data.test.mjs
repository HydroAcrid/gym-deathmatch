import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const dataPath = resolve(process.cwd(), "data", "whats-new.json");

function isNonEmptyString(value) {
	return typeof value === "string" && value.trim().length > 0;
}

function isVersionLabel(value) {
	return typeof value === "string" && /^v?\d+\.\d+\.\d+$/.test(value.trim());
}

test("whats-new.json has a valid canonical shape", async () => {
	const raw = JSON.parse(await readFile(dataPath, "utf8"));
	assert.equal(typeof raw, "object");
	assert.ok(raw && !Array.isArray(raw), "root must be an object");

	assert.equal(Array.isArray(raw.entries), true, "entries must be an array");
	assert.equal(isNonEmptyString(raw.latestReleaseId), true, "latestReleaseId must be non-empty");
	assert.equal(isNonEmptyString(raw.generatedAt), true, "generatedAt must be non-empty");

	assert.ok(raw.entries.length > 0, "entries must include at least one release");
	assert.equal(
		raw.latestReleaseId,
		raw.entries[0].releaseId,
		"latestReleaseId must match the first entry releaseId"
	);
});

test("whats-new.json entries are deduped and complete", async () => {
	const raw = JSON.parse(await readFile(dataPath, "utf8"));
	const seen = new Set();
	for (const entry of raw.entries) {
		assert.equal(isNonEmptyString(entry.releaseId), true, "releaseId must be non-empty");
		assert.equal(isVersionLabel(entry.versionLabel), true, "versionLabel must be semver-like (vX.Y.Z)");
		assert.equal(isNonEmptyString(entry.title), true, "title must be non-empty");
		assert.equal(isNonEmptyString(entry.deployedAt), true, "deployedAt must be non-empty");
		assert.equal(Array.isArray(entry.bullets), true, "bullets must be an array");
		assert.equal(Array.isArray(entry.links), true, "links must be an array");
		assert.equal(Array.isArray(entry.sourcePrs), true, "sourcePrs must be an array");
		assert.equal(seen.has(entry.releaseId), false, `duplicate releaseId found: ${entry.releaseId}`);
		seen.add(entry.releaseId);
	}
});
