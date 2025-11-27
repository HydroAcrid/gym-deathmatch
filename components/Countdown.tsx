"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

function getRemaining(end: Date) {
	const total = Math.max(0, end.getTime() - Date.now());
	const days = Math.floor(total / (1000 * 60 * 60 * 24));
	const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
	const minutes = Math.floor((total / (1000 * 60)) % 60);
	const seconds = Math.floor((total / 1000) % 60);
	return { days, hours, minutes, seconds, total };
}

export function Countdown({ 
	endIso, 
	label = "SEASON ENDS IN",
	onReachedZero 
}: { 
	endIso: string; 
	label?: string;
	onReachedZero?: () => void;
}) {
	const end = useMemo(() => new Date(endIso), [endIso]);
	const [remaining, setRemaining] = useState(() => getRemaining(end));
	const [mounted, setMounted] = useState(false);
	const prefersReduced = useReducedMotion();
	const hasFiredRef = useRef<boolean>(false);
	
	useEffect(() => {
		setMounted(true);
		// Reset the fired flag when the end time changes
		hasFiredRef.current = false;
		setRemaining(getRemaining(end));
	}, [end]);
	
	useEffect(() => {
		const t = setInterval(() => {
			const newRemaining = getRemaining(end);
			setRemaining(newRemaining);
			// Trigger callback once when countdown reaches zero
			if (newRemaining.total === 0 && !hasFiredRef.current && onReachedZero) {
				hasFiredRef.current = true;
				onReachedZero();
			}
		}, 1000);
		return () => clearInterval(t);
	}, [end, onReachedZero]);
	const numVariants = {
		initial: prefersReduced ? {} : { opacity: 0, rotateX: -90, y: -6 },
		animate: prefersReduced ? {} : { opacity: 1, rotateX: 0, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
		exit: prefersReduced ? {} : { opacity: 0, rotateX: 90, y: 6, transition: { duration: 0.3, ease: "easeIn" } }
	};
	if (!mounted) return null;
	return (
		<div className="inline-flex items-center gap-3 px-3 py-2 bg-elevated rounded-md border border-strong ink-edge">
			<div className="text-[10px] text-muted">{label}</div>
			<div className="flex gap-2 items-baseline poster-headline text-2xl text-main">
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
				{/* Seconds: animate only the digits; keep the suffix static and clip overflow to avoid ghost glyphs */}
				<span className="inline-flex items-baseline overflow-hidden">
					<AnimatePresence mode="popLayout" initial={false}>
						<motion.span
							className="text-xl inline-block w-[2ch] tabular-nums text-right"
							key={`s-${remaining.seconds}`}
							{...numVariants}
						>
							{String(remaining.seconds).padStart(2, "0")}
						</motion.span>
					</AnimatePresence>
					<span className="text-xl">&nbsp;S</span>
				</span>
			</div>
		</div>
	);
}

