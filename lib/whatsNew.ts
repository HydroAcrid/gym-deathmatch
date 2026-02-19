import whatsNewJson from "@/data/whats-new.json";

export type WhatsNewLink = {
	label: string;
	href: string;
};

export type WhatsNewEntry = {
	releaseId: string;
	title: string;
	deployedAt: string;
	bullets: string[];
	links: WhatsNewLink[];
	sourcePrs: number[];
};

export type WhatsNewData = {
	latestReleaseId: string;
	entries: WhatsNewEntry[];
	generatedAt: string;
};

function asString(value: unknown): string {
	return typeof value === "string" ? value : "";
}

function asStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function asNumberArray(value: unknown): number[] {
	if (!Array.isArray(value)) return [];
	return value
		.map((item) => Number(item))
		.filter((item) => Number.isFinite(item) && item > 0)
		.map((item) => Math.floor(item));
}

function normalizeEntry(value: unknown): WhatsNewEntry | null {
	if (!value || typeof value !== "object" || Array.isArray(value)) return null;
	const row = value as Record<string, unknown>;
	const releaseId = asString(row.releaseId).trim();
	if (!releaseId) return null;
	const title = asString(row.title).trim() || `Release ${releaseId.slice(0, 7)}`;
	const deployedAt = asString(row.deployedAt).trim() || new Date(0).toISOString();
	const bullets = asStringArray(row.bullets).slice(0, 12);
	const links = Array.isArray(row.links)
		? row.links
				.map((link) => {
					if (!link || typeof link !== "object" || Array.isArray(link)) return null;
					const mapped = link as Record<string, unknown>;
					const label = asString(mapped.label).trim();
					const href = asString(mapped.href).trim();
					if (!label || !href) return null;
					return { label, href };
				})
				.filter((link): link is WhatsNewLink => !!link)
				.slice(0, 10)
		: [];
	return {
		releaseId,
		title,
		deployedAt,
		bullets,
		links,
		sourcePrs: asNumberArray(row.sourcePrs),
	};
}

export function normalizeWhatsNewData(raw: unknown): WhatsNewData {
	const fallback: WhatsNewData = {
		latestReleaseId: "",
		entries: [],
		generatedAt: new Date(0).toISOString(),
	};
	if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fallback;
	const mapped = raw as Record<string, unknown>;
	const entriesRaw = Array.isArray(mapped.entries) ? mapped.entries : [];
	const dedupedEntries: WhatsNewEntry[] = [];
	const seen = new Set<string>();
	for (const row of entriesRaw) {
		const entry = normalizeEntry(row);
		if (!entry) continue;
		if (seen.has(entry.releaseId)) continue;
		seen.add(entry.releaseId);
		dedupedEntries.push(entry);
	}
	const configuredLatestReleaseId = asString(mapped.latestReleaseId).trim();
	const latestReleaseId = dedupedEntries.some((entry) => entry.releaseId === configuredLatestReleaseId)
		? configuredLatestReleaseId
		: dedupedEntries[0]?.releaseId || "";
	return {
		latestReleaseId,
		entries: dedupedEntries,
		generatedAt: asString(mapped.generatedAt).trim() || new Date(0).toISOString(),
	};
}

export function getWhatsNewData(): WhatsNewData {
	return normalizeWhatsNewData(whatsNewJson);
}

export function getLatestWhatsNewEntry(input?: WhatsNewData): WhatsNewEntry | null {
	const data = input ?? getWhatsNewData();
	if (!data.entries.length) return null;
	if (!data.latestReleaseId) return data.entries[0];
	return data.entries.find((entry) => entry.releaseId === data.latestReleaseId) ?? data.entries[0];
}
