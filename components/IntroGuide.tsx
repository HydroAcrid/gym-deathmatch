"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const STEPS = [
	{
		title: "Welcome to Gym Deathmatch",
		body: "Compete with friends to keep your streak alive. Lose all lives and you owe the pot."
	},
	{
		title: "Connect Strava",
		body: "Hook up your Strava so workouts update automatically. Your streaks and totals stay fresh."
	},
	{
		title: "Stay Consistent",
		body: "Hit your weekly target to keep lives. Miss, and a life is gone. Last one standing pays."
	}
];

export function IntroGuide() {
	const [open, setOpen] = useState(false);
	const [idx, setIdx] = useState(0);

	useEffect(() => {
		const seen = typeof window !== "undefined" ? localStorage.getItem("gymdm_seen_intro") : "1";
		if (!seen) {
			setOpen(true);
		}
	}, []);

	function close(dontShowAgain: boolean) {
		if (dontShowAgain) localStorage.setItem("gymdm_seen_intro", "1");
		setOpen(false);
	}

	return (
		<>
			<button
				type="button"
				className="ml-3 px-2 py-1 rounded-md border border-deepBrown/30 text-deepBrown text-xs hover:bg-deepBrown/10"
				onClick={() => {
					setIdx(0);
					setOpen(true);
				}}
				aria-label="Open tutorial"
			>
				?
			</button>
			<AnimatePresence>
				{open && (
					<motion.div
						className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
					>
						<motion.div
							className="paper-card paper-grain ink-edge max-w-lg w-[92%] p-6 text-deepBrown bg-tan"
							initial={{ scale: 0.96, opacity: 0 }}
							animate={{ scale: 1, opacity: 1 }}
							exit={{ scale: 0.96, opacity: 0 }}
						>
							<div className="poster-headline text-2xl mb-2">{STEPS[idx].title}</div>
							<p className="text-sm mb-4">{STEPS[idx].body}</p>
							<div className="flex items-center justify-between">
								<div className="text-xs">
									Step {idx + 1} / {STEPS.length}
								</div>
								<div className="flex gap-2">
									<button className="px-3 py-2 rounded-md border border-deepBrown/30 text-xs" onClick={() => close(true)}>
										Don’t show again
									</button>
									{idx > 0 && (
										<button className="px-3 py-2 rounded-md border border-deepBrown/30 text-xs" onClick={() => setIdx((i) => i - 1)}>
											Back
										</button>
									)}
									{idx < STEPS.length - 1 ? (
										<button className="btn-vintage px-3 py-2 rounded-md text-xs" onClick={() => setIdx((i) => i + 1)}>
											Next
										</button>
									) : (
										<button className="btn-vintage px-3 py-2 rounded-md text-xs" onClick={() => close(true)}>
											Start
										</button>
									)}
								</div>
							</div>
						</motion.div>
					</motion.div>
				)}
			</AnimatePresence>
		</>
	);
}


