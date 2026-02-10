"use client";

import { useState } from "react";
import { Player } from "@/types/game";
import { authFetch } from "@/lib/clientAuth";

interface Props {
	onAdd(player: Player): void;
	onReplace?(players: Player[]): void;
	lobbyId: string;
}

export function InvitePlayerCard({ onAdd, onReplace, lobbyId }: Props) {
	const [open, setOpen] = useState(false);
	const [name, setName] = useState("");
	const [avatarUrl, setAvatarUrl] = useState("");
	const [quip, setQuip] = useState("");
	const [saving, setSaving] = useState(false);

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
		// Persist to API; if it fails, still add locally
		setSaving(true);
		authFetch(`/api/lobby/${encodeURIComponent(lobbyId)}/invite`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				id: newPlayer.id,
				name: newPlayer.name,
				avatarUrl: newPlayer.avatarUrl,
				location: null,
				quip: newPlayer.quip
			})
		})
			.then(async () => {
				// re-fetch live lobby to sync from server and replace list if provided
				try {
					const res = await fetch(`/api/lobby/${encodeURIComponent(lobbyId)}/live`, { cache: "no-store" });
					if (res.ok) {
						const data = await res.json();
						if (data?.lobby?.players && onReplace) onReplace(data.lobby.players);
					}
				} catch { /* ignore */ }
			})
			.finally(() => setSaving(false));
		onAdd(newPlayer);
		setOpen(false);
		setName("");
		setAvatarUrl("");
		setQuip("");
	}

	if (!open) {
		return (
			<button onClick={() => setOpen(true)} className="scoreboard-panel p-6 text-left">
				<div className="font-display text-sm text-primary">ENLIST A NEW CHALLENGER</div>
				<div className="text-xs text-muted-foreground mt-1">Add a player to this lobby</div>
			</button>
		);
	}

	return (
		<div className="scoreboard-panel p-4">
			<div className="font-display text-sm text-primary mb-2">INVITE PLAYER</div>
			<div className="grid gap-2">
				<input
					value={name}
					onChange={e => setName(e.target.value)}
					placeholder="Name"
					className="px-3 py-2 rounded-md border border-border bg-input text-foreground placeholder:text-muted-foreground"
				/>
				<input
					value={avatarUrl}
					onChange={e => setAvatarUrl(e.target.value)}
					placeholder="Avatar URL"
					className="px-3 py-2 rounded-md border border-border bg-input text-foreground placeholder:text-muted-foreground"
				/>
				<input
					value={quip}
					onChange={e => setQuip(e.target.value)}
					placeholder="Quip (optional)"
					className="px-3 py-2 rounded-md border border-border bg-input text-foreground placeholder:text-muted-foreground"
				/>
				<div className="flex gap-2 mt-2">
					<button onClick={submit} className="arena-badge arena-badge-primary px-3 py-2 text-[10px]" disabled={saving}>
						{saving ? "Saving..." : "Add"}
					</button>
					<button onClick={() => setOpen(false)} className="arena-badge px-3 py-2 text-[10px]">
						Cancel
					</button>
				</div>
			</div>
		</div>
	);
}

