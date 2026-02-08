"use client";

import { motion } from "framer-motion";

export default function LobbiesLoading() {
	return (
		<div className="ui2-scope min-h-screen">
			<div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6">
				<motion.div className="scoreboard-panel p-5 mb-6" initial={{ opacity: .6 }} animate={{ opacity: 1 }} transition={{ repeat: Infinity, duration: 1.2, repeatType: "reverse" }}>
					<div className="h-4 w-40 bg-muted rounded" />
				</motion.div>
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div className="scoreboard-panel p-6 h-24" />
					<div className="scoreboard-panel p-6 h-24" />
				</div>
			</div>
		</div>
	);
}


