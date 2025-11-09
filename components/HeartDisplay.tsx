"use client";

import { motion } from "framer-motion";

export function HeartDisplay({ lives }: { lives: number }) {
	return (
		<div className="flex items-center gap-2 pl-2">
			{[0, 1, 2].map((i) => {
				const filled = i < lives;
				return (
					<motion.span
						key={i}
						className={`text-2xl ${filled ? "text-deepBrown" : "text-deepBrown/40"}`}
						whileHover={{ scale: 1.08 }}
						aria-label={filled ? "life" : "lost life"}
					>
						{filled ? "❤️" : "🤍"}
					</motion.span>
				);
			})}
			{lives === 1 && <span className="text-xs text-deepBrown/70 ml-1">ON THIN ICE…</span>}
		</div>
	);
}


