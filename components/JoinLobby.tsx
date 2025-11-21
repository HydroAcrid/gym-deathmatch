"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "./AuthProvider";

export function JoinLobby({ lobbyId }: { lobbyId: string }) {
	const [open, setOpen] = useState(false);
	const [name, setName] = useState("");
	const [avatarUrl, setAvatarUrl] = useState("");
	const [quip, setQuip] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [playerId, setPlayerId] = useState<string | null>(null);
	const { user, signInWithGoogle } = useAuth();
	const [profileName, setProfileName] = useState<string | null>(null);
	const [profileAvatar, setProfileAvatar] = useState<string | null>(null);

	useEffect(() => {
		(async () => {
			if (!user?.id) return;
			try {
				const res = await fetch(`/api/user/profile?userId=${encodeURIComponent(user.id)}`, { cache: "no-store" });
				if (!res.ok) return;
				const j = await res.json();
				setProfileName(j?.name ?? null);
				setProfileAvatar(j?.avatarUrl ?? null);
				if (!name && j?.name) setName(j.name);
				if (!avatarUrl && j?.avatarUrl) setAvatarUrl(j.avatarUrl);
			} catch {
				/* ignore */
			}
		})();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [user?.id]);

	// Determine if the user already has a player in this lobby
	useEffect(() => {
		(async () => {
			if (!user?.id || !open) {
				setPlayerId(null);
				return;
			}
			try {
				const res = await fetch(`/api/lobby/${encodeURIComponent(lobbyId)}/live`, { cache: "no-store" });
				if (!res.ok) return;
				const data = await res.json();
				const players = (data?.lobby?.players || []) as Array<{ id: string; userId?: string | null }>;
				const mine = players.find((p) => p.userId === user.id);
				setPlayerId(mine ? mine.id : null);
			} catch {
				setPlayerId(null);
			}
		})();
	}, [user?.id, lobbyId, open]);

	async function submit() {
		if (!user?.id) {
			signInWithGoogle();
			return;
		}
		if (!name.trim()) return;
		setSubmitting(true);
		try {
			const res = await fetch(`/api/lobby/${encodeURIComponent(lobbyId)}/invite`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: name.trim(),
					avatarUrl: avatarUrl.trim() || null,
					quip: quip.trim() || null,
					userId: user.id
				})
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) {
				throw new Error(data?.error || "Failed to join lobby");
			}
			const id = data?.playerId || user.id;
			setPlayerId(id);
			window.location.href = `/lobby/${encodeURIComponent(lobbyId)}?joined=1`;
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
							{!playerId ? (
								<div className="grid gap-2">
									{user && profileName && (
										<button
											className="px-3 py-2 rounded-md border border-deepBrown/30 text-xs text-left"
											onClick={() => {
												setName(profileName);
												if (profileAvatar) setAvatarUrl(profileAvatar);
											}}
										>
											Use my profile: <span className="font-semibold">{profileName}</span>
										</button>
									)}
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
										href={`/api/strava/authorize?playerId=${encodeURIComponent(playerId)}&lobbyId=${encodeURIComponent(lobbyId)}`}>
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
