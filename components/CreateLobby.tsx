"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "./ToastProvider";

export function CreateLobby() {
	const [open, setOpen] = useState(false);
	const [lobbyName, setLobbyName] = useState("");
	const [seasonStart, setSeasonStart] = useState<string>(new Date().toISOString().slice(0, 16));
	const [seasonEnd, setSeasonEnd] = useState<string>(new Date(new Date().getFullYear(), 11, 31).toISOString().slice(0, 16));
	const [weekly, setWeekly] = useState<number>(3);
	const [lives, setLives] = useState<number>(3);
	const [ownerName, setOwnerName] = useState("");
	const toast = useToast();

	function slugify(name: string) {
		return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
	}

	async function submit() {
		if (!lobbyName.trim()) return;
		const lobbyId = slugify(lobbyName);
		let ownerId = localStorage.getItem("gymdm_playerId") || "";
		if (!ownerId) {
			if (!ownerName.trim()) {
				toast.push("Enter your name to create your player");
				return;
			}
			ownerId = slugify(ownerName) + "-" + Math.floor(Math.random() * 10000).toString(16);
			localStorage.setItem("gymdm_playerId", ownerId);
		}
		if (!seasonStart || !seasonEnd) {
			toast.push("Enter start and end dates");
			return;
		}
		const res = await fetch("/api/lobby/create", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				lobbyId,
				name: lobbyName.trim(),
				seasonStart: new Date(seasonStart).toISOString(),
				seasonEnd: new Date(seasonEnd).toISOString(),
				weeklyTarget: Number(weekly),
				initialLives: Number(lives),
				ownerId,
				ownerName: ownerName || undefined
			})
		});
		if (res.ok) {
			toast.push("Lobby created");
			window.location.href = `/lobby/${lobbyId}?joined=1&playerId=${ownerId}`;
		} else {
			toast.push("Failed to create lobby");
		}
	}

	return (
		<>
			<button className="btn-vintage px-3 py-2 rounded-md text-xs" onClick={() => setOpen(true)}>
				＋ Create Lobby
			</button>
			<AnimatePresence>
				{open && (
					<motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
						initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
						<motion.div className="paper-card paper-grain ink-edge max-w-lg w-[92%] p-6 bg-tan"
							initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}>
							<div className="poster-headline text-xl mb-3">Create Lobby</div>
							<div className="grid gap-2">
								<label className="text-xs">
									<span className="block mb-1">Lobby name</span>
									<input className="w-full px-3 py-2 rounded-md border border-deepBrown/40 bg-cream text-deepBrown" placeholder="e.g., Winter Grind 2025"
									value={lobbyName} onChange={e => setLobbyName(e.target.value)} />
								</label>
								<div className="grid grid-cols-2 gap-2">
									<label className="text-xs">
										<span className="block mb-1">Start date</span>
										<input className="w-full px-3 py-2 rounded-md border border-deepBrown/40 bg-cream text-deepBrown" type="datetime-local"
											value={seasonStart} onChange={e => setSeasonStart(e.target.value)} />
									</label>
									<label className="text-xs">
										<span className="block mb-1">End date</span>
										<input className="w-full px-3 py-2 rounded-md border border-deepBrown/40 bg-cream text-deepBrown" type="datetime-local"
											value={seasonEnd} onChange={e => setSeasonEnd(e.target.value)} />
									</label>
								</div>
								<div className="grid grid-cols-2 gap-2">
									<label className="text-xs">
										<span className="block mb-1">Weekly target</span>
										<input className="w-full px-3 py-2 rounded-md border border-deepBrown/40 bg-cream text-deepBrown" type="number" min={1}
											value={weekly} onChange={e => setWeekly(Number(e.target.value))} placeholder="3" />
										<div className="text-[10px] mt-1 text-deepBrown/70">Workouts required per week</div>
									</label>
									<label className="text-xs">
										<span className="block mb-1">Initial lives</span>
										<input className="w-full px-3 py-2 rounded-md border border-deepBrown/40 bg-cream text-deepBrown" type="number" min={1}
											value={lives} onChange={e => setLives(Number(e.target.value))} placeholder="3" />
										<div className="text-[10px] mt-1 text-deepBrown/70">Lives each player starts with</div>
									</label>
								</div>
								{!localStorage.getItem("gymdm_playerId") && (
									<label className="text-xs">
										<span className="block mb-1">Your display name (you’ll be the owner)</span>
										<input className="w-full px-3 py-2 rounded-md border border-deepBrown/40 bg-cream text-deepBrown" placeholder="Your name"
											value={ownerName} onChange={e => setOwnerName(e.target.value)} />
									</label>
								)}
								<div className="flex justify-end gap-2 mt-2">
									<button className="px-3 py-2 rounded-md border border-deepBrown/30 text-xs" onClick={() => setOpen(false)}>Cancel</button>
									<button className="btn-vintage px-3 py-2 rounded-md text-xs" onClick={submit}>Create</button>
								</div>
							</div>
						</motion.div>
					</motion.div>
				)}
			</AnimatePresence>
		</>
	);
}


