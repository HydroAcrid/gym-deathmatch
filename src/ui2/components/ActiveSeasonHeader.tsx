"use client";

import { useEffect, useMemo, useState } from "react";
import { Swords, Users, Crown, Radio, Coins, Timer, AlertTriangle } from "lucide-react";

interface ActiveSeasonHeaderProps {
	seasonName: string;
	seasonNumber: number;
	gameMode: string;
	hostName: string;
	athleteCount: number;
	currentPot?: number;
	weeklyAnte?: number;
	showMoneyInfo?: boolean;
	seasonStart?: string;
	seasonEnd?: string;
	showCountdown?: boolean;
	showChallengeInfo?: boolean;
	challengePunishment?: {
		text: string;
		week?: number | null;
		submittedByName?: string | null;
		submittedByAvatarUrl?: string | null;
	} | null;
}

function formatMoney(amount: number): string {
	return new Intl.NumberFormat("en-US", {
		maximumFractionDigits: 0,
	}).format(Math.max(0, amount));
}

function pad2(value: number): string {
	return String(Math.max(0, value)).padStart(2, "0");
}

function formatCountdown(ms: number): string {
	if (ms <= 0) return "00:00:00";
	const totalSeconds = Math.floor(ms / 1000);
	const days = Math.floor(totalSeconds / 86400);
	const hours = Math.floor((totalSeconds % 86400) / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;
	return days > 0
		? `${days}D ${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`
		: `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
}

export function ActiveSeasonHeader({
	seasonName,
	seasonNumber,
	gameMode,
	hostName,
	athleteCount,
	currentPot = 0,
	weeklyAnte = 0,
	showMoneyInfo = false,
	seasonStart,
	seasonEnd,
	showCountdown = false,
	showChallengeInfo = false,
	challengePunishment = null,
}: ActiveSeasonHeaderProps) {
	const [nowMs, setNowMs] = useState<number | null>(null);

	useEffect(() => {
		setNowMs(Date.now());
		const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
		return () => window.clearInterval(timer);
	}, []);

	const countdown = useMemo(() => {
		if (!showCountdown || !seasonEnd || nowMs === null) {
			return { label: "FINAL BELL IN", value: "--:--:--", ended: false, progress: 0 };
		}

		const endTs = new Date(seasonEnd).getTime();
		if (!Number.isFinite(endTs)) {
			return { label: "FINAL BELL IN", value: "--:--:--", ended: false, progress: 0 };
		}

		const startTs = seasonStart ? new Date(seasonStart).getTime() : NaN;
		const remaining = Math.max(0, endTs - nowMs);
		const ended = remaining <= 0;

		let progress = 0;
		if (Number.isFinite(startTs) && endTs > startTs) {
			progress = Math.min(100, Math.max(0, ((nowMs - startTs) / (endTs - startTs)) * 100));
		}

		return {
			label: ended ? "FINAL BELL RUNG" : "FINAL BELL IN",
			value: ended ? "00:00:00" : formatCountdown(remaining),
			ended,
			progress,
		};
	}, [showCountdown, seasonEnd, nowMs, seasonStart]);

	return (
		<div className="scoreboard-panel p-6 sm:p-8 text-center relative overflow-hidden">
			<div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />

			<div className="absolute top-3 sm:top-4 right-3 sm:right-4 flex items-center gap-2">
				<div className="status-dot status-dot-active" />
				<span className="text-[10px] sm:text-xs font-display tracking-widest text-primary font-bold">
					LIVE
				</span>
			</div>

			<div className="relative z-10">
				<div className="flex items-center justify-center gap-2 sm:gap-3 mb-3 sm:mb-4">
					<Swords className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
					<h1 className="font-display text-xl sm:text-2xl md:text-3xl font-bold tracking-widest text-primary animate-marquee">
						THE ARENA IS LIVE
					</h1>
					<Swords className="w-5 h-5 sm:w-6 sm:h-6 text-primary transform scale-x-[-1]" />
				</div>

				<div className="inline-block mb-4 sm:mb-6">
					<div className="arena-badge arena-badge-primary px-4 py-1.5 text-[10px] sm:text-xs">
						SEASON {seasonNumber} — {seasonName}
					</div>
				</div>

				<div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs sm:text-sm">
					<div className="flex items-center gap-2">
						<Radio className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground" />
						<span className="text-muted-foreground font-display tracking-wider">MODE:</span>
						<span className="font-display font-bold text-foreground">{gameMode}</span>
					</div>

					<div className="w-px h-4 bg-border hidden sm:block" />

					<div className="flex items-center gap-2">
						<Crown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground" />
						<span className="text-muted-foreground font-display tracking-wider">HOST:</span>
						<span className="font-display font-bold text-foreground">{hostName}</span>
					</div>

					<div className="w-px h-4 bg-border hidden sm:block" />

					<div className="flex items-center gap-2">
						<Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground" />
						<span className="text-muted-foreground font-display tracking-wider">ATHLETES:</span>
						<span className="font-display font-bold text-foreground">{athleteCount}</span>
					</div>
				</div>

				{showChallengeInfo && (
					<div className="mt-5 sm:mt-6 mx-auto max-w-3xl border border-primary/35 bg-[linear-gradient(180deg,hsl(var(--primary)/0.12),transparent)] px-4 sm:px-6 py-4 text-left">
						<div className="flex items-center justify-between gap-3">
							<div className="flex items-center gap-2 text-[10px] sm:text-xs uppercase tracking-widest text-muted-foreground font-display">
								<AlertTriangle className="w-3.5 h-3.5 text-primary" />
								CURRENT ROULETTE PUNISHMENT
							</div>
							{typeof challengePunishment?.week === "number" && (
								<span className="arena-badge arena-badge-primary px-2 py-1 text-[10px]">
									WEEK {challengePunishment.week}
								</span>
							)}
						</div>
						<div className="mt-2 font-display text-lg sm:text-2xl text-primary leading-snug break-words">
							{challengePunishment?.text ? `"${challengePunishment.text}"` : "Awaiting roulette spin..."}
						</div>
						{challengePunishment?.submittedByName && (
							<div className="mt-3 flex items-center gap-2 text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground font-display">
								<div className="h-6 w-6 rounded-full overflow-hidden border border-border bg-muted shrink-0">
									{challengePunishment.submittedByAvatarUrl ? (
										<img src={challengePunishment.submittedByAvatarUrl} alt="" className="h-full w-full object-cover" />
									) : (
										<div className="h-full w-full flex items-center justify-center text-[10px] text-foreground">
											{challengePunishment.submittedByName.charAt(0).toUpperCase()}
										</div>
									)}
								</div>
								<span>SUGGESTED BY {challengePunishment.submittedByName}</span>
							</div>
						)}
					</div>
				)}

				{(showMoneyInfo || showCountdown) && (
					<div className="mt-5 sm:mt-6 mx-auto max-w-3xl border border-border/80 bg-card/50 px-4 sm:px-6 py-4">
						<div className="grid gap-4 sm:grid-cols-3 sm:items-stretch">
							{showMoneyInfo && (
								<div className="sm:col-span-1 border border-arena-gold/40 bg-[radial-gradient(circle_at_20%_15%,hsl(var(--arena-gold)/0.16),transparent_60%)] px-3 py-3 text-left relative overflow-hidden">
									<div className="absolute inset-0 pointer-events-none opacity-50" style={{ boxShadow: "inset 0 0 40px hsl(var(--arena-gold) / 0.12)" }} />
									<div className="relative z-10">
										<div className="flex items-center gap-2 mb-1">
											<Coins className="w-4 h-4 text-arena-gold" />
											<div className="text-[10px] sm:text-xs text-muted-foreground font-display tracking-widest">PRIZE POT</div>
										</div>
										<div
											className="font-display text-4xl sm:text-5xl leading-none font-bold text-arena-gold tracking-wide animate-[pulse_3.6s_ease-in-out_infinite]"
											style={{ textShadow: "0 0 18px hsl(var(--arena-gold) / 0.4)" }}
										>
											${formatMoney(currentPot)}
										</div>
										<div className="mt-2 text-[10px] sm:text-xs text-muted-foreground font-display tracking-widest">
											WEEKLY ANTE ${weeklyAnte}/WK
										</div>
									</div>
								</div>
							)}

							{showCountdown && (
								<div className={`${showMoneyInfo ? "sm:col-span-2" : "sm:col-span-3"} border border-border/70 bg-background/60 px-3 py-3`}>
									<div className="flex items-center justify-between gap-2 mb-2">
										<div className="flex items-center gap-2 text-[10px] sm:text-xs text-muted-foreground font-display tracking-widest">
											<Timer className="w-3.5 h-3.5" />
											{countdown.label}
										</div>
										<span className={`text-[10px] sm:text-xs font-display tracking-widest ${countdown.ended ? "text-destructive" : "text-primary"}`}>
											{countdown.ended ? "ENDED" : "ROUND LIVE"}
										</span>
									</div>
									<div className="font-display text-2xl sm:text-4xl tracking-[0.14em] text-foreground text-left">
										{countdown.value}
									</div>
									<div className="mt-3 h-2.5 border border-[hsl(var(--arena-gold)/0.35)] bg-[hsl(var(--arena-gold)/0.08)] overflow-hidden">
										<div
											className="h-full transition-all duration-1000 relative"
											style={{
												width: `${countdown.progress}%`,
												background: countdown.ended
													? "linear-gradient(90deg, hsl(var(--destructive) / 0.8), hsl(var(--destructive)))"
													: "linear-gradient(90deg, hsl(var(--arena-gold) / 0.85), hsl(var(--arena-gold)))",
												boxShadow: countdown.ended
													? "0 0 10px hsl(var(--destructive) / 0.5)"
													: "0 0 12px hsl(var(--arena-gold) / 0.6)",
											}}
										>
											<div className={`absolute inset-y-0 right-0 w-8 ${countdown.ended ? "bg-gradient-to-r from-transparent to-destructive/70" : "bg-gradient-to-r from-transparent to-[hsl(var(--arena-gold)/0.75)]"}`} />
										</div>
									</div>
								</div>
							)}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
