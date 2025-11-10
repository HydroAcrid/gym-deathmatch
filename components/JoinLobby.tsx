"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function JoinLobby({ lobbyId }: { lobbyId: string }) {
	const [open, setOpen] = useState(false);
	const [name, setName] = useState("");
	const [avatarUrl, setAvatarUrl] = useState("");
	const [quip, setQuip] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [newPlayerId, setNewPlayerId] = useState<string | null>(null);

	useEffect(() => {
		const me = localStorage.getItem("gymdm_playerId");
		if (me) setNewPlayerId(me);
	}, []);

	async function submit() {
		if (!name.trim()) return;
		setSubmitting(true);
		const id = name.toLowerCase().replace(/\s+/g, "-") + "-" + Math.floor(Math.random() * 10000).toString(16);
		try {
			await fetch(`/api/lobby/${encodeURIComponent(lobbyId)}/invite`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ id, name: name.trim(), avatarUrl: avatarUrl.trim(), quip: quip.trim() || null })
			});
			localStorage.setItem("gymdm_playerId", id);
			setNewPlayerId(id);
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<>
			<button className="btn-vintage px-3 py-2 rounded-md text-xs" onClick={() => setOpen(true)}>
				Join Lobby
			</button>
			<AnimatePresence>
				{open && (
					<motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
						initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
						<motion.div className="paper-card paper-grain ink-edge max-w-lg w-[92%] p-6 bg-tan"
							initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}>
							<div className="poster-headline text-xl mb-3">Join this Lobby</div>
							{!newPlayerId ? (
								<div className="grid gap-2">
									<input className="px-3 py-2 rounded-md border border-deepBrown/40 bg-cream text-deepBrown placeholder:text-deepBrown/50"
										placeholder="Your Name" value={name} onChange={e => setName(e.target.value)} />
									<input className="px-3 py-2 rounded-md border border-deepBrown/40 bg-cream text-deepBrown placeholder:text-deepBrown/50"
										placeholder="Avatar URL (optional)" value={avatarUrl} onChange={e => setAvatarUrl(e.target.value)} />
									<input className="px-3 py-2 rounded-md border border-deepBrown/40 bg-cream text-deepBrown placeholder:text-deepBrown/50"
										placeholder="Quip (optional)" value={quip} onChange={e => setQuip(e.target.value)} />
									<div className="flex justify-end gap-2 mt-2">
										<button className="px-3 py-2 rounded-md border border-deepBrown/30 text-xs" onClick={() => setOpen(false)}>Cancel</button>
										<button className="btn-vintage px-3 py-2 rounded-md text-xs" onClick={submit} disabled={submitting}>
											{submitting ? "Submitting..." : "Create my player"}
										</button>
									</div>
								</div>
							) : (
								<div className="grid gap-3">
									<div className="text-sm">Player created! Next, connect your Strava:</div>
									<a className="btn-vintage px-3 py-2 rounded-md text-xs"
										href={`/api/strava/authorize?playerId=${encodeURIComponent(newPlayerId)}&lobbyId=${encodeURIComponent(lobbyId)}`}>
										Connect my Strava
									</a>
									<div className="flex justify-end">
										<button className="px-3 py-2 rounded-md border border-deepBrown/30 text-xs" onClick={() => setOpen(false)}>Close</button>
									</div>
								</div>
							)}
						</motion.div>
					</motion.div>
				)}
			</AnimatePresence>
		</>
	);
}


