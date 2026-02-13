"use client";

import { useEffect, useRef, useState } from "react";
import { Coins, Heart, Target, Trophy } from "lucide-react";
import type { ArenaCommandCenterVM } from "@/src/ui2/adapters/arenaCommandCenter";
import { LobbyQuickSwitchSheet } from "@/src/ui2/components/LobbyQuickSwitchSheet";
import { StandingsPreview } from "@/src/ui2/components/StandingsPreview";

interface ArenaCommandCenterProps {
	vm: ArenaCommandCenterVM;
}

function stageToneClass(tone: "muted" | "primary" | "neutral"): string {
	if (tone === "primary") return "arena-badge arena-badge-primary";
	if (tone === "neutral") return "arena-badge";
	return "arena-badge";
}

export function ArenaCommandCenter({ vm }: ArenaCommandCenterProps) {
	const fullHeaderRef = useRef<HTMLDivElement | null>(null);
	const [showStickyStrip, setShowStickyStrip] = useState(false);

	useEffect(() => {
		if (typeof window === "undefined") return;

		const checkStickyVisibility = () => {
			const fullHeader = fullHeaderRef.current;
			if (!fullHeader) return;
			const root = window.getComputedStyle(document.documentElement);
			const navHeight = Number.parseInt(root.getPropertyValue("--nav-height"), 10);
			const threshold = (Number.isFinite(navHeight) ? navHeight : 72) + 8;
			const nextValue = fullHeader.getBoundingClientRect().bottom <= threshold;
			setShowStickyStrip((previousValue) => (previousValue === nextValue ? previousValue : nextValue));
		};

		checkStickyVisibility();
		window.addEventListener("scroll", checkStickyVisibility, { passive: true });
		window.addEventListener("resize", checkStickyVisibility);
		return () => {
			window.removeEventListener("scroll", checkStickyVisibility);
			window.removeEventListener("resize", checkStickyVisibility);
		};
	}, []);

	const heartsText = vm.myPlayerSummary
		? `${vm.myPlayerSummary.hearts}/${vm.myPlayerSummary.maxHearts}`
		: "--";
	const rankText = vm.myPlayerSummary?.rank ? `#${vm.myPlayerSummary.rank}` : "--";

	return (
		<div className="space-y-3">
			{showStickyStrip ? (
				<div
					className="sticky z-[85]"
					style={{ top: "calc(env(safe-area-inset-top, 0px) + var(--nav-height) + 4px)" }}
				>
					<div className="scoreboard-panel px-3 py-2">
						<div className="flex items-center justify-between gap-2">
							<div className="min-w-0 truncate font-display text-xs tracking-widest text-foreground">
								{vm.currentLobby.name}
							</div>
							<div className="shrink-0 font-display text-[10px] tracking-widest text-muted-foreground">
								{rankText} • {heartsText} HEARTS • {vm.weekSummary.timeRemaining}
							</div>
						</div>
					</div>
				</div>
			) : null}

			<section ref={fullHeaderRef} className="scoreboard-panel p-3 sm:p-4">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<LobbyQuickSwitchSheet
						currentLobbyId={vm.currentLobby.id}
						currentLobbyName={vm.currentLobby.name}
					/>
					<div className="flex flex-wrap items-center gap-1.5">
						<span className="arena-badge px-2 py-1 text-[10px]">SEASON {vm.seasonNumber}</span>
						<span className={`${stageToneClass(vm.stageBadge.tone)} px-2 py-1 text-[10px]`}>
							{vm.stageBadge.label}
						</span>
					</div>
				</div>

				<div className="mt-3 grid grid-cols-2 gap-2">
					<div className="border-2 border-border bg-muted/20 px-3 py-2">
						<div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
							<Trophy className="h-3.5 w-3.5 text-arena-gold" />
							<span className="font-display tracking-widest">YOUR RANK</span>
						</div>
						<div className="mt-1 font-display text-lg text-arena-gold">{rankText}</div>
						<div className="font-display text-[10px] tracking-wider text-muted-foreground">
							{vm.myPlayerSummary?.points ?? "--"} PTS
						</div>
					</div>

					<div className="border-2 border-border bg-muted/20 px-3 py-2">
						<div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
							<Heart className="h-3.5 w-3.5 text-destructive" />
							<span className="font-display tracking-widest">HEARTS</span>
						</div>
						<div className="mt-1 font-display text-lg text-foreground">{heartsText}</div>
						<div className="font-display text-[10px] tracking-wider text-muted-foreground">
							{vm.myPlayerSummary?.weeklyProgress ?? 0}/{vm.myPlayerSummary?.weeklyTarget ?? 0} THIS WEEK
						</div>
					</div>

					<div className="border-2 border-border bg-muted/20 px-3 py-2">
						<div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
							<Target className="h-3.5 w-3.5 text-primary" />
							<span className="font-display tracking-widest">WEEK</span>
						</div>
						<div className="mt-1 font-display text-lg text-foreground">
							{vm.weekSummary.currentWeek}/{vm.weekSummary.totalWeeks}
						</div>
						<div className="font-display text-[10px] tracking-wider text-muted-foreground">
							{vm.weekSummary.timeRemaining}
						</div>
					</div>

					{vm.potSummary ? (
						<div className="border-2 border-border bg-muted/20 px-3 py-2">
							<div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
								<Coins className="h-3.5 w-3.5 text-arena-gold" />
								<span className="font-display tracking-widest">POT</span>
							</div>
							<div className="mt-1 font-display text-lg text-arena-gold">${vm.potSummary.amount}</div>
							<div className="font-display text-[10px] tracking-wider text-muted-foreground">
								ANTE ${vm.potSummary.weeklyAnte}/WK
							</div>
						</div>
					) : (
						<div className="border-2 border-border bg-muted/20 px-3 py-2">
							<div className="text-[10px] text-muted-foreground font-display tracking-widest">WORKOUTS</div>
							<div className="mt-1 font-display text-lg text-foreground">{vm.myPlayerSummary?.workouts ?? 0}</div>
							<div className="font-display text-[10px] tracking-wider text-muted-foreground">
								STREAK {vm.myPlayerSummary?.streak ?? 0}
							</div>
						</div>
					)}
				</div>

				<div className="mt-3 h-2 overflow-hidden border border-[hsl(var(--arena-gold)/0.35)] bg-[hsl(var(--arena-gold)/0.08)]">
					<div
						className="h-full transition-all duration-700"
						style={{
							width: `${vm.weekSummary.progressPercent}%`,
							background:
								"linear-gradient(90deg, hsl(var(--arena-gold) / 0.85), hsl(var(--arena-gold)))",
							boxShadow: "0 0 10px hsl(var(--arena-gold) / 0.55)",
						}}
					/>
				</div>

				<div className="mt-3">
					<StandingsPreview
						entries={vm.standingsPreview.top}
						myRank={vm.standingsPreview.myRank}
						totalAthletes={vm.standingsPreview.totalAthletes}
					/>
				</div>
			</section>
		</div>
	);
}
