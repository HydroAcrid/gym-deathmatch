"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "./ToastProvider";

export function OwnerSettingsModal({
	lobbyId,
	defaultWeekly,
	defaultLives,
	defaultSeasonEnd,
	onSaved
}: {
	lobbyId: string;
	defaultWeekly: number;
	defaultLives: number;
	defaultSeasonEnd: string;
	onSaved: () => void;
}) {
	const [open, setOpen] = useState(false);
	const [weekly, setWeekly] = useState<number>(defaultWeekly);
	const [lives, setLives] = useState<number>(defaultLives);
	const [seasonStart, setSeasonStart] = useState<string>("");
	const [seasonEnd, setSeasonEnd] = useState<string>(defaultSeasonEnd.slice(0, 16).replace("Z", ""));
	const [saving, setSaving] = useState(false);
	const toast = useToast();

	async function save() {
		setSaving(true);
		try {
			const res = await fetch(`/api/lobby/${encodeURIComponent(lobbyId)}/settings`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					weeklyTarget: Number(weekly),
					initialLives: Number(lives),
					seasonStart: seasonStart ? new Date(seasonStart).toISOString() : undefined,
					seasonEnd: new Date(seasonEnd).toISOString()
				})
			});
			if (res.ok) {
				toast.push("Settings saved");
				onSaved();
				setOpen(false);
			} else {
				toast.push("Failed to save settings");
			}
		} finally {
			setSaving(false);
		}
	}

	return (
		<>
			<button
				className="px-2 py-1 rounded-md border border-deepBrown/30 text-deepBrown text-xs hover:bg-deepBrown/10"
				title="Lobby settings"
				onClick={() => setOpen(true)}
			>
				⚙️
			</button>
			<AnimatePresence>
				{open && (
					<motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
						initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
						<motion.div className="paper-card paper-grain ink-edge max-w-lg w-[92%] p-6 bg-tan"
							initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}>
							<div className="poster-headline text-xl mb-3">Lobby Settings</div>
							<div className="grid md:grid-cols-4 gap-3 items-end">
								<label className="text-xs">
									<span className="block mb-1">Weekly target</span>
									<input type="number" min={1} className="w-full px-3 py-2 rounded-md border border-deepBrown/40 bg-cream text-deepBrown"
										value={weekly} onChange={e => setWeekly(Number(e.target.value))} />
								</label>
								<label className="text-xs">
									<span className="block mb-1">Initial lives</span>
									<input type="number" min={1} className="w-full px-3 py-2 rounded-md border border-deepBrown/40 bg-cream text-deepBrown"
										value={lives} onChange={e => setLives(Number(e.target.value))} />
								</label>
								<label className="text-xs md:col-span-2">
									<span className="block mb-1">Season start (local)</span>
									<input type="datetime-local" className="w-full px-3 py-2 rounded-md border border-deepBrown/40 bg-cream text-deepBrown"
										value={seasonStart} onChange={e => setSeasonStart(e.target.value)} />
								</label>
								<label className="text-xs md:col-span-2">
									<span className="block mb-1">Season end (local)</span>
									<input type="datetime-local" className="w-full px-3 py-2 rounded-md border border-deepBrown/40 bg-cream text-deepBrown"
										value={seasonEnd} onChange={e => setSeasonEnd(e.target.value)} />
								</label>
								<div className="md:col-span-4 flex justify-end gap-2">
									<button className="px-3 py-2 rounded-md border border-deepBrown/30 text-xs" onClick={() => setOpen(false)}>Cancel</button>
									<button className="btn-vintage px-3 py-2 rounded-md text-xs" onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</button>
								</div>
							</div>
						</motion.div>
					</motion.div>
				)}
			</AnimatePresence>
		</>
	);
}


