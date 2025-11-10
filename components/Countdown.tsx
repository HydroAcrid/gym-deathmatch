"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

function getRemaining(end: Date) {
	const total = Math.max(0, end.getTime() - Date.now());
	const days = Math.floor(total / (1000 * 60 * 60 * 24));
	const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
	const minutes = Math.floor((total / (1000 * 60)) % 60);
	return { days, hours, minutes };
}

export function Countdown({ endIso }: { endIso: string }) {
	const end = useMemo(() => new Date(endIso), [endIso]);
	const [remaining, setRemaining] = useState(() => getRemaining(end));
	const prefersReduced = useReducedMotion();
	const [seconds, setSeconds] = useState<number | null>(null); // client-only to avoid hydration mismatch
	useEffect(() => {
		const t = setInterval(() => setRemaining(getRemaining(end)), 1000);
		return () => clearInterval(t);
	}, [end]);
	useEffect(() => {
		// Initialize seconds on client only
		const tick = () => setSeconds(new Date().getSeconds());
		tick();
		const s = setInterval(tick, 1000);
		return () => clearInterval(s);
	}, []);
	const numVariants = {
		initial: prefersReduced ? {} : { opacity: 0, rotateX: -90, y: -6 },
		animate: prefersReduced ? {} : { opacity: 1, rotateX: 0, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
		exit: prefersReduced ? {} : { opacity: 0, rotateX: 90, y: 6, transition: { duration: 0.3, ease: "easeIn" } }
	};
	return (
		<div className="inline-flex items-center gap-3 px-3 py-2 bg-cream rounded-md border border-deepBrown/40 ink-edge">
			<div className="text-[10px] text-deepBrown/70">SEASON ENDS IN</div>
			<div className="flex gap-2 items-baseline poster-headline text-2xl text-deepBrown">
				<AnimatePresence mode="popLayout" initial={false}>
					<motion.span key={`d-${remaining.days}`} {...numVariants}>
						{remaining.days} DAYS
					</motion.span>
				</AnimatePresence>
				<span>·</span>
				<AnimatePresence mode="popLayout" initial={false}>
					<motion.span key={`h-${remaining.hours}`} {...numVariants}>
						{remaining.hours} H
					</motion.span>
				</AnimatePresence>
				<span>·</span>
				<AnimatePresence mode="popLayout" initial={false}>
					<motion.span key={`m-${remaining.minutes}`} {...numVariants}>
						{remaining.minutes} M
					</motion.span>
				</AnimatePresence>
				<span>·</span>
				{seconds !== null && (
					<motion.span className="text-xl" key={`s-${seconds}`}>
						{String(seconds).padStart(2, "0")} S
					</motion.span>
				)}
			</div>
		</div>
	);
}


