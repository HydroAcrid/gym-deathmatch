"use client";

import { motion } from "framer-motion";

export function CashPool({ amount }: { amount: number }) {
	return (
		<motion.div className="paper-card paper-grain ink-edge p-0 overflow-hidden text-center">
			<div className="bg-burntOrange text-cream py-3">
				<div className="text-xs tracking-wider">CURRENT POT</div>
				<div className="poster-headline text-5xl leading-none mt-1">${amount}</div>
			</div>
			<div className="py-3 text-deepBrown text-xs">
				ANTE +$10 WEEKLY • FIRST TO 0 LIVES PAYS
			</div>
		</motion.div>
	);
}


