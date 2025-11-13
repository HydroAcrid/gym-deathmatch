"use client";

import { AnimatePresence, motion } from "framer-motion";

export function CreateLobbyInfo({ open, onClose }: { open: boolean; onClose: () => void }) {
	return (
		<AnimatePresence>
			{open && (
				<motion.div className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6 bg-black/70"
					initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
					<motion.article className="ui-panel rounded-2xl shadow-2xl border px-5 sm:px-8 py-5 sm:py-6 w-full sm:max-w-[68ch] md:max-w-[72ch] max-w-full break-anywhere whitespace-normal" initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}>
						<header className="mb-3">
							<h2 className="text-xl font-black tracking-wide">Lobby Info</h2>
						</header>
						<div className="space-y-4 text-sm leading-6 break-anywhere whitespace-normal">
							<section>
								<h3 className="font-bold uppercase tracking-wide text-xs ui-panel-muted">Mode Selection</h3>
								<p>Money modes end by KO (Survival) or last survivor wins (Last Man). Challenge modes use weekly punishments (Roulette/Cumulative).</p>
							</section>
							<section>
								<h3 className="font-bold uppercase tracking-wide text-xs ui-panel-muted">Pot & Ante</h3>
								<p>Pot grows each week by the configured ante. You can scale the ante with lobby size.</p>
							</section>
							<section>
								<h3 className="font-bold uppercase tracking-wide text-xs ui-panel-muted">Hearts & Target</h3>
								<p>Everyone starts with 3 hearts. Meet the weekly target to keep/regain a heart; miss it to lose hearts.</p>
							</section>
							<section>
								<h3 className="font-bold uppercase tracking-wide text-xs ui-panel-muted">Challenge Settings</h3>
								<p>Choose how punishments are selected and how often, control suggestions and lock rules, and show a public leaderboard.</p>
							</section>
							<section>
								<h3 className="font-bold uppercase tracking-wide text-xs ui-panel-muted">Sudden Death</h3>
								<p>Revive with 1 heart (cannot win the pot). Keeps KO’d players engaged.</p>
							</section>
							<section>
								<h3 className="font-bold uppercase tracking-wide text-xs ui-panel-muted">Season Dates</h3>
								<p>Countdown uses your local time. You can start now, schedule, or edit later.</p>
							</section>
							<section>
								<h3 className="font-bold uppercase tracking-wide text-xs ui-panel-muted">Danger Zone</h3>
								<p>Remove or transfer players and delete the lobby. Actions are logged.</p>
							</section>
						</div>
						<footer className="mt-5 flex justify-end">
							<button className="btn-vintage px-4 py-2 rounded-md text-xs" onClick={onClose}>Got it</button>
						</footer>
					</motion.article>
				</motion.div>
			)}
		</AnimatePresence>
	);
}


