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
		<motion.div className="scoreboard-panel p-0 overflow-hidden text-center">
			<div className="bg-arena-gold/15 text-arena-gold pt-5 pb-3 md:pt-6 md:pb-4 border-b border-border">
				<div className="text-[11px] tracking-[0.14em] opacity-95">CURRENT POT</div>
				<div className="font-display text-6xl md:text-7xl leading-none mt-1">${displayAmount}</div>
			</div>
			<div className="py-2 text-muted-foreground text-[11px] tracking-wide">
				ANTE +$10 WEEKLY ★ FIRST TO 0 LIVES PAYS
			</div>
		</motion.div>
	);
}


