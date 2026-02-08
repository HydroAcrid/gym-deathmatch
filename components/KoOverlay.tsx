"use client";
import { motion, AnimatePresence } from "framer-motion";

export function KoOverlay({
	open,
	onClose,
	lobbyId,
	loserName,
	loserAvatar,
	pot
}: {
	open: boolean;
	onClose: () => void;
	lobbyId: string;
	loserName: string;
	loserAvatar?: string;
	pot: number;
}) {
	return (
		<AnimatePresence>
			{open && (
				<motion.div className="fixed inset-0 z-[120] bg-black/80 flex items-center justify-center p-4"
					initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
					<motion.div
						className="ui2-scope relative text-center text-foreground"
						initial={{ scale: 0.8, rotate: -2, opacity: 0 }}
						animate={{ scale: 1, rotate: 0, opacity: 1 }}
						exit={{ scale: 0.9, opacity: 0 }}
						transition={{ type: "spring", stiffness: 120, damping: 12 }}
					>
						<div className="font-display text-4xl sm:text-6xl mb-2 text-primary">KO!</div>
						<div className="mx-auto h-20 w-20 sm:h-24 sm:w-24 rounded-full overflow-hidden border-2 border-border mb-3 bg-muted">
							{loserAvatar ? <img src={loserAvatar} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full flex items-center justify-center text-3xl">💀</div>}
						</div>
						<div className="font-display text-xl sm:text-2xl mb-1">{loserName.toUpperCase()}</div>
						<div className="text-muted-foreground mb-2 text-sm">KO’d with 0 hearts remaining.</div>
						<div className="font-display text-2xl sm:text-3xl text-arena-gold">Pot reached: ${pot}</div>
						<div className="mt-4 flex items-center justify-center gap-2">
							<a href={`/lobby/${encodeURIComponent(lobbyId)}/summary`} className="arena-badge arena-badge-primary px-4 py-2">View Season Summary</a>
							<button className="arena-badge px-3 py-2" onClick={onClose}>Close</button>
						</div>
					</motion.div>
				</motion.div>
			)}
		</AnimatePresence>
	);
}


