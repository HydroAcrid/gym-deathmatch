"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "./ui/Button";

type SummaryData = {
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
};

export function PeriodSummaryOverlay({
	open,
	onClose,
	data,
	period
}: {
	open: boolean;
onClose: () => void;
data: SummaryData | null;
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
	const eventsCount = data.quips?.length ?? 0;
	const heartsLeadersArr = data.hearts?.leaders && data.hearts.leaders.length ? data.hearts.leaders : [];
	const heartsLowArr = data.hearts?.low && data.hearts.low.length ? data.hearts.low : [];
	const heartsLeaders = heartsLeadersArr.length ? heartsLeadersArr.slice(0, 3).join(" • ") + (heartsLeadersArr.length > 3 ? ` +${heartsLeadersArr.length - 3}` : "") : "—";
	const heartsLow = heartsLowArr.length ? heartsLowArr.slice(0, 3).join(" • ") + (heartsLowArr.length > 3 ? ` +${heartsLowArr.length - 3}` : "") : "—";
	const heartsValue = heartsLeadersArr.length ? heartsLeaders : "No data";
	const heartsDebug = data.heartsDebug;
	const spotlight = (data.quips || []).find(q => q.text.toLowerCase().includes("photo of the day"));

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

	const StatPill = ({ icon, label, value }: { icon: string; label: string; value: string }) => (
		<motion.div
			custom={0}
			variants={cardVariants}
			className="flex items-center gap-3 px-3 py-2 rounded-full border border-primary/40 bg-muted/30 text-foreground"
		>
			<span className="text-lg">{icon}</span>
			<div className="text-left">
				<div className="uppercase tracking-[0.14em] text-[10px] text-muted-foreground">{label}</div>
				<div className="text-base font-semibold">{value}</div>
			</div>
		</motion.div>
	);

	return (
		<AnimatePresence>
			<motion.div
				initial={{ opacity: 0, scale: 1.02 }}
				animate={{ opacity: 1, scale: 1 }}
				exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.25, ease: "easeIn" } }}
				className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm"
				onClick={onClose}
			>
				<motion.div
					variants={containerVariants}
					initial="hidden"
					animate="show"
					exit="exit"
					className="scoreboard-panel w-full max-w-3xl sm:max-w-4xl max-h-[calc(100vh-140px)] sm:max-h-[90vh] overflow-y-scroll overflow-x-hidden [scrollbar-gutter:stable_both-edges] p-3 sm:p-6 pb-20 border-2 relative mt-10 sm:mt-0"
					onClick={(e) => e.stopPropagation()}
				>
					<div className="absolute inset-0 pointer-events-none mix-blend-screen opacity-[0.08] bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)),transparent_40%)]" />
					<div className="text-center mb-4 space-y-1 relative">
						<div className="font-display text-2xl sm:text-4xl tracking-[0.2em] text-primary">{heading}</div>
						<div className="text-muted-foreground text-xs sm:text-sm uppercase tracking-[0.16em]">{sub}</div>
						<div className="mx-auto w-16 h-[2px] bg-gradient-to-r from-primary/0 via-primary to-primary/0" />
					</div>

					<motion.div
						initial="hidden"
						animate="show"
						className="flex flex-col sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-3"
					>
						<StatPill icon="🏋️" label="WORKOUTS" value={`${pData?.totalWorkouts ?? 0}`} />
						<StatPill icon="💰" label="POT" value={`$${data.pot ?? 0}`} />
						<StatPill icon="❤️" label="HEARTS" value={heartsValue} />
						<StatPill icon="⚔️" label="ARENA EVENTS" value={`${eventsCount}`} />
					</motion.div>

					{spotlight && (
						<motion.div
							variants={cardVariants}
							initial="hidden"
							animate="show"
							custom={0}
							className="mb-4 rounded-xl border border-primary/40 bg-muted/30 text-foreground p-4"
						>
							<div className="flex items-center gap-2 text-[12px] uppercase tracking-[0.14em] text-muted-foreground">
								<span>🔥 Spotlight</span>
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
							className="rounded-xl border border-border bg-card text-foreground p-4"
						>
							<div className="flex items-center gap-2 mb-2">
								<span className="text-lg">💰</span>
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
							className="rounded-xl border border-border bg-card text-foreground p-4"
						>
							<div className="flex items-center gap-2 mb-2">
								<span className="text-lg">❤️</span>
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

						<motion.div
							variants={cardVariants}
							initial="hidden"
							animate="show"
							custom={3}
							className="rounded-xl border border-border bg-card text-foreground p-4 lg:col-span-2"
						>
							<div className="flex items-center gap-2 mb-2">
								<span className="text-lg">⚔️</span>
								<div className="font-display text-lg tracking-[0.12em] text-primary">Battle Log</div>
							</div>
							<div className="space-y-1 text-sm text-muted-foreground">
								{data.quips && data.quips.length
									? data.quips.slice(0, 5).map((q, i) => (
										<div key={i} className="flex items-start gap-2">
											<span className="text-muted-foreground">⚔️</span>
											<span className="leading-relaxed">{q.text}</span>
										</div>
									))
									: <div className="text-cream/60">Arena was quiet.</div>}
							</div>
						</motion.div>
					</div>

					<div className="flex justify-center mt-6">
						<Button variant="primary" size="md" onClick={onClose} className="px-6 py-3 text-sm uppercase tracking-[0.16em] shadow-[0_0_24px_rgba(225,84,42,0.4)]">
							Return
						</Button>
					</div>
				</motion.div>
			</motion.div>
		</AnimatePresence>
	);
}
