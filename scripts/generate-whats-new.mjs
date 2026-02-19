#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const DATA_PATH = resolve(process.cwd(), "data", "whats-new.json");
const MAX_BULLETS = 8;
const MAX_LINKS = 6;
const KNOWN_LABELS = ["feature", "ui", "backend", "infra", "security", "bug", "fix", "chore"];
const VERSION_RE = /^v?(\d+)\.(\d+)\.(\d+)$/;

function assertEnv(name) {
	const value = process.env[name];
	if (!value) throw new Error(`Missing required environment variable: ${name}`);
	return value;
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
			normalized.push({
				releaseId,
				versionLabel:
					normalizeVersionLabel(item.versionLabel) ||
					`v${new Date(item.deployedAt || Date.now()).getUTCFullYear()}.${String(
						new Date(item.deployedAt || Date.now()).getUTCMonth() + 1
					).padStart(2, "0")}.${String(new Date(item.deployedAt || Date.now()).getUTCDate()).padStart(2, "0")}`,
				title: typeof item.title === "string" && item.title.trim() ? item.title.trim() : `Release ${releaseId.slice(0, 7)}`,
				deployedAt: typeof item.deployedAt === "string" && item.deployedAt ? item.deployedAt : new Date().toISOString(),
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
		if (found) return key === "bug" ? "fix" : key;
	}
	return "other";
}

function buildBullets(prs) {
	if (!prs.length) return ["Internal release updates shipped."];
	const groups = new Map();
	for (const pr of prs) {
		const label = classifyLabel(pr.labels);
		const value = `${cleanTitle(pr.title)} (#${pr.number})`;
		if (!groups.has(label)) groups.set(label, []);
		const arr = groups.get(label);
		if (!arr.includes(value)) arr.push(value);
	}
	const ordered = [...KNOWN_LABELS.map((k) => (k === "bug" ? "fix" : k)), "other"];
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
	return bullets.length ? bullets : ["Internal release updates shipped."];
}

async function main() {
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
	const prNumberSet = new Set();

	try {
		if (previousSha) {
			const compareUrl = `https://api.github.com/repos/${owner}/${repoName}/compare/${previousSha}...${sha}`;
			const compare = await githubFetch(compareUrl, token);
			for (const commit of compare.commits ?? []) {
				for (const n of extractPrNumbersFromMessage(commit.commit?.message)) prNumberSet.add(n);
			}
			console.log(`[whats-new] compare discovered ${prNumberSet.size} PR references`);
		}
	} catch (err) {
		console.warn(`[whats-new] compare lookup failed: ${err instanceof Error ? err.message : String(err)}`);
	}

	if (!prNumberSet.size) {
		try {
			const prs = await githubFetch(`https://api.github.com/repos/${owner}/${repoName}/pulls?state=closed&sort=updated&direction=desc&per_page=20`, token);
			for (const pr of prs ?? []) {
				if (!pr?.number || !pr?.merged_at) continue;
				prNumberSet.add(Number(pr.number));
				if (prNumberSet.size >= 8) break;
			}
		} catch (err) {
			console.warn(`[whats-new] fallback PR lookup failed: ${err instanceof Error ? err.message : String(err)}`);
		}
	}

	const prNumbers = [...prNumberSet].sort((a, b) => b - a);
	const prDetails = [];
	for (const number of prNumbers.slice(0, 12)) {
		try {
			const pr = await githubFetch(`https://api.github.com/repos/${owner}/${repoName}/pulls/${number}`, token);
			prDetails.push({
				number,
				title: String(pr.title || `PR #${number}`),
				htmlUrl: String(pr.html_url || `https://github.com/${owner}/${repoName}/pull/${number}`),
				labels: Array.isArray(pr.labels) ? pr.labels.map((l) => String(l?.name || "")).filter(Boolean) : [],
			});
		} catch (err) {
			console.warn(`[whats-new] failed to load PR #${number}: ${err instanceof Error ? err.message : String(err)}`);
		}
	}

	const compareLink =
		previousSha && previousSha !== sha
			? [{ label: "Compare changes", href: `https://github.com/${owner}/${repoName}/compare/${previousSha}...${sha}` }]
			: [];
	const prLinks = prDetails.slice(0, MAX_LINKS - compareLink.length).map((pr) => ({
		label: `PR #${pr.number}`,
		href: pr.htmlUrl,
	}));
	const versionLabel = nextVersionLabel(data.entries[0]?.versionLabel);
	const entry = {
		releaseId: sha,
		versionLabel,
		title: `Release ${versionLabel}`,
		deployedAt: new Date().toISOString(),
		bullets: buildBullets(prDetails),
		links: [...compareLink, ...prLinks],
		sourcePrs: prDetails.map((pr) => pr.number),
	};

	const next = normalizeData({
		latestReleaseId: sha,
		entries: [entry, ...data.entries],
		generatedAt: new Date().toISOString(),
	});
	await writeFile(DATA_PATH, `${JSON.stringify(next, null, 2)}\n`, "utf8");
	console.log(`[whats-new] Updated ${DATA_PATH} for ${sha.slice(0, 7)} with ${entry.sourcePrs.length} PRs.`);
}

main().catch((err) => {
	console.error("[whats-new] generation failed:", err);
	process.exit(1);
});
