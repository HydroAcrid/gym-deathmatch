"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { authFetch } from "@/lib/clientAuth";

export type FeedEvent = { message: string; timestamp: string };

export function RecentFeed({
	lobbyId,
	events
}: {
	lobbyId?: string;
	events?: FeedEvent[];
}) {
	const [items, setItems] = useState<any[]>([]);

	// Seed from props when they change
	useEffect(() => {
		if (events && events.length) {
			setItems(limitAndFresh(events));
		}
	}, [events]);

	// Fetch from /feed and refresh periodically
	useEffect(() => {
		if (!lobbyId) return;
		let ignore = false;
		async function refresh() {
			try {
				const lid = lobbyId as string;
				const res = await authFetch(`/api/lobby/${encodeURIComponent(lid)}/feed`, { cache: "no-store" });
				if (!res.ok) return;
				const data = await res.json();
				if (ignore) return;
				setItems(data.items ?? []);
			} catch {
				// ignore
			}
		}
		refresh();
		const id = setInterval(refresh, 30 * 1000);
		return () => { ignore = true; clearInterval(id); };
	}, [lobbyId]);

	return (
		<motion.div
			className="scoreboard-panel p-4 sm:p-5 flex flex-col gap-4 relative overflow-hidden transition-shadow duration-300 h-full"
			initial={{ opacity: 0, scale: 0.96, y: 12 }}
			animate={{ opacity: 1, scale: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } }}
			whileHover={{ y: -4 }}
		>
			<div className="absolute left-0 top-0 bottom-0 w-2 bg-primary" />
			<div className="pl-2 flex flex-col">
				<div className="font-display text-sm sm:text-base text-primary mb-2">LIVE ARENA FEED</div>
				<div className="space-y-2 relative scroll-fade-bottom overflow-y-auto max-h-[400px] pr-2">
					<AnimatePresence initial={false}>
						{items.map((e) => (
							<motion.div
								key={e.id}
								initial={{ opacity: 0, y: 8 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -6 }}
								transition={{ duration: 0.5, ease: "easeOut" }}
								className="group flex items-start gap-2 p-2 transition rounded-none hover:ring-2 hover:ring-inset hover:ring-primary/30 min-h-[44px] border-b border-border/60 last:border-b-0"
							>
								{e.player?.avatar_url ? (
									<img src={e.player.avatar_url} alt="" className="h-7 w-7 rounded-md object-cover" />
								) : (
									<div className="h-7 w-7 rounded-md bg-muted/40 flex items-center justify-center">💬</div>
								)}
								<div className="flex-1">
									<div className="text-sm leading-tight">
										{e.player?.name ? (() => {
											const name: string = e.player.name as string;
											let text: string = e.text || "";
											// If rendered text already begins with the name, strip it to avoid duplication
											if (text && name && text.toLowerCase().startsWith(name.toLowerCase())) {
												text = text.slice(name.length).replace(/^[:,\-–—]\s*/, "").trim();
											}
											return (
												<>
													<span className="font-semibold">{name}</span>
													{text ? <> — {text}</> : null}
												</>
											);
										})() : (e.text)}
									</div>
									<div className="text-[11px] text-muted-foreground">{timeAgo(e.createdAt)}</div>
								</div>
							</motion.div>
						))}
					</AnimatePresence>
					{items.length === 0 && (
						<div className="text-[12px] text-muted-foreground px-2 py-3">No events yet.</div>
					)}
				</div>
				<a href={lobbyId ? `/lobby/${encodeURIComponent(lobbyId)}/history` : "/history"} className="mt-3 inline-flex items-center gap-1 text-xs underline text-primary hover:shadow-[0_0_0_2px_rgba(214,177,87,0.25)] transition">
					View full history →
				</a>
			</div>
		</motion.div>
	);
}

function limitAndFresh(evs: FeedEvent[]): FeedEvent[] {
	const day = 24 * 60 * 60 * 1000;
	const now = Date.now();
	return evs
		.filter(e => now - new Date(e.timestamp).getTime() <= day)
		.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
		.slice(0, 5);
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

// Old helpers removed (feed now comes from /api/lobby/[id]/feed)
