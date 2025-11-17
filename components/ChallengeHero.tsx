"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Countdown } from "./Countdown";
import type { ChallengeSettings, GameMode } from "@/types/game";

// Calculate next week start based on season_start (7 days from start, not calendar weeks)
function nextWeekFromSeasonStart(seasonStartIso: string | undefined | null, currentWeek: number | null): Date | null {
	if (!seasonStartIso) return null;
	const start = new Date(seasonStartIso);
	const now = Date.now();
	// Calculate which week we're in (0-indexed from season start)
	const weekMs = 7 * 24 * 60 * 60 * 1000;
	const weeksSinceStart = Math.floor((now - start.getTime()) / weekMs);
	// Next week is (weeksSinceStart + 1) weeks from start
	const nextWeekStart = new Date(start.getTime() + (weeksSinceStart + 1) * weekMs);
	return nextWeekStart;
}

export function ChallengeHero({
	lobbyId,
	mode,
	challengeSettings,
	seasonStart,
	seasonEnd
}: {
	lobbyId: string;
	mode?: GameMode;
	challengeSettings?: ChallengeSettings | null;
	seasonStart?: string;
	seasonEnd?: string;
}) {
	const router = useRouter();
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
		const { spinFrequency } = challengeSettings || { spinFrequency: "WEEKLY" };
		const now = Date.now();
		
		// Always prioritize seasonEnd if it's set and in the future
		if (seasonEnd) {
			const seasonEndTime = new Date(seasonEnd).getTime();
			if (seasonEndTime > now) {
				// Check if we should use seasonEnd or next week
				if (spinFrequency === "SEASON_ONLY") {
					// SEASON_ONLY - always use season end
					setNextSpinIso(seasonEnd);
					return;
				}
				
				// For WEEKLY and BIWEEKLY, calculate next week from season_start
				let nextWeek: Date | null = null;
				if (seasonStart) {
					nextWeek = nextWeekFromSeasonStart(seasonStart, week);
					if (nextWeek && spinFrequency === "BIWEEKLY") {
						// For biweekly, add another week
						nextWeek.setTime(nextWeek.getTime() + 7 * 24 * 60 * 60 * 1000);
					}
				}
				
				// Use whichever is sooner: seasonEnd or nextWeek
				if (nextWeek && nextWeek.getTime() < seasonEndTime) {
					setNextSpinIso(nextWeek.toISOString());
				} else {
					setNextSpinIso(seasonEnd);
				}
				return;
			}
		}
		
		// If no seasonEnd or it's in the past, calculate from season_start
		if (seasonStart) {
			const nextWeek = nextWeekFromSeasonStart(seasonStart, week);
			if (nextWeek) {
				if (spinFrequency === "BIWEEKLY") {
					// For biweekly, add another week
					nextWeek.setTime(nextWeek.getTime() + 7 * 24 * 60 * 60 * 1000);
				}
				setNextSpinIso(nextWeek.toISOString());
				return;
			}
		}
		
		// Last resort: no countdown
		setNextSpinIso(null);
	}, [challengeSettings, seasonStart, seasonEnd, week]);

	const isRoulette = mode === "CHALLENGE_ROULETTE";
	const isCumulative = mode === "CHALLENGE_CUMULATIVE";
	const label = isCumulative ? "CUMULATIVE CHALLENGES" : "WEEKLY PUNISHMENT";
	const spinFrequency = challengeSettings?.spinFrequency || "WEEKLY";
	
	// Determine countdown label based on what we're actually showing
	const isShowingSeasonEnd = nextSpinIso && seasonEnd && nextSpinIso === seasonEnd;
	const countdownLabel = (spinFrequency === "SEASON_ONLY" || isShowingSeasonEnd) ? "SEASON ENDS IN" : "NEXT SPIN IN";

	// Handle countdown reaching zero
	const handleCountdownZero = async () => {
		if (isShowingSeasonEnd || spinFrequency === "SEASON_ONLY") {
			// Season ended - refresh to show completed status
			setTimeout(() => router.refresh(), 1000);
		} else if (countdownLabel === "NEXT SPIN IN" && mode === "CHALLENGE_ROULETTE") {
			// Next spin time reached - transition to transition_spin
			try {
				await fetch(`/api/lobby/${encodeURIComponent(lobbyId)}/stage`, {
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ status: "transition_spin" })
				});
				// If autoSpinAtWeekStart is enabled, automatically spin
				if (challengeSettings?.autoSpinAtWeekStart) {
					// Wait a moment for the status to update, then spin
					setTimeout(async () => {
						try {
							await fetch(`/api/lobby/${encodeURIComponent(lobbyId)}/spin`, {
								method: "POST"
							});
						} catch { /* ignore */ }
					}, 500);
				}
				// Refresh to show transition_spin panel
				setTimeout(() => router.refresh(), 1000);
			} catch { /* ignore */ }
		}
	};

	// If no active punishment yet, show placeholder
	const displayText = punishmentText || "No punishment selected yet";

	return (
		<div className="paper-card paper-grain ink-edge scoreboard-vignette px-4 sm:px-6 py-4 sm:py-5 text-center">
			<div className="uppercase tracking-[0.14em] text-[10px] sm:text-[11px] text-deepBrown/70 mb-1">
				{label}
			</div>
			<div className="flex flex-col items-center justify-center gap-4">
				<div className="poster-headline text-3xl sm:text-4xl md:text-5xl lg:text-6xl leading-tight text-cream break-words max-w-full px-2">
					"{displayText}"
				</div>
				{nextSpinIso && (
					<div className="countdown-wrap">
						<Countdown endIso={nextSpinIso} label={countdownLabel} onReachedZero={handleCountdownZero} />
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

