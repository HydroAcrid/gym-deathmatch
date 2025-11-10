 "use client";
import { useEffect, useState } from "react";

type Event = { weekStart: string; met: boolean; count: number; player: string };

export default function HistoryPage() {
	const [events, setEvents] = useState<Event[]>([]);

	useEffect(() => {
		let ignore = false;
		async function load() {
			try {
				const res = await fetch("/api/lobby/kevin-nelly/live", { cache: "no-store" });
				const data = await res.json();
				if (ignore || !data?.lobby?.players) return;
				const evts: Event[] = [];
				for (const p of data.lobby.players) {
					if (!p.events) continue;
					for (const e of p.events) {
						evts.push({ weekStart: e.weekStart, met: e.met, count: e.count, player: p.name });
					}
				}
				evts.sort((a, b) => new Date(b.weekStart).getTime() - new Date(a.weekStart).getTime());
				setEvents(evts);
			} catch { /* ignore */ }
		}
		load();
		return () => { ignore = true; };
	}, []);

	return (
		<div className="mx-auto max-w-6xl">
			<div className="paper-card paper-grain ink-edge p-5 mb-6 border-b-4" style={{ borderColor: "#E1542A" }}>
				<div className="poster-headline text-lg">SEASON TIMELINE</div>
				<div className="text-deepBrown/70 text-xs">Auto‑generated from weekly targets</div>
			</div>
			<div className="space-y-3">
				{events.map((e, i) => (
					<div key={`${e.weekStart}-${e.player}-${i}`} className="relative paper-card paper-grain ink-edge p-4 flex items-center justify-between">
						<div className="text-xs text-deepBrown/70">
							{new Date(e.weekStart).toLocaleDateString()} • {e.player}
						</div>
						<div className="poster-headline text-xl">
							{e.met ? `MET (${e.count})` : `MISSED (${e.count})`}
						</div>
					</div>
				))}
				{events.length === 0 && <div className="text-deepBrown/70 text-sm">No history yet.</div>}
			</div>
		</div>
	);
}


