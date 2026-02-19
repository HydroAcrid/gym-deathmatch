"use client";

import { useEffect, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/src/ui2/ui/button";
import { Coins, Dumbbell, Flame, Heart, ScrollText, Swords, Trophy } from "lucide-react";

export type PeriodSummaryData = {
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
	const pData = isWeekly ? data.weekly : data.daily;
	const periodQuips = isWeekly
		? (data.quipsWeekly ?? data.quips ?? [])
		: (data.quipsDaily ?? data.quips ?? []);
	const eventsCount = periodQuips.length;
	const heartsLeadersArr = data.hearts?.leaders && data.hearts.leaders.length ? data.hearts.leaders : [];
	const heartsLowArr = data.hearts?.low && data.hearts.low.length ? data.hearts.low : [];
	const heartsLeaders = heartsLeadersArr.length ? heartsLeadersArr.slice(0, 3).join(" • ") + (heartsLeadersArr.length > 3 ? ` +${heartsLeadersArr.length - 3}` : "") : "—";
	const heartsLow = heartsLowArr.length ? heartsLowArr.slice(0, 3).join(" • ") + (heartsLowArr.length > 3 ? ` +${heartsLowArr.length - 3}` : "") : "—";
	const heartsValue = heartsLeadersArr.length ? heartsLeaders : "No data";
	const heartsDebug = data.heartsDebug;
	const spotlight = periodQuips.find(q => q.text.toLowerCase().includes("photo of the day"));
	const pointsLeaders = data.points?.leaderboard ?? [];
	const topPoints = pointsLeaders[0];

	const containerVariants = {
		hidden: { opacity: 0, scale: 0.96, y: 24 },
		show: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
		exit: { opacity: 0, scale: 0.9, y: 24, transition: { duration: 0.25, ease: "easeIn" } }
	};

	const cardVariants = {
		hidden: { opacity: 0, y: 12 },
		show: (i: number) => ({
			opacity: 1,
			y: 0,
			transition: { delay: 0.1 + i * 0.05, duration: 0.25, ease: "easeOut" }
		})
	};

	const renderStatPill = ({ icon, label, value }: { icon: ReactNode; label: string; value: string }) => (
		<motion.div
			custom={0}
			variants={cardVariants}
			className="scoreboard-panel border-2 border-border px-3 py-3 text-foreground min-h-[88px] flex flex-col justify-between"
		>
			<div className="flex items-center gap-2">
				<span className="text-primary">{icon}</span>
				<div className="uppercase tracking-[0.14em] text-[10px] text-muted-foreground">{label}</div>
			</div>
			<div className="text-left">
				<div className="font-display text-2xl sm:text-3xl leading-none text-primary">{value}</div>
			</div>
		</motion.div>
	);

	return (
		<AnimatePresence>
			<motion.div
				initial={{ opacity: 0, scale: 1.02 }}
				animate={{ opacity: 1, scale: 1 }}
				exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.25, ease: "easeIn" } }}
				className="fixed inset-x-0 bottom-0 top-[calc(env(safe-area-inset-top,0px)+var(--nav-height))] z-[160] flex items-start justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-sm"
				onClick={onClose}
			>
				<motion.div
					variants={containerVariants}
					initial="hidden"
					animate="show"
					exit="exit"
					className="scoreboard-panel w-full sm:max-w-4xl h-full overflow-y-auto overflow-x-hidden [scrollbar-color:hsl(var(--border))_transparent] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-none p-3 sm:p-6 pt-4 sm:pt-6 pb-[calc(env(safe-area-inset-bottom,0px)+6.5rem)] sm:pb-8 border-2 relative"
					onClick={(e) => e.stopPropagation()}
				>
					<div className="text-center mb-4 space-y-1 relative">
						<div className="font-display text-2xl sm:text-4xl tracking-[0.2em] text-primary">{heading}</div>
						<div className="text-muted-foreground text-xs sm:text-sm uppercase tracking-[0.16em]">{sub}</div>
						<div className="mx-auto w-24 h-[2px] bg-primary/60" />
					</div>

					<motion.div
						initial="hidden"
						animate="show"
						className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-3 mb-4"
					>
						{renderStatPill({ icon: <Dumbbell className="h-4 w-4" />, label: "WORKOUTS", value: `${pData?.totalWorkouts ?? 0}` })}
						{renderStatPill({ icon: <Coins className="h-4 w-4" />, label: "POT", value: `$${data.pot ?? 0}` })}
						{renderStatPill({ icon: <Heart className="h-4 w-4" />, label: "HEARTS", value: heartsValue })}
						{renderStatPill({ icon: <Trophy className="h-4 w-4" />, label: "POINTS LEADER", value: topPoints ? `${topPoints.name} ${topPoints.points}` : "—" })}
						{renderStatPill({ icon: <Swords className="h-4 w-4" />, label: "ARENA EVENTS", value: `${eventsCount}` })}
					</motion.div>

					{spotlight && (
						<motion.div
							variants={cardVariants}
							initial="hidden"
							animate="show"
							custom={0}
							className="scoreboard-panel border-2 border-primary/40 text-foreground p-4 mb-4"
						>
							<div className="flex items-center gap-2 text-[12px] uppercase tracking-[0.14em] text-muted-foreground">
								<Flame className="h-4 w-4 text-primary" />
								<span>Spotlight</span>
							</div>
							<div className="font-display text-xl mt-1 text-primary">ATHLETE SPOTLIGHT</div>
							<div className="text-sm mt-1">{spotlight.text}</div>
						</motion.div>
					)}

					<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
						<motion.div
							variants={cardVariants}
							initial="hidden"
							animate="show"
							custom={1}
							className="scoreboard-panel border-2 border-border bg-card text-foreground p-4"
						>
							<div className="flex items-center gap-2 mb-2">
								<Coins className="h-5 w-5 text-primary" />
								<div className="font-display text-lg tracking-[0.12em] text-primary">Pot</div>
							</div>
							<div className="text-4xl font-bold text-arena-gold mb-1">${data.pot ?? 0}</div>
							<div className="text-sm text-muted-foreground">Stakes climbing.</div>
						</motion.div>

						<motion.div
							variants={cardVariants}
							initial="hidden"
							animate="show"
							custom={2}
							className="scoreboard-panel border-2 border-border bg-card text-foreground p-4"
						>
							<div className="flex items-center gap-2 mb-2">
								<Heart className="h-5 w-5 text-primary" />
								<div className="font-display text-lg tracking-[0.12em] text-primary">Hearts</div>
							</div>
							<div className="text-sm text-muted-foreground">Leaders: {heartsLeaders}</div>
							<div className="text-sm text-muted-foreground">Lowest: {heartsLow}</div>
							{(heartsLeadersArr.length > 3 || heartsLowArr.length > 3) && (
								<button
									className="text-[11px] mt-1 text-muted-foreground underline underline-offset-2"
									onClick={() => setShowHeartsFull(!showHeartsFull)}
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
							{heartsDebug && (
								<div className="mt-2 text-[11px] text-muted-foreground">
									<span>Players counted: {heartsDebug.playerCount}</span>
								</div>
							)}
						</motion.div>

						{pointsLeaders.length > 0 && (
							<motion.div
								variants={cardVariants}
								initial="hidden"
								animate="show"
								custom={3}
								className="scoreboard-panel border-2 border-border bg-card text-foreground p-4 lg:col-span-2"
							>
								<div className="flex items-center gap-2 mb-2">
									<Trophy className="h-5 w-5 text-primary" />
									<div className="font-display text-lg tracking-[0.12em] text-primary">Points Board</div>
								</div>
									<div className="text-xs text-muted-foreground mb-2">
										{data.points?.formula ?? "Points = workouts + best streak - penalties"}
									</div>
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
							</motion.div>
						)}

						<motion.div
							variants={cardVariants}
							initial="hidden"
							animate="show"
							custom={4}
							className="scoreboard-panel border-2 border-border bg-card text-foreground p-4 lg:col-span-2"
						>
							<div className="flex items-center gap-2 mb-2">
								<ScrollText className="h-5 w-5 text-primary" />
								<div className="font-display text-lg tracking-[0.12em] text-primary">Battle Log</div>
							</div>
							<div className="space-y-1 text-sm text-muted-foreground">
								{periodQuips.length
									? periodQuips.slice(0, 5).map((q, i) => (
										<div key={i} className="flex items-start gap-2">
											<Swords className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
											<span className="leading-relaxed">{q.text}</span>
										</div>
									))
									: <div className="text-muted-foreground">Arena was quiet.</div>}
							</div>
						</motion.div>
					</div>

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
