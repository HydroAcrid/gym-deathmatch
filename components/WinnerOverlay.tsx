"use client";

import { AnimatePresence, motion } from "framer-motion";

export function WinnerOverlay({
	open,
	onClose,
	winnerName,
	winnerAvatar,
	pot,
	lobbyId
}: {
	open: boolean;
	onClose: () => void;
	winnerName: string;
	winnerAvatar?: string;
	pot: number;
	lobbyId?: string;
}) {
	const [displayPot, setDisplayPot] = (typeof window !== "undefined") ? (require("react").useState as any)(0) : [0, () => {}];
	// Count up animation
	if (typeof window !== "undefined" && open) {
		const React = require("react");
		React.useEffect(() => {
			let raf: number;
			const start = performance.now();
			const dur = 1500;
			const step = (t: number) => {
				const p = Math.min(1, (t - start) / dur);
				const eased = 1 - Math.pow(1 - p, 3);
				setDisplayPot(Math.round(pot * eased));
				if (p < 1) raf = requestAnimationFrame(step);
			};
			raf = requestAnimationFrame(step);
			return () => cancelAnimationFrame(raf);
		}, [pot]);
	}
	// Auto-redirect to summary after 5s
	if (typeof window !== "undefined" && open && lobbyId) {
		setTimeout(() => {
			try { window.location.href = `/lobby/${encodeURIComponent(lobbyId)}/summary`; } catch { /* ignore */ }
		}, 5000);
	}
	return (
		<AnimatePresence>
			{open && (
				<motion.div
					className="fixed inset-0 z-[120] flex items-center justify-center"
					style={{ background: "rgba(0,0,0,0.75)" }}
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
				>
					<motion.div
						className="paper-card paper-grain ink-edge text-center px-8 py-6 relative overflow-hidden"
						initial={{ scale: 0.96, opacity: 0 }}
						animate={{ scale: 1, opacity: 1 }}
						exit={{ scale: 0.96, opacity: 0 }}
					>
						{/* confetti */}
						<div className="pointer-events-none absolute inset-0">
							<div className="absolute -top-2 left-1/4 animate-bounce">🎉</div>
							<div className="absolute -top-2 left-1/2 animate-bounce">🎊</div>
							<div className="absolute -top-2 left-3/4 animate-bounce">✨</div>
							{/* coin pour */}
							<div className="absolute -top-4 right-8 animate-[fall_1.2s_linear_infinite]">🪙</div>
							<div className="absolute -top-4 right-14 animate-[fall_1.4s_linear_infinite]">🪙</div>
							<div className="absolute -top-4 right-20 animate-[fall_1.6s_linear_infinite]">🪙</div>
						</div>
						<div className="poster-headline text-2xl mb-2">WINNER</div>
						<div className="mx-auto h-20 w-20 rounded-full overflow-hidden bg-tan border border-deepBrown/30 mb-2">
							{winnerAvatar ? <img src={winnerAvatar} alt="winner" className="h-full w-full object-cover" /> : <div className="h-full w-full flex items-center justify-center text-3xl">🏆</div>}
						</div>
						<div className="poster-headline text-xl mb-1">{winnerName.toUpperCase()}</div>
						<div className="text-sm text-deepBrown/80 mb-4">survives them all • Pot: ${displayPot || pot}</div>
						<div className="flex gap-2 justify-center">
							<button className="btn-vintage px-4 py-2 rounded-md text-xs" onClick={onClose}>Close</button>
							<button
								className="px-4 py-2 rounded-md border border-deepBrown/30 text-xs"
								onClick={async () => {
									const url = typeof window !== "undefined" ? window.location.href : "";
									const text = `🏆 ${winnerName} wins Gym Deathmatch! Pot: $${pot}`;
									try {
										if (navigator.share) {
											await navigator.share({ title: "Gym Deathmatch", text, url });
										} else {
											await navigator.clipboard.writeText(`${text} — ${url}`);
										}
									} catch { /* ignore */ }
								}}
							>
								Share
							</button>
						</div>
					</motion.div>
				</motion.div>
			)}
		</AnimatePresence>
	);
}


