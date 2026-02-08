"use client";

import { motion, useReducedMotion } from "framer-motion";

export function HeartDisplay({ lives }: { lives: number }) {
	const prefersReduced = useReducedMotion();
	return (
		<div className="flex items-center gap-2 pl-2">
			{[0, 1, 2].map((i) => {
				const filled = i < lives;
				return (
					<motion.span
						key={i}
						className={`text-2xl ${filled ? "text-destructive" : "text-muted-foreground/40"}`}
						whileHover={{ scale: 1.08 }}
						animate={
							prefersReduced
								? undefined
								: { scale: filled ? [1, 1.06, 1] : 1 }
						}
						transition={
							prefersReduced
								? undefined
								: { duration: 1.8, repeat: Infinity, repeatDelay: 2.2, ease: "easeInOut" }
						}
						aria-label={filled ? "life" : "lost life"}
					>
						{filled ? "❤️" : "🤍"}
					</motion.span>
				);
			})}
			{lives === 1 && <span className="text-xs text-muted-foreground ml-1">ON THIN ICE…</span>}
		</div>
	);
}


