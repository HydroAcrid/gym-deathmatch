"use client";

import { motion } from "framer-motion";

export default function GlobalLoading() {
	return (
		<div className="ui2-scope min-h-screen">
			<div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">
			<motion.div
				className="scoreboard-panel p-5"
				initial={{ opacity: 0.6 }} animate={{ opacity: 1 }} transition={{ repeat: Infinity, duration: 1.2, repeatType: "reverse" }}
			>
				<div className="h-4 w-40 bg-muted rounded mb-3" />
				<div className="h-3 w-64 bg-muted/60 rounded" />
			</motion.div>
			</div>
		</div>
	);
}


