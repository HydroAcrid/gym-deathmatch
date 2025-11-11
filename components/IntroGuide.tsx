"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const STEPS = [
	{
		key: "welcome",
		headline: "WELCOME TO GYM DEATHMATCH",
		text: "Compete with friends to keep your streak alive. Lose all lives and you owe the pot.",
		sub: "Seasonal, brutal, and completely fair. Ready?",
		visual: "🥊"
	},
	{
		key: "hearts",
		headline: "💗 HEARTS ARE YOUR LIVES",
		text: "You start each season with 3 hearts. Miss your weekly goal and lose one. Hit your target — earn one back.",
		sub: "Fall to zero hearts, and you're out.",
		visual: "💗"
	},
	{
		key: "workouts",
		headline: "🏋️‍♂️ POST YOUR WORKOUTS",
		text: "Connect Strava for auto-tracking — or log workouts manually with a photo.",
		sub: "Friends can vote if a manual post looks sus 👀. Majority wins.",
		visual: "📸"
	},
	{
		key: "pot",
		headline: "💰 THE POT IS ON THE LINE",
		text: "Everyone adds to the weekly ante. The pot grows until someone loses all lives.",
		sub: "Owners can customize the starting pot, weekly ante, and scaling rules.",
		visual: "💵"
	},
	{
		key: "victory",
		headline: "🔥 SURVIVE THE SEASON",
		text: "When someone gets KO’d, the match ends. Winner takes bragging rights — loser pays the price.",
		sub: "Each KO is logged in the History feed, forever.",
		visual: "⚡"
	}
] as const;

export function IntroGuide() {
	const [open, setOpen] = useState(false);
	const [idx, setIdx] = useState(0);

	useEffect(() => {
		const seen = typeof window !== "undefined" ? localStorage.getItem("gymdm_seen_intro") : "1";
		if (!seen) {
			setOpen(true);
		}
	}, []);

	function close(markSeen: boolean) {
		if (markSeen) localStorage.setItem("gymdm_seen_intro", "1");
		setOpen(false);
	}

	const slide = STEPS[idx];
	const slideVariants = {
		initial: { opacity: 0, y: 12 },
		enter: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
		exit: { opacity: 0, y: -8, transition: { duration: 0.25, ease: "easeIn" } }
	};

	return (
		<>
			<button
				type="button"
				className="ml-3 btn-secondary px-2 py-1 text-xs"
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
						className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
					>
					<motion.div
						className="paper-card paper-grain ink-edge w-full sm:max-w-lg sm:w-[92%] p-5 sm:p-6 text-deepBrown bg-tan"
							initial={{ scale: 0.96, opacity: 0 }}
							animate={{ scale: 1, opacity: 1 }}
							exit={{ scale: 0.96, opacity: 0 }}
						>
							<AnimatePresence mode="wait">
								<motion.div key={slide.key} variants={slideVariants} initial="initial" animate="enter" exit="exit">
									<div className="flex items-center gap-3 mb-2">
										<div className="text-2xl sm:text-3xl" aria-hidden>{slide.visual}</div>
										<div className="poster-headline text-xl sm:text-2xl">{slide.headline}</div>
									</div>
									<p className="text-sm mb-1 whitespace-normal break-words">{slide.text}</p>
									{slide.sub ? <p className="text-[12px] text-deepBrown/70">{slide.sub}</p> : null}
									{/* subtle line */}
									<div className="mt-3 h-px w-full" style={{ backgroundColor: "rgba(74,38,32,0.25)" }} />
								</motion.div>
							</AnimatePresence>
							{/* Progress + controls */}
							<div className="flex items-center justify-between gap-3 mt-3">
								<div className="flex items-center gap-1" aria-label={`Step ${idx + 1} of ${STEPS.length}`}>
									{STEPS.map((s, i) => (
										<div
											key={s.key}
											className={`h-1.5 rounded-full transition-all ${i <= idx ? "bg-[#E1542A] w-6" : "bg-deepBrown/30 w-3"}`}
										/>
									))}
								</div>
								<div className="flex gap-2">
									{idx > 0 && (
										<button className="btn-secondary px-3 py-2 rounded-md text-xs min-h-[44px]" onClick={() => setIdx((i) => Math.max(0, i - 1))}>
											Back
										</button>
									)}
									{idx < STEPS.length - 1 ? (
										<button className="btn-vintage px-3 py-2 rounded-md text-xs min-h-[44px]" onClick={() => setIdx((i) => Math.min(STEPS.length - 1, i + 1))}>
											Next
										</button>
									) : (
										<button className="btn-vintage px-3 py-2 rounded-md text-xs min-h-[44px]" onClick={() => close(true)}>
											ENTER ARENA
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


