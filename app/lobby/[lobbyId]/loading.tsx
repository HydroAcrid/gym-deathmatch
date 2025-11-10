"use client";

import { motion } from "framer-motion";

export default function LobbyLoading() {
	return (
		<div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6">
			<motion.div className="paper-card paper-grain ink-edge p-4 mb-6" initial={{ opacity: .6 }} animate={{ opacity: 1 }} transition={{ repeat: Infinity, duration: 1.2, repeatType: "reverse" }}>
				<div className="h-4 w-56 bg-deepBrown/20 rounded mb-2" />
				<div className="h-3 w-40 bg-deepBrown/15 rounded" />
			</motion.div>
			<div className="paper-card paper-grain ink-edge p-8 h-40" />
		</div>
	);
}


