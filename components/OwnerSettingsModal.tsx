"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "./ToastProvider";

export function OwnerSettingsModal({
	lobbyId,
	defaultWeekly,
	defaultLives,
	defaultSeasonEnd,
	onSaved,
	autoOpen,
	hideTrigger,
	onClose
}: {
	lobbyId: string;
	defaultWeekly: number;
	defaultLives: number;
	defaultSeasonEnd: string;
	onSaved: () => void;
	autoOpen?: boolean;
	hideTrigger?: boolean;
	onClose?: () => void;
}) {
	const [open, setOpen] = useState<boolean>(!!autoOpen);
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
				onClose?.();
			} else {
				toast.push("Failed to save settings");
			}
		} finally {
			setSaving(false);
		}
	}

	return (
		<>
			{!hideTrigger && (
				<button
					className="px-2 py-1 rounded-md border border-deepBrown/30 text-deepBrown text-xs hover:bg-deepBrown/10"
					title="Lobby settings"
					onClick={() => setOpen(true)}
				>
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
						<circle cx="12" cy="12" r="3" />
						<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c0 .66.26 1.3.73 1.77.47.47 1.11.73 1.77.73H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
					</svg>
				</button>
			)}
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
									<button className="px-3 py-2 rounded-md border border-deepBrown/30 text-xs" onClick={() => { setOpen(false); onClose?.(); }}>Cancel</button>
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


