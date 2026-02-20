#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const DATA_PATH = resolve(process.cwd(), "data", "whats-new.json");
const MAX_BULLETS = 8;
const MAX_LINKS = 6;
const VERSION_RE = /^v?(\d+)\.(\d+)\.(\d+)$/;
const KNOWN_LABELS = ["feature", "ui", "backend", "fix", "security", "infra"];
const PRODUCT_LABELS = ["feature", "ui", "backend", "fix", "security", "infra"];
const EXCLUDED_LABELS = ["dependencies", "dependency", "chore", "docs", "ci"];

function assertEnv(name) {
	const value = process.env[name];
	if (!value) throw new Error(`Missing required environment variable: ${name}`);
	return value;
}

function isBotActor(value) {
	return /\[bot\]$/i.test(String(value || "").trim());
}

function normalizeVersionLabel(value) {
	if (typeof value !== "string") return "";
	const cleaned = value.trim();
	if (!cleaned) return "";
	const match = cleaned.match(VERSION_RE);
	if (!match) return "";
	return `v${Number(match[1])}.${Number(match[2])}.${Number(match[3])}`;
}

function nextVersionLabel(previous) {
	const normalized = normalizeVersionLabel(previous);
	if (!normalized) return "v0.1.0";
	const [, major, minor, patch] = normalized.match(VERSION_RE);
	return `v${Number(major)}.${Number(minor)}.${Number(patch) + 1}`;
}

function normalizeData(raw) {
	const fallback = {
		latestReleaseId: "",
		entries: [],
		generatedAt: new Date(0).toISOString(),
	};
	if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fallback;
	const latestReleaseId = typeof raw.latestReleaseId === "string" ? raw.latestReleaseId : "";
	const entries = Array.isArray(raw.entries) ? raw.entries : [];
	const seen = new Set();
	const normalized = [];
	for (const item of entries) {
		if (!item || typeof item !== "object" || Array.isArray(item)) continue;
		const releaseId = typeof item.releaseId === "string" ? item.releaseId : "";
		if (!releaseId || seen.has(releaseId)) continue;
		seen.add(releaseId);
		const deployedAtIso =
			typeof item.deployedAt === "string" && item.deployedAt ? item.deployedAt : new Date().toISOString();
		const deployedAt = new Date(deployedAtIso || Date.now());
		normalized.push({
			releaseId,
			versionLabel:
				normalizeVersionLabel(item.versionLabel) ||
				`v${deployedAt.getUTCFullYear()}.${String(deployedAt.getUTCMonth() + 1).padStart(2, "0")}.${String(
					deployedAt.getUTCDate()
				).padStart(2, "0")}`,
			title: typeof item.title === "string" && item.title.trim() ? item.title.trim() : `Release ${releaseId.slice(0, 7)}`,
			deployedAt: deployedAt.toISOString(),
			bullets: Array.isArray(item.bullets) ? item.bullets.filter((b) => typeof b === "string" && b.trim()) : [],
			links: Array.isArray(item.links)
				? item.links
						.filter((link) => link && typeof link === "object" && !Array.isArray(link))
						.map((link) => ({ label: String(link.label ?? "").trim(), href: String(link.href ?? "").trim() }))
						.filter((link) => link.label && link.href)
				: [],
			sourcePrs: Array.isArray(item.sourcePrs)
				? item.sourcePrs.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0).map((n) => Math.floor(n))
				: [],
		});
	}
	return {
		latestReleaseId: latestReleaseId || normalized[0]?.releaseId || "",
		entries: normalized,
		generatedAt: typeof raw.generatedAt === "string" && raw.generatedAt ? raw.generatedAt : new Date().toISOString(),
	};
}

function extractPrNumbersFromMessage(message) {
	if (!message || typeof message !== "string") return [];
	const matches = [...message.matchAll(/#(\d+)/g)];
	return matches.map((match) => Number(match[1])).filter((n) => Number.isFinite(n) && n > 0);
}

async function githubFetch(url, token) {
	const response = await fetch(url, {
		headers: {
			Authorization: `Bearer ${token}`,
			Accept: "application/vnd.github+json",
			"User-Agent": "gym-deathmatch-whats-new-bot",
		},
	});
	if (!response.ok) {
		const body = await response.text().catch(() => "");
		throw new Error(`GitHub API failed (${response.status}) for ${url}: ${body.slice(0, 180)}`);
	}
	return response.json();
}

function cleanTitle(title) {
	return String(title || "")
		.replace(/\s*\(#\d+\)\s*$/g, "")
		.replace(/\s+/g, " ")
		.trim();
}

function classifyLabel(labels) {
	for (const key of KNOWN_LABELS) {
		const found = labels.find((label) => label.toLowerCase().includes(key));
		if (found) return key;
	}
	return "other";
}

function includesAnyLabel(labels, keywords) {
	const lowered = labels.map((label) => label.toLowerCase());
	return keywords.some((keyword) => lowered.some((label) => label.includes(keyword)));
}

function isHighSignalPr(pr) {
	if (isBotActor(pr.author)) return false;
	if (includesAnyLabel(pr.labels, EXCLUDED_LABELS)) return false;
	return includesAnyLabel(pr.labels, PRODUCT_LABELS);
}

function buildBullets(prs) {
	const groups = new Map();
	for (const pr of prs) {
		const label = classifyLabel(pr.labels);
		const value = `${cleanTitle(pr.title)} (#${pr.number})`;
		if (!groups.has(label)) groups.set(label, []);
		const arr = groups.get(label);
		if (!arr.includes(value)) arr.push(value);
	}
	const ordered = [...KNOWN_LABELS, "other"];
	const bullets = [];
	for (const key of ordered) {
		const arr = groups.get(key);
		if (!arr?.length) continue;
		for (const text of arr) {
			if (bullets.length >= MAX_BULLETS) break;
			bullets.push(text);
		}
		if (bullets.length >= MAX_BULLETS) break;
	}
	return bullets;
}

function shouldSkipForHeadCommit() {
	const eventPath = process.env.GITHUB_EVENT_PATH;
	if (!eventPath) return false;
	return readFile(eventPath, "utf8")
		.then((raw) => {
			const payload = JSON.parse(raw);
			const headMessage = String(payload?.head_commit?.message || "").toLowerCase();
			return headMessage.startsWith("chore(changelog): update what's new");
		})
		.catch(() => false);
}

async function main() {
	if (await shouldSkipForHeadCommit()) {
		console.log("[whats-new] changelog commit detected. No changes.");
		return;
	}

	const sha = assertEnv("GITHUB_SHA");
	const repo = assertEnv("GITHUB_REPOSITORY");
	const token = assertEnv("GITHUB_TOKEN");
	const [owner, repoName] = repo.split("/");
	if (!owner || !repoName) throw new Error(`Invalid GITHUB_REPOSITORY value: ${repo}`);

	const raw = JSON.parse(await readFile(DATA_PATH, "utf8"));
	const data = normalizeData(raw);
	if (data.latestReleaseId === sha || data.entries.some((entry) => entry.releaseId === sha)) {
		console.log(`[whats-new] SHA ${sha.slice(0, 7)} already exists. No changes.`);
		return;
	}

	const previousSha = data.latestReleaseId && data.latestReleaseId !== sha ? data.latestReleaseId : null;
	if (!previousSha) {
		console.log("[whats-new] No previous release SHA; skipping auto entry.");
		return;
	}

	const prNumberSet = new Set();
	try {
		const compareUrl = `https://api.github.com/repos/${owner}/${repoName}/compare/${previousSha}...${sha}`;
		const compare = await githubFetch(compareUrl, token);
		for (const commit of compare.commits ?? []) {
			for (const n of extractPrNumbersFromMessage(commit.commit?.message)) prNumberSet.add(n);
		}
		console.log(`[whats-new] compare discovered ${prNumberSet.size} PR references`);
	} catch (err) {
		console.warn(`[whats-new] compare lookup failed: ${err instanceof Error ? err.message : String(err)}`);
		return;
	}

	const prNumbers = [...prNumberSet].sort((a, b) => b - a);
	if (!prNumbers.length) {
		console.log("[whats-new] No PR references in compare range. No changes.");
		return;
	}

	const prDetails = [];
	for (const number of prNumbers.slice(0, 20)) {
		try {
			const pr = await githubFetch(`https://api.github.com/repos/${owner}/${repoName}/pulls/${number}`, token);
			prDetails.push({
				number,
				title: String(pr.title || `PR #${number}`),
				htmlUrl: String(pr.html_url || `https://github.com/${owner}/${repoName}/pull/${number}`),
				labels: Array.isArray(pr.labels) ? pr.labels.map((l) => String(l?.name || "")).filter(Boolean) : [],
				author: String(pr.user?.login || ""),
			});
		} catch (err) {
			console.warn(`[whats-new] failed to load PR #${number}: ${err instanceof Error ? err.message : String(err)}`);
		}
	}

	const highSignalPrs = prDetails.filter(isHighSignalPr);
	if (!highSignalPrs.length) {
		console.log("[whats-new] No high-signal PRs in this release window. No changes.");
		return;
	}

	const compareLink = [
		{ label: "Compare changes", href: `https://github.com/${owner}/${repoName}/compare/${previousSha}...${sha}` },
	];
	const prLinks = highSignalPrs.slice(0, MAX_LINKS - compareLink.length).map((pr) => ({
		label: `PR #${pr.number}`,
		href: pr.htmlUrl,
	}));
	const versionLabel = nextVersionLabel(data.entries[0]?.versionLabel);
	const entry = {
		releaseId: sha,
		versionLabel,
		title: `Release ${versionLabel}`,
		deployedAt: new Date().toISOString(),
		bullets: buildBullets(highSignalPrs),
		links: [...compareLink, ...prLinks],
		sourcePrs: highSignalPrs.map((pr) => pr.number),
	};
	if (!entry.bullets.length) {
		console.log("[whats-new] No changelog bullets generated after filtering. No changes.");
		return;
	}

	const next = normalizeData({
		latestReleaseId: sha,
		entries: [entry, ...data.entries],
		generatedAt: new Date().toISOString(),
	});
	await writeFile(DATA_PATH, `${JSON.stringify(next, null, 2)}\n`, "utf8");
	console.log(`[whats-new] Updated ${DATA_PATH} for ${sha.slice(0, 7)} with ${entry.sourcePrs.length} high-signal PRs.`);
}

main().catch((err) => {
	console.error("[whats-new] generation failed:", err);
	process.exit(1);
});
