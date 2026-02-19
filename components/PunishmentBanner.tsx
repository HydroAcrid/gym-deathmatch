"use client";

import { useCallback, useEffect, useState } from "react";
import { authFetch } from "@/lib/clientAuth";

function nextWeekStartLocal(): Date {
	const now = new Date();
	const day = now.getDay(); // 0 Sun..6 Sat
	// Next Sunday 00:00 local
	const daysUntilSun = (7 - day) % 7;
	const base = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntilSun, 0, 0, 0, 0);
	if (base.getTime() <= now.getTime()) {
		base.setDate(base.getDate() + 7);
	}
	return base;
}

export function PunishmentBanner({ lobbyId }: { lobbyId: string }) {
	const [text, setText] = useState<string | null>(null);
	const [eta, setEta] = useState<number>(0);
	const [tz, setTz] = useState<string>("");

	const load = useCallback(async () => {
		try {
			const res = await authFetch(`/api/lobby/${encodeURIComponent(lobbyId)}/punishments`, { cache: "no-store" });
			if (!res.ok) return;
			const j = await res.json();
			setText(j?.active?.text || null);
		} catch { /* ignore */ }
	}, [lobbyId]);

	useEffect(() => {
		load();
		const id = setInterval(() => setEta(nextWeekStartLocal().getTime() - Date.now()), 1000);
		try { setTz(Intl.DateTimeFormat().resolvedOptions().timeZone || ""); } catch { /* ignore */ }
		return () => clearInterval(id);
	}, [load]);

	if (!text) return null;
	const ms = Math.max(0, eta);
	const d = Math.floor(ms / 86400000);
	const h = Math.floor((ms % 86400000) / 3600000);
	const m = Math.floor((ms % 3600000) / 60000);
	const s = Math.floor((ms % 60000) / 1000);

	return (
		<div className="scoreboard-panel px-3 py-2 mb-3">
			<div className="flex flex-wrap items-center gap-2">
				<div className="text-xs text-muted-foreground">WEEKLY PUNISHMENT</div>
				<div className="text-sm text-foreground">“{text}”</div>
				<div className="ml-auto text-xs text-muted-foreground">{d}d {h}h {m}m {String(s).padStart(2, "0")}s · {tz || "local"}</div>
				<a href="#suggest-punishment" className="text-xs underline ml-2 text-primary">Suggest</a>
			</div>
		</div>
	);
}
