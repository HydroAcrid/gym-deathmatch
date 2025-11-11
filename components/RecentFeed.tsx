"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export type FeedEvent = { message: string; timestamp: string };

export function RecentFeed({
	lobbyId,
	events
}: {
	lobbyId?: string;
	events?: FeedEvent[];
}) {
	const [items, setItems] = useState<FeedEvent[]>(events ?? []);

	// Seed from props when they change
	useEffect(() => {
		if (events && events.length) {
			setItems(limitAndFresh(events));
		}
	}, [events]);

	// Optional auto-refresh if lobbyId provided
	useEffect(() => {
		if (!lobbyId) return;
		let ignore = false;
		async function refresh() {
			try {
				const res = await fetch(`/api/lobby/${encodeURIComponent(lobbyId!)} /live`.replace(" /", "/"), { cache: "no-store" });
				if (!res.ok) return;
				const data = await res.json();
				if (ignore || !data?.lobby?.players) return;
				const evs: FeedEvent[] = buildFromLive(data);
				setItems(prev => mergeNewest(prev, evs));
			} catch {
				// ignore
			}
		}
		refresh();
		const id = setInterval(refresh, 12 * 60 * 1000); // 12 minutes
		return () => { ignore = true; clearInterval(id); };
	}, [lobbyId]);

	return (
		<motion.div
			className="paper-card paper-grain ink-edge p-5 flex flex-col gap-4 relative overflow-hidden transition-shadow duration-300 h-full"
			initial={{ opacity: 0, scale: 0.96, y: 12 }}
			animate={{ opacity: 1, scale: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } }}
			whileHover={{ y: -4, boxShadow: "0 6px 14px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)" }}
		>
			<div className="absolute left-0 top-0 bottom-0 w-2" style={{ backgroundColor: "#E1542A" }} />
			<div className="pl-2">
				<div className="poster-headline text-base mb-2">LIVE ARENA FEED</div>
				<div className="space-y-2 relative scroll-fade-bottom overflow-hidden flex-1">
					<AnimatePresence initial={false}>
						{(items.length ? items : defaultMockEvents()).map((e) => (
							<motion.div
								key={`${e.timestamp}-${e.message}`}
								initial={{ opacity: 0, y: 8 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -6 }}
								transition={{ duration: 0.5, ease: "easeOut" }}
								className="group flex items-start gap-2 p-2 transition rounded-none hover:ring-2 hover:ring-inset hover:ring-[rgba(225,84,42,0.35)]"
							>
								<div className="mt-0.5 text-lg">💬</div>
								<div className="flex-1">
									<div className="text-sm leading-tight">{e.message}</div>
									<div className="text-[11px] text-deepBrown/70">{timeAgo(e.timestamp)}</div>
								</div>
							</motion.div>
						))}
					</AnimatePresence>
				</div>
				<a href="/history" className="mt-3 inline-flex items-center gap-1 text-xs underline hover:shadow-[0_0_0_2px_rgba(225,84,42,0.25)] transition">
					View full history →
				</a>
			</div>
		</motion.div>
	);
}

function defaultMockEvents(): FeedEvent[] {
	const now = Date.now();
	return [
		{ message: "Kevin did 42m run — night grinder 🌙", timestamp: new Date(now - 10 * 60 * 1000).toISOString() },
		{ message: "Nelly hit weekly target (4) ✅", timestamp: new Date(now - 2 * 60 * 60 * 1000).toISOString() },
		{ message: "Kevin missed target (1) 💀", timestamp: new Date(now - 6 * 60 * 60 * 1000).toISOString() },
		{ message: "Nelly 6.2km ride — cold can’t stop her 🥶", timestamp: new Date(now - 20 * 60 * 60 * 1000).toISOString() }
	];
}

function limitAndFresh(evs: FeedEvent[]): FeedEvent[] {
	const day = 24 * 60 * 60 * 1000;
	const now = Date.now();
	return evs
		.filter(e => now - new Date(e.timestamp).getTime() <= day)
		.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
		.slice(0, 5);
}

function mergeNewest(prev: FeedEvent[], incoming: FeedEvent[]): FeedEvent[] {
	const map = new Map<string, FeedEvent>();
	for (const e of [...incoming, ...prev]) {
		map.set(`${e.timestamp}-${e.message}`, e);
	}
	return limitAndFresh([...map.values()]);
}

function timeAgo(iso: string) {
	const diff = Date.now() - new Date(iso).getTime();
	const m = Math.floor(diff / 60000);
	if (m < 1) return "just now";
	if (m < 60) return `${m}m ago`;
	const h = Math.floor(m / 60);
	if (h < 24) return `${h}h ago`;
	const d = Math.floor(h / 24);
	return `${d}d ago`;
}

// Builds a compact feed from /live payload without importing server types
function buildFromLive(data: any): FeedEvent[] {
	const evs: FeedEvent[] = [];
	for (const p of (data?.lobby?.players ?? [])) {
		const name = p.name || "Player";
		if (p.taunt) {
			evs.push({ message: `${name}: ${p.taunt}`, timestamp: data?.fetchedAt || new Date().toISOString() });
		}
		for (const a of (p.recentActivities ?? [])) {
			const msg = `${name} did ${a.durationMinutes}m ${readableType(a.type)} — ${a.name}`;
			evs.push({ message: msg, timestamp: a.startDate });
		}
		// Weekly target events
		for (const e of (p.events ?? [])) {
			const msg = e.met ? `${name} hit weekly target (${e.count}) ✅` : `${name} missed target (${e.count}) 💀`;
			evs.push({ message: msg, timestamp: e.weekStart });
		}
	}
	evs.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
	return evs.slice(0, 5);
}

function readableType(t: string) {
	const s = (t || "").toLowerCase();
	if (s.includes("run")) return "run 🏃";
	if (s.includes("ride") || s.includes("bike")) return "ride 🚴";
	if (s.includes("swim")) return "swim 🏊";
	if (s.includes("walk")) return "walk 🚶";
	if (s.includes("hike")) return "hike 🥾";
	return "session 💪";
}


