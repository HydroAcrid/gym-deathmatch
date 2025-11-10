"use client";

import { motion, useReducedMotion } from "framer-motion";
import { PropsWithChildren } from "react";

export function PageMotion({ children }: PropsWithChildren) {
	const prefersReduced = useReducedMotion();
	const variants = {
		hidden: { opacity: 0, y: prefersReduced ? 0 : 16 },
		show: {
			opacity: 1,
			y: 0,
			transition: { duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }
		}
	};
	return (
		<motion.div initial="hidden" animate="show" variants={variants}>
			{children}
		</motion.div>
	);
}


