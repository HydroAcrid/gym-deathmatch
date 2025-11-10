"use client";
import { useEffect, useMemo, useState } from "react";
import { oneLinerFromActivity, getPlayerBadges } from "@/lib/messages";

type FeedItem =
	| { kind: "activity"; when: string; player: string; line: string; icon: string }
	| { kind: "event"; when: string; player: string; line: string; icon: string };

export default function HistoryPage() {
	const [feed, setFeed] = useState<FeedItem[]>([]);

	useEffect(() => {
		let ignore = false;
		async function load() {
			try {
				const res = await fetch("/api/lobby/kevin-nelly/live", { cache: "no-store" });
				const data = await res.json();
				if (ignore || !data?.lobby?.players) return;
				const items: FeedItem[] = [];
				for (const p of data.lobby.players) {
					// recent activities → one-liners
					for (const a of (p.recentActivities ?? [])) {
						const icon = iconForType(a.type);
						items.push({
							kind: "activity",
							when: a.startDate,
							player: p.name,
							line: oneLinerFromActivity(p.name, a),
							icon
						});
					}
					// lives/events highlights
					for (const e of (p.events ?? [])) {
						items.push({
							kind: "event",
							when: e.weekStart,
							player: p.name,
							line: e.met ? `Weekly target met (${e.count})` : `Missed target (${e.count}) — a life trembles`,
							icon: e.met ? "✅" : "⚠️"
						});
					}
					// badges (optional) attach as separate items
					const firstActivity = p.recentActivities?.[0];
					const badges = getPlayerBadges(p.recentActivities ?? []);
					if (firstActivity && badges.length) {
						items.push({
							kind: "event",
							when: firstActivity.startDate,
							player: p.name,
							line: badges.join(" • "),
							icon: "🏅"
						});
					}
				}
				items.sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime());
				setFeed(items);
			} catch { /* ignore */ }
		}
		load();
		return () => { ignore = true; };
	}, []);

	return (
		<div className="mx-auto max-w-6xl">
			<div className="paper-card paper-grain ink-edge p-5 mb-6 border-b-4" style={{ borderColor: "#E1542A" }}>
				<div className="poster-headline text-lg">SEASON TIMELINE</div>
				<div className="text-deepBrown/70 text-xs">Live feed of workouts and highlights</div>
			</div>
			<div className="space-y-3">
				{feed.map((f, i) => (
					<div key={`${f.when}-${f.player}-${i}`} className="relative paper-card paper-grain ink-edge p-4 flex items-center justify-between">
						<div className="text-xs text-deepBrown/70">
							{new Date(f.when).toLocaleString()} • {f.player}
						</div>
						<div className="flex items-center gap-2">
							<span className="text-lg">{f.icon}</span>
							<div className="text-sm">{f.line}</div>
						</div>
					</div>
				))}
				{feed.length === 0 && <div className="text-deepBrown/70 text-sm">No history yet.</div>}
			</div>
		</div>
	);
}

function iconForType(t: string) {
	const s = (t || "").toLowerCase();
	if (s.includes("run")) return "🏃";
	if (s.includes("ride") || s.includes("bike")) return "🚴";
	if (s.includes("swim")) return "🏊";
	if (s.includes("walk")) return "🚶";
	if (s.includes("hike")) return "🥾";
	return "💪";
}


