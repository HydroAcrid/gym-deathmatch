"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

export function QuipBubble({ text }: { text?: string | null }) {
	const [open, setOpen] = useState(false);
	const raw = (text ?? "").trim();
	const hasText = raw.length > 0;
	const MAX_INLINE = 72;
	const isTruncated = hasText && raw.length > MAX_INLINE;
	const inline = hasText
		? (isTruncated ? `${raw.slice(0, MAX_INLINE).trimEnd()}…` : raw)
		: "No quip yet.";

	return (
		<>
			<button
				type="button"
				onClick={() => {
					if (hasText) setOpen(true);
				}}
				disabled={!hasText}
				className={`relative w-full h-11 bg-muted/30 border border-border text-foreground rounded-md px-3 text-left ${
					hasText ? "hover:border-primary/40 cursor-pointer" : "opacity-60 cursor-default"
				}`}
				title={hasText ? raw : undefined}
			>
				<span className={`font-display text-sm italic block truncate ${hasText ? "" : "not-italic text-muted-foreground"}`}>
					{inline}
				</span>
			</button>

			<AnimatePresence>
				{open && hasText && (
					<motion.div
						className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						onClick={() => setOpen(false)}
					>
						<motion.div
							className="scoreboard-panel w-full max-w-lg p-5 border-2"
							initial={{ opacity: 0, scale: 0.96, y: 10 }}
							animate={{ opacity: 1, scale: 1, y: 0 }}
							exit={{ opacity: 0, scale: 0.96, y: 10 }}
							onClick={(e) => e.stopPropagation()}
						>
							<div className="font-display tracking-widest text-primary text-lg mb-2">QUIP</div>
							<div className="text-sm italic text-foreground break-words">{raw}</div>
							<div className="mt-4 flex justify-end">
								<button className="arena-badge px-4 py-2 text-xs" onClick={() => setOpen(false)}>
									Close
								</button>
							</div>
						</motion.div>
					</motion.div>
				)}
			</AnimatePresence>
		</>
	);
}

