"use client";

import { AnimatePresence, motion } from "framer-motion";

export function CreateLobbyInfo({ open, onClose }: { open: boolean; onClose: () => void }) {
	return (
		<AnimatePresence>
			{open && (
				<motion.div className="fixed inset-0 z-[120] flex items-center justify-center" style={{ background: "var(--overlay-backdrop)" }}
					initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
					<motion.div className="paper-card paper-grain ink-edge max-w-md w-[92%] p-5" initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}>
						<div className="poster-headline text-xl mb-2">Lobby Info</div>
						<div className="space-y-3 text-sm">
							<section>
								<div className="poster-headline text-sm mb-1">Mode Selection</div>
								<div>Money modes end by KO (Survival) or last survivor wins (Last Man). Challenge modes use weekly punishments (Roulette/Cumulative).</div>
							</section>
							<section>
								<div className="poster-headline text-sm mb-1">Pot & Ante</div>
								<div>Pot grows each week by the configured ante. You can scale the ante with lobby size.</div>
							</section>
							<section>
								<div className="poster-headline text-sm mb-1">Hearts & Target</div>
								<div>Everyone starts with 3 hearts. Meet the weekly target to keep/regain a heart; miss it to lose hearts.</div>
							</section>
							<section>
								<div className="poster-headline text-sm mb-1">Challenge Settings</div>
								<div>Choose how punishments are selected and how often, control suggestions and lock rules, and show a public leaderboard.</div>
							</section>
							<section>
								<div className="poster-headline text-sm mb-1">Sudden Death</div>
								<div>Revive with 1 heart (cannot win the pot). Keeps KO’d players engaged.</div>
							</section>
							<section>
								<div className="poster-headline text-sm mb-1">Season Dates</div>
								<div>Countdown uses your local time. You can start now, schedule, or edit later.</div>
							</section>
							<section>
								<div className="poster-headline text-sm mb-1">Danger Zone</div>
								<div>Remove or transfer players and delete the lobby. Actions are logged.</div>
							</section>
						</div>
						<div className="mt-4 flex justify-end">
							<button className="btn-vintage px-4 py-2 rounded-md text-xs" onClick={onClose}>Got it</button>
						</div>
					</motion.div>
				</motion.div>
			)}
		</AnimatePresence>
	);
}


