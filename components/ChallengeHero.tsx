"use client";

import { useEffect, useState } from "react";
import { Countdown } from "./Countdown";
import type { ChallengeSettings, GameMode } from "@/types/game";

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

export function ChallengeHero({
	lobbyId,
	mode,
	challengeSettings,
	seasonEnd
}: {
	lobbyId: string;
	mode?: GameMode;
	challengeSettings?: ChallengeSettings | null;
	seasonEnd?: string;
}) {
	const [punishmentText, setPunishmentText] = useState<string | null>(null);
	const [week, setWeek] = useState<number | null>(null);
	const [nextSpinIso, setNextSpinIso] = useState<string | null>(null);
	const [tz, setTz] = useState<string>("");

	async function load() {
		try {
			const res = await fetch(`/api/lobby/${encodeURIComponent(lobbyId)}/punishments`, { cache: "no-store" });
			if (!res.ok) return;
			const j = await res.json();
			setPunishmentText(j?.active?.text || null);
			setWeek(j?.week || null);
		} catch { /* ignore */ }
	}

	useEffect(() => {
		load();
		const id = setInterval(load, 30 * 1000); // refresh every 30s
		try { setTz(Intl.DateTimeFormat().resolvedOptions().timeZone || ""); } catch { /* ignore */ }
		return () => clearInterval(id);
	}, [lobbyId]);

	// Calculate next spin time based on spinFrequency
	useEffect(() => {
		if (!challengeSettings) {
			// Default to weekly
			const next = nextWeekStartLocal();
			setNextSpinIso(next.toISOString());
			return;
		}
		const { spinFrequency } = challengeSettings;
		if (spinFrequency === "WEEKLY") {
			const next = nextWeekStartLocal();
			setNextSpinIso(next.toISOString());
		} else if (spinFrequency === "BIWEEKLY") {
			const next = nextWeekStartLocal();
			next.setDate(next.getDate() + 7); // 2 weeks from now
			setNextSpinIso(next.toISOString());
		} else {
			// SEASON_ONLY - use season end
			setNextSpinIso(seasonEnd || null);
		}
	}, [challengeSettings, seasonEnd]);

	const isRoulette = mode === "CHALLENGE_ROULETTE";
	const isCumulative = mode === "CHALLENGE_CUMULATIVE";
	const label = isCumulative ? "CUMULATIVE CHALLENGES" : "WEEKLY PUNISHMENT";
	const spinFrequency = challengeSettings?.spinFrequency || "WEEKLY";
	const countdownLabel = spinFrequency === "SEASON_ONLY" ? "SEASON ENDS IN" : "NEXT SPIN IN";

	// If no active punishment yet, show placeholder
	const displayText = punishmentText || "No punishment selected yet";

	return (
		<div className="paper-card paper-grain ink-edge scoreboard-vignette px-4 sm:px-6 py-4 sm:py-5 text-center">
			<div className="uppercase tracking-[0.14em] text-[10px] sm:text-[11px] text-deepBrown/70 mb-1">
				{label}
			</div>
			<div className="flex flex-col md:flex-row items-center justify-center gap-2 md:gap-4">
				<div className="poster-headline text-3xl sm:text-4xl md:text-5xl lg:text-6xl leading-tight text-cream break-words max-w-full px-2">
					"{displayText}"
				</div>
				{nextSpinIso && (
					<div className="countdown-wrap mt-1 md:mt-0">
						<Countdown endIso={nextSpinIso} label={countdownLabel} />
					</div>
				)}
			</div>
			{/* Meta row */}
			<div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-[10px] sm:text-[11px] text-deepBrown/70 uppercase tracking-wide">
				{week && <span>WEEK {week}</span>}
				{week && tz && <span>•</span>}
				{tz && <span>{tz.replace(/_/g, " ")}</span>}
			</div>
		</div>
	);
}

