"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/src/ui2/ui/button";
import { AlertTriangle, Coins, Dumbbell, Gavel, Heart, ScrollText, Swords, Trophy } from "lucide-react";

type SummaryPrimaryCard =
	| { kind: "pot"; amount: number; subtitle: string }
	| { kind: "punishment"; text: string; suggestedBy?: string | null; weekLabel?: string | null };

type SummaryToplineStats = {
	heartsLeadersShort: string;
	pointsLeaderShort: string;
};

export type PeriodSummaryData = {
	mode?: string;
	daily?: {
		dateKey: string;
		totalWorkouts: number;
		topPerformer?: { name: string; count: number } | null;
	};
	weekly?: {
		weekKey: string;
		totalWorkouts: number;
		topPerformer?: { name: string; count: number } | null;
	};
	pot?: number;
	hearts?: {
		leaders: string[];
		low: string[];
		max: number;
		min: number;
	};
	heartsDebug?: {
		playerCount: number;
		leadersRaw: Array<{ name: string; lives: number }>;
		lowRaw: Array<{ name: string; lives: number }>;
	};
	quips?: Array<{ text: string; created_at: string }>;
	quipsDaily?: Array<{ text: string; created_at: string }>;
	quipsWeekly?: Array<{ text: string; created_at: string }>;
	points?: {
		formula?: string;
		leaderboard?: Array<{ name: string; points: number; workouts: number; streak: number }>;
	};
	primarySummaryCard?: SummaryPrimaryCard;
	toplineStats?: SummaryToplineStats;
};

export function PeriodSummaryOverlay({
	open,
	onClose,
	data,
	period
}: {
	open: boolean;
	onClose: () => void;
	data: PeriodSummaryData | null;
	period: "daily" | "weekly";
}) {
	const [showHeartsFull, setShowHeartsFull] = useState(false);

	useEffect(() => {
		if (open) document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = "";
		};
	}, [open]);

	if (!open || !data) return null;
	const isWeekly = period === "weekly";
	const heading = isWeekly ? "WEEKLY WRAP" : "DAILY WRAP";
	const sub = isWeekly ? "One week in the arena" : "Today in the arena";
	const periodData = isWeekly ? data.weekly : data.daily;
	const periodQuips = isWeekly
		? (data.quipsWeekly ?? data.quips ?? [])
		: (data.quipsDaily ?? data.quips ?? []);
	const visibleEvents = periodQuips.slice(0, 6);
	const eventsCount = visibleEvents.length;
	const heartsLeadersArr = data.hearts?.leaders && data.hearts.leaders.length ? data.hearts.leaders : [];
	const heartsLowArr = data.hearts?.low && data.hearts.low.length ? data.hearts.low : [];
	const pointsLeaders = data.points?.leaderboard ?? [];
	const topPoints = pointsLeaders[0];
	const isChallengeMode = String(data.mode ?? "").startsWith("CHALLENGE_");
	const defaultPrimaryCard: SummaryPrimaryCard = isChallengeMode
		? { kind: "punishment", text: "Awaiting roulette punishment", suggestedBy: null, weekLabel: null }
		: { kind: "pot", amount: Number(data.pot ?? 0), subtitle: "Stakes climbing." };
	const primaryCard = data.primarySummaryCard ?? defaultPrimaryCard;
	const heartsLeadersShort =
		data.toplineStats?.heartsLeadersShort ??
		(heartsLeadersArr.length ? heartsLeadersArr.slice(0, 2).join(" • ") : "—");
	const pointsLeaderShort = data.toplineStats?.pointsLeaderShort ?? topPoints?.name ?? "—";
	const truncatedPunishment =
		primaryCard.kind === "punishment" && primaryCard.text.length > 28
			? `${primaryCard.text.slice(0, 28).trimEnd()}…`
			: primaryCard.kind === "punishment"
				? primaryCard.text
				: "";

	const containerVariants = {
		hidden: { opacity: 0, scale: 0.97, y: 20 },
		show: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.28, ease: "easeOut" } },
		exit: { opacity: 0, scale: 0.95, y: 20, transition: { duration: 0.2, ease: "easeIn" } }
	};

	const cardVariants = {
		hidden: { opacity: 0, y: 12 },
		show: (idx: number) => ({
			opacity: 1,
			y: 0,
			transition: { delay: 0.08 + idx * 0.04, duration: 0.22, ease: "easeOut" }
		})
	};

	const renderToplineCard = ({
		icon,
		label,
		value,
		compact = false,
		index
	}: {
		icon: ReactNode;
		label: string;
		value: string;
		compact?: boolean;
		index: number;
	}) => (
		<motion.div
			custom={index}
			variants={cardVariants}
			initial="hidden"
			animate="show"
			className="scoreboard-panel border-2 border-border px-3 py-3 sm:px-4 sm:py-3.5 min-h-[84px] flex flex-col justify-between"
		>
			<div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
				<span className="text-primary">{icon}</span>
				<span>{label}</span>
			</div>
			<div
				className={
					compact
						? "font-display text-xs min-[390px]:text-sm sm:text-base leading-snug text-foreground break-words"
						: "font-display text-lg min-[390px]:text-xl sm:text-2xl leading-none text-primary"
				}
			>
				{value}
			</div>
		</motion.div>
	);

	return (
		<AnimatePresence>
			<motion.div
				initial={{ opacity: 0, scale: 1.01 }}
				animate={{ opacity: 1, scale: 1 }}
				exit={{ opacity: 0, scale: 0.99, transition: { duration: 0.2, ease: "easeIn" } }}
				className="fixed inset-x-0 bottom-0 top-[calc(env(safe-area-inset-top,0px)+var(--nav-height))] z-[160] flex items-start justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-sm"
				onClick={onClose}
			>
				<motion.div
					variants={containerVariants}
					initial="hidden"
					animate="show"
					exit="exit"
					onClick={(e) => e.stopPropagation()}
					className="scoreboard-panel w-full sm:max-w-5xl h-full overflow-y-auto overflow-x-hidden [scrollbar-color:hsl(var(--border))_transparent] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-none p-2.5 sm:p-6 pt-3.5 sm:pt-6 pb-[calc(env(safe-area-inset-bottom,0px)+6.5rem)] sm:pb-8 border-2"
				>
					<div className="text-center mb-4 space-y-1">
						<div className="font-display text-xl sm:text-4xl tracking-[0.16em] sm:tracking-[0.2em] text-primary">{heading}</div>
						<div className="text-muted-foreground text-xs sm:text-sm uppercase tracking-[0.16em]">{sub}</div>
						<div className="mx-auto w-24 h-[2px] bg-primary/60" />
					</div>

					<div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-3 mb-4">
						{renderToplineCard({
							icon: <Dumbbell className="h-4 w-4" />,
							label: "Workouts",
							value: String(periodData?.totalWorkouts ?? 0),
							index: 0
						})}
						{renderToplineCard({
							icon: primaryCard.kind === "pot" ? <Coins className="h-4 w-4" /> : <Gavel className="h-4 w-4" />,
							label: primaryCard.kind === "pot" ? "Pot" : "Punishment",
							value: primaryCard.kind === "pot" ? `$${Number(primaryCard.amount ?? 0)}` : truncatedPunishment || "Awaiting",
							compact: primaryCard.kind === "punishment",
							index: 1
						})}
						{renderToplineCard({
							icon: <Heart className="h-4 w-4" />,
							label: "Hearts",
							value: heartsLeadersShort,
							compact: true,
							index: 2
						})}
						{renderToplineCard({
							icon: <Trophy className="h-4 w-4" />,
							label: "Points Leader",
							value: pointsLeaderShort,
							compact: true,
							index: 3
						})}
						{renderToplineCard({
							icon: <Swords className="h-4 w-4" />,
							label: "Arena Events",
							value: String(eventsCount),
							index: 4
						})}
					</div>

					<motion.div
						custom={5}
						variants={cardVariants}
						initial="hidden"
						animate="show"
						className="scoreboard-panel border-2 border-border bg-card text-foreground p-4 mb-4"
					>
						<div className="flex items-center gap-2 mb-2">
							{primaryCard.kind === "pot" ? (
								<Coins className="h-5 w-5 text-primary" />
							) : (
								<AlertTriangle className="h-5 w-5 text-primary" />
							)}
							<div className="font-display text-lg tracking-[0.12em] text-primary">
								{primaryCard.kind === "pot" ? "Pot" : "Current Punishment"}
							</div>
						</div>
						{primaryCard.kind === "pot" ? (
							<>
								<div className="text-4xl sm:text-5xl font-bold text-arena-gold mb-1">${Number(primaryCard.amount ?? 0)}</div>
								<div className="text-sm text-muted-foreground">{primaryCard.subtitle || "Stakes climbing."}</div>
							</>
						) : (
							<>
								<div className="font-display text-lg sm:text-2xl leading-tight text-foreground break-words">
									"{primaryCard.text || "Awaiting roulette punishment"}"
								</div>
								<div className="mt-2 text-xs sm:text-sm text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 uppercase tracking-[0.12em]">
									{primaryCard.weekLabel ? <span>{primaryCard.weekLabel}</span> : null}
									{primaryCard.suggestedBy ? <span>Suggested by {primaryCard.suggestedBy}</span> : null}
								</div>
							</>
						)}
					</motion.div>

					<div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
						<motion.div
							custom={6}
							variants={cardVariants}
							initial="hidden"
							animate="show"
							className="scoreboard-panel border-2 border-border bg-card text-foreground p-4"
						>
							<div className="flex items-center gap-2 mb-2">
								<Heart className="h-5 w-5 text-primary" />
								<div className="font-display text-lg tracking-[0.12em] text-primary">Hearts</div>
							</div>
							<div className="text-sm text-muted-foreground">Leaders: {heartsLeadersArr.length ? heartsLeadersArr.join(" • ") : "—"}</div>
							<div className="text-sm text-muted-foreground">Lowest: {heartsLowArr.length ? heartsLowArr.join(" • ") : "—"}</div>
							{(heartsLeadersArr.length > 3 || heartsLowArr.length > 3) && (
								<button
									className="text-[11px] mt-1 text-muted-foreground underline underline-offset-2"
									onClick={() => setShowHeartsFull((prev) => !prev)}
								>
									{showHeartsFull ? "Hide full list" : "Show full list"}
								</button>
							)}
							{showHeartsFull && (
								<div className="mt-2 text-xs space-y-1">
									<div className="text-muted-foreground">Leaders: {heartsLeadersArr.join(" • ") || "—"}</div>
									<div className="text-muted-foreground">Lowest: {heartsLowArr.join(" • ") || "—"}</div>
								</div>
							)}
							{data.heartsDebug && (
								<div className="mt-2 text-[11px] text-muted-foreground">Players counted: {data.heartsDebug.playerCount}</div>
							)}
						</motion.div>

						<motion.div
							custom={7}
							variants={cardVariants}
							initial="hidden"
							animate="show"
							className="scoreboard-panel border-2 border-border bg-card text-foreground p-4"
						>
							<div className="flex items-center gap-2 mb-2">
								<Trophy className="h-5 w-5 text-primary" />
								<div className="font-display text-lg tracking-[0.12em] text-primary">Points Board</div>
							</div>
							<div className="text-xs text-muted-foreground mb-2">
								{data.points?.formula ?? "Points = workouts + best streak - penalties"}
							</div>
							{pointsLeaders.length ? (
								<div className="space-y-1 text-sm text-muted-foreground">
									{pointsLeaders.map((row, idx) => (
										<div key={`${row.name}-${idx}`} className="flex items-center justify-between gap-3">
											<span className="truncate">{row.name}</span>
											<span className="font-display text-foreground">
												{row.points} pts ({row.workouts}W/{row.streak}S)
											</span>
										</div>
									))}
								</div>
							) : (
								<div className="text-sm text-muted-foreground">No points data yet.</div>
							)}
						</motion.div>
					</div>

					<motion.div
						custom={8}
						variants={cardVariants}
						initial="hidden"
						animate="show"
						className="scoreboard-panel border-2 border-border bg-card text-foreground p-4"
					>
						<div className="flex items-center gap-2 mb-2">
							<ScrollText className="h-5 w-5 text-primary" />
							<div className="font-display text-lg tracking-[0.12em] text-primary">Battle Log</div>
						</div>
						<div className="space-y-1 text-sm text-muted-foreground">
							{visibleEvents.length ? (
								visibleEvents.map((quip, idx) => (
									<div key={idx} className="flex items-start gap-2">
										<Swords className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
										<span className="leading-relaxed break-words">{quip.text}</span>
									</div>
								))
							) : (
								<div className="text-muted-foreground">Arena was quiet.</div>
							)}
						</div>
					</motion.div>

					<div className="flex justify-center mt-6">
						<Button variant="arenaPrimary" onClick={onClose} className="px-6 py-3 text-sm uppercase tracking-[0.16em]">
							Return
						</Button>
					</div>
				</motion.div>
			</motion.div>
		</AnimatePresence>
	);
}
