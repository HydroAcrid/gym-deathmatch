"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function ManualActivityModal({
	open,
	onClose,
	lobbyId,
	playerId,
	onSaved
}: {
	open: boolean;
	onClose: () => void;
	lobbyId: string;
	playerId: string;
	onSaved?: () => void;
}) {
	const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 16));
	const [type, setType] = useState<string>("gym");
	const [duration, setDuration] = useState<string>("");
	const [distance, setDistance] = useState<string>("");
	const [notes, setNotes] = useState<string>("");
	const [busy, setBusy] = useState<boolean>(false);

	async function submit() {
		setBusy(true);
		try {
			await fetch(`/api/lobby/${encodeURIComponent(lobbyId)}/activities/manual`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					playerId,
					date,
					type,
					durationMinutes: duration ? Number(duration) : null,
					distanceKm: distance ? Number(distance) : null,
					notes
				})
			});
			onClose();
			onSaved?.();
		} finally {
			setBusy(false);
		}
	}

	return (
		<AnimatePresence>
			{open && (
				<motion.div
					className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
				>
					<motion.div
						className="paper-card paper-grain ink-edge bg-tan text-deepBrown w-full h-[92vh] sm:h-auto sm:max-w-lg sm:w-[92%] p-4 sm:p-6 overflow-y-auto"
						initial={{ y: 20, opacity: 0 }}
						animate={{ y: 0, opacity: 1 }}
						exit={{ y: 20, opacity: 0 }}
						transition={{ duration: 0.2 }}
					>
						<div className="poster-headline text-xl sm:text-2xl mb-3">Log workout manually</div>
						<div className="grid gap-3">
							<label className="text-xs">
								<span className="block mb-1">Date & time</span>
								<input
									type="datetime-local"
									value={date}
									onChange={(e) => setDate(e.target.value)}
									className="w-full px-3 py-2 rounded-md border border-deepBrown/40 bg-cream text-deepBrown"
									style={{ colorScheme: "dark" }}
								/>
							</label>
							<label className="text-xs">
								<span className="block mb-1">Type</span>
								<select
									value={type}
									onChange={(e) => setType(e.target.value)}
									className="w-full px-3 py-2 rounded-md border border-deepBrown/40 bg-[#1f1a17] text-cream"
									style={{ colorScheme: "dark" }}
								>
									<option value="run">Run</option>
									<option value="ride">Ride</option>
									<option value="gym">Gym</option>
									<option value="walk">Walk</option>
									<option value="other">Other</option>
								</select>
							</label>
							<div className="grid grid-cols-2 gap-3">
								<label className="text-xs">
									<span className="block mb-1">Duration (min)</span>
									<input
										type="number"
										inputMode="numeric"
										min="0"
										value={duration}
										onChange={(e) => setDuration(e.target.value)}
										className="w-full px-3 py-2 rounded-md border border-deepBrown/40 bg-cream text-deepBrown"
										style={{ colorScheme: "dark" }}
									/>
								</label>
								<label className="text-xs">
									<span className="block mb-1">Distance (km)</span>
									<input
										type="number"
										inputMode="decimal"
										min="0"
										step="0.1"
										value={distance}
										onChange={(e) => setDistance(e.target.value)}
										className="w-full px-3 py-2 rounded-md border border-deepBrown/40 bg-cream text-deepBrown"
										style={{ colorScheme: "dark" }}
									/>
								</label>
							</div>
							<label className="text-xs">
								<span className="block mb-1">Notes (optional)</span>
								<textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={200}
									className="w-full px-3 py-2 rounded-md border border-deepBrown/40 bg-cream text-deepBrown min-h-[80px]" />
							</label>
						</div>

						<div className="mt-4 flex gap-2">
							<button className="btn-secondary px-3 py-2 rounded-md min-h-[44px] text-xs" onClick={onClose} disabled={busy}>
								Cancel
							</button>
							<button className="btn-vintage px-4 py-2 rounded-md min-h-[44px] text-xs" onClick={submit} disabled={busy}>
								Save workout
							</button>
						</div>
					</motion.div>
				</motion.div>
			)}
		</AnimatePresence>
	);
}


