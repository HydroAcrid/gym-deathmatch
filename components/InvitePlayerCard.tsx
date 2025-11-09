"use client";

import { useState } from "react";
import { Player } from "@/types/game";

interface Props {
	onAdd(player: Player): void;
}

export function InvitePlayerCard({ onAdd }: Props) {
	const [open, setOpen] = useState(false);
	const [name, setName] = useState("");
	const [avatarUrl, setAvatarUrl] = useState("");
	const [quip, setQuip] = useState("");

	function submit() {
		if (!name.trim()) return;
		const newPlayer: Player = {
			id: name.toLowerCase().replace(/\s+/g, "-") + "-" + Math.floor(Math.random() * 10000).toString(16),
			name: name.trim(),
			avatarUrl: avatarUrl.trim(),
			currentStreak: 0,
			longestStreak: 0,
			livesRemaining: 3,
			totalWorkouts: 0,
			averageWorkoutsPerWeek: 0,
			quip: quip.trim() || "Ready to rumble!",
			isStravaConnected: false
		};
		// In a real app, call API to persist and return updated lobby.
		onAdd(newPlayer);
		setOpen(false);
		setName("");
		setAvatarUrl("");
		setQuip("");
	}

	if (!open) {
		return (
			<button onClick={() => setOpen(true)} className="paper-card paper-grain ink-edge p-6 text-left rounded-md">
				<div className="poster-headline text-sm">ENLIST A NEW CHALLENGER</div>
				<div className="text-xs text-deepBrown/70 mt-1">Add a player to this lobby</div>
			</button>
		);
	}

	return (
		<div className="paper-card paper-grain ink-edge p-4 rounded-md">
			<div className="poster-headline text-sm mb-2">INVITE PLAYER</div>
			<div className="grid gap-2">
				<input
					value={name}
					onChange={e => setName(e.target.value)}
					placeholder="Name"
					className="px-3 py-2 rounded-md border border-deepBrown/40 bg-cream text-deepBrown placeholder:text-deepBrown/50"
				/>
				<input
					value={avatarUrl}
					onChange={e => setAvatarUrl(e.target.value)}
					placeholder="Avatar URL"
					className="px-3 py-2 rounded-md border border-deepBrown/40 bg-cream text-deepBrown placeholder:text-deepBrown/50"
				/>
				<input
					value={quip}
					onChange={e => setQuip(e.target.value)}
					placeholder="Quip (optional)"
					className="px-3 py-2 rounded-md border border-deepBrown/40 bg-cream text-deepBrown placeholder:text-deepBrown/50"
				/>
				<div className="flex gap-2 mt-2">
					<button onClick={submit} className="btn-vintage px-3 py-2 rounded-md text-[10px]">
						Add
					</button>
					<button onClick={() => setOpen(false)} className="px-3 py-2 rounded-md border border-deepBrown/40 text-deepBrown text-[10px]">
						Cancel
					</button>
				</div>
			</div>
		</div>
	);
}


