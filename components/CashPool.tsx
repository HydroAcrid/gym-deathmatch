"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

export function CashPool({ amount }: { amount: number }) {
	const prefersReduced = useReducedMotion();
	const [displayAmount, setDisplayAmount] = useState(0);
	const raf = useRef<number | null>(null);

	useEffect(() => {
		if (prefersReduced) {
			setDisplayAmount(amount);
			return;
		}
		const start = performance.now();
		const duration = 800;
		const from = 0;
		const to = amount;
		const ease = (t: number) => 1 - Math.pow(1 - t, 3); // easeOutCubic
		const tick = (now: number) => {
			const elapsed = now - start;
			const p = Math.min(1, elapsed / duration);
			const v = Math.round(from + (to - from) * ease(p));
			setDisplayAmount(v);
			if (p < 1) raf.current = requestAnimationFrame(tick);
		};
		raf.current = requestAnimationFrame(tick);
		return () => {
			if (raf.current) cancelAnimationFrame(raf.current);
		};
	}, [amount, prefersReduced]);

	return (
		<motion.div className="paper-card paper-grain ink-edge p-0 overflow-hidden text-center ring-1" style={{ boxShadow: "0 12px 30px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)", borderColor: "rgba(225,84,42,0.35)" }}>
			<div className="bg-burntOrange text-cream pt-5 pb-3 md:pt-6 md:pb-4">
				<div className="text-[11px] tracking-[0.14em] opacity-95">CURRENT POT</div>
				<div className="poster-headline text-6xl md:text-7xl leading-none mt-1">${displayAmount}</div>
			</div>
			<div className="py-1 text-deepBrown text-s tracking-wide">
				ANTE +$10 WEEKLY ★ FIRST TO 0 LIVES PAYS
			</div>
		</motion.div>
	);
}


