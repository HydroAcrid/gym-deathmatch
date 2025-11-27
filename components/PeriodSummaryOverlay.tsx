"use client";

import { useEffect } from "react";
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

	return (
		<AnimatePresence>
			<motion.div
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				exit={{ opacity: 0 }}
				className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
				onClick={onClose}
			>
				<motion.div
					initial={{ opacity: 0, scale: 0.96, y: 20 }}
					animate={{ opacity: 1, scale: 1, y: 0 }}
					exit={{ opacity: 0, scale: 0.96, y: 20 }}
					transition={{ duration: 0.25, ease: "easeOut" }}
					className="paper-card paper-grain ink-edge max-w-4xl w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 border-4"
					style={{ borderColor: "#E1542A" }}
					onClick={(e) => e.stopPropagation()}
				>
					<div className="text-center mb-4">
						<div className="poster-headline text-2xl sm:text-3xl mb-1">{heading}</div>
						<div className="text-deepBrown/80 dark:text-cream/80 text-sm">{sub}</div>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div className="rounded-lg border border-deepBrown/15 dark:border-white/10 bg-cream/40 dark:bg-[#1a1512]/80 p-4 space-y-2">
							<div className="poster-headline text-base">WORKOUTS</div>
							<div className="text-3xl font-bold text-accent-primary">{pData?.totalWorkouts ?? 0}</div>
							<div className="text-sm text-deepBrown/70 dark:text-cream/70">
								Top: {pData?.topPerformer ? `${pData.topPerformer.name} (${pData.topPerformer.count})` : "—"}
							</div>
						</div>

						<div className="rounded-lg border border-deepBrown/15 dark:border-white/10 bg-cream/40 dark:bg-[#1a1512]/80 p-4 space-y-2">
							<div className="poster-headline text-base">POT</div>
							<div className="text-3xl font-bold text-accent-primary">${data.pot ?? 0}</div>
							<div className="text-sm text-deepBrown/70 dark:text-cream/70">Stakes climbing.</div>
						</div>

						<div className="rounded-lg border border-deepBrown/15 dark:border-white/10 bg-cream/40 dark:bg-[#1a1512]/80 p-4 space-y-2">
							<div className="poster-headline text-base">HEARTS</div>
							<div className="text-sm text-deepBrown/80 dark:text-cream/80">
								Leaders: {data.hearts?.leaders && data.hearts.leaders.length ? data.hearts.leaders.join(" • ") : "—"}
							</div>
							<div className="text-sm text-deepBrown/80 dark:text-cream/80">
								Lowest: {data.hearts?.low && data.hearts.low.length ? data.hearts.low.join(" • ") : "—"}
							</div>
						</div>

						<div className="rounded-lg border border-deepBrown/15 dark:border-white/10 bg-cream/40 dark:bg-[#1a1512]/80 p-4 space-y-2">
							<div className="poster-headline text-base">QUIPS</div>
							<div className="space-y-1 text-sm text-deepBrown/80 dark:text-cream/80">
								{data.quips && data.quips.length
									? data.quips.slice(0, 3).map((q, i) => <div key={i}>• {q.text}</div>)
									: "No callouts yet."}
							</div>
						</div>
					</div>

					<div className="flex justify-center mt-5">
						<Button variant="primary" size="md" onClick={onClose}>
							Continue
						</Button>
					</div>
				</motion.div>
			</motion.div>
		</AnimatePresence>
	);
}
