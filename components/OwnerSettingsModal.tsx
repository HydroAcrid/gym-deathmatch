"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "./ToastProvider";

export function OwnerSettingsModal({
	lobbyId,
	defaultWeekly,
	defaultLives,
	defaultSeasonEnd,
	defaultInitialPot,
	defaultWeeklyAnte,
	defaultScalingEnabled,
	defaultPerPlayerBoost,
	onSaved,
	autoOpen,
	hideTrigger,
	onClose,
	open: openProp
}: {
	lobbyId: string;
	defaultWeekly: number;
	defaultLives: number;
	defaultSeasonEnd?: string;
	defaultInitialPot?: number;
	defaultWeeklyAnte?: number;
	defaultScalingEnabled?: boolean;
	defaultPerPlayerBoost?: number;
	onSaved: () => void;
	autoOpen?: boolean;
	hideTrigger?: boolean;
	onClose?: () => void;
	open?: boolean;
}) {
	const [open, setOpen] = useState<boolean>(!!autoOpen);
	const [weekly, setWeekly] = useState<number>(defaultWeekly);
	const [lives, setLives] = useState<number>(defaultLives);
	const [initialPot, setInitialPot] = useState<string>(String(defaultInitialPot ?? 0));
	const [weeklyAnte, setWeeklyAnte] = useState<string>(String(defaultWeeklyAnte ?? 10));
	const [scalingEnabled, setScalingEnabled] = useState<boolean>(!!defaultScalingEnabled);
	const [perPlayerBoost, setPerPlayerBoost] = useState<string>(String(defaultPerPlayerBoost ?? 0));
	const [seasonStart, setSeasonStart] = useState<string>("");
	const initialEnd = (defaultSeasonEnd || new Date().toISOString()).slice(0, 16).replace("Z", "");
	const [seasonEnd, setSeasonEnd] = useState<string>(initialEnd);
	const [saving, setSaving] = useState(false);
	const toast = useToast();
	const [players, setPlayers] = useState<Array<{ id: string; name: string }>>([]);
	const [removeId, setRemoveId] = useState<string>("");
	const [newOwnerId, setNewOwnerId] = useState<string>("");
	const [confirmName, setConfirmName] = useState<string>("");

	// Allow external control
	useEffect(() => {
		if (openProp === undefined) return;
		setOpen(openProp);
	}, [openProp]);

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
					seasonEnd: new Date(seasonEnd).toISOString(),
					initialPot: Number(initialPot || 0),
					weeklyAnte: Number(weeklyAnte || 0),
					scalingEnabled: Boolean(scalingEnabled),
					perPlayerBoost: Number(perPlayerBoost || 0)
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

	// Load players when modal opens
	useEffect(() => {
		if (!open) return;
		(async () => {
			try {
				const res = await fetch(`/api/lobby/${encodeURIComponent(lobbyId)}/live`, { cache: "no-store" });
				const data = await res.json();
				const p = (data?.lobby?.players ?? []).map((x: any) => ({ id: x.id, name: x.name }));
				setPlayers(p);
				// Prefer scheduledStart for preview; otherwise use seasonStart
				const iso: string | undefined = (data?.lobby?.scheduledStart || data?.lobby?.seasonStart);
				if (iso) {
					const d = new Date(iso);
					const pad = (n: number) => String(n).padStart(2, "0");
					const local = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
					setSeasonStart(local);
				}
			} catch { /* ignore */ }
		})();
	}, [open, lobbyId]);

	async function adminHeaders() {
		const token = typeof window !== "undefined" ? localStorage.getItem("gymdm_admin_token") : null;
		return token ? { Authorization: `Bearer ${token}` } : {};
	}

	async function removePlayer() {
		if (!removeId) return;
		// owner path requires ownerPlayerId; admin path uses header
		const headers: any = { "Content-Type": "application/json", ...(await adminHeaders()) };
		const isAdmin = !!headers.Authorization;
		const url = isAdmin
			? `/api/admin/lobby/${encodeURIComponent(lobbyId)}/player/${encodeURIComponent(removeId)}`
			: `/api/lobby/${encodeURIComponent(lobbyId)}/players/${encodeURIComponent(removeId)}`;
		const body = isAdmin ? undefined : JSON.stringify({ ownerPlayerId: localStorage.getItem("gymdm_playerId") || "" });
		const res = await fetch(url, { method: "DELETE", headers, body });
		if (res.ok) {
			toast.push("Player removed");
			onSaved();
		} else {
			toast.push("Failed to remove player");
		}
	}

	async function deleteLobby() {
		if (!confirmName || confirmName.trim().length < 1) return;
		const headers: any = { "Content-Type": "application/json", ...(await adminHeaders()) };
		const isAdmin = !!headers.Authorization;
		const url = isAdmin
			? `/api/admin/lobby/${encodeURIComponent(lobbyId)}`
			: `/api/lobby/${encodeURIComponent(lobbyId)}`;
		const body = isAdmin ? undefined : JSON.stringify({ ownerPlayerId: localStorage.getItem("gymdm_playerId") || "" });
		const res = await fetch(url, { method: "DELETE", headers, body });
		if (res.ok) {
			toast.push("Lobby deleted");
			window.location.href = "/lobbies";
		} else {
			toast.push("Failed to delete lobby");
		}
	}

	async function transferOwner() {
		if (!newOwnerId) return;
		const res = await fetch(`/api/lobby/${encodeURIComponent(lobbyId)}/owner`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				ownerPlayerId: localStorage.getItem("gymdm_playerId") || "",
				newOwnerPlayerId: newOwnerId
			})
		});
		if (res.ok) {
			toast.push("Ownership transferred");
			onSaved();
		} else {
			toast.push("Failed to transfer ownership");
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
						<path d="M12 20h9" />
						<path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4Z" />
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
								{/** Quick stage actions inside modal */}
								<div className="md:col-span-4 flex items-center gap-2 mb-2">
									<button
										className="px-3 py-2 rounded-md border border-deepBrown/30 text-xs"
										onClick={async () => {
											await fetch(`/api/lobby/${encodeURIComponent(lobbyId)}/stage`, {
												method: "PATCH",
												headers: { "Content-Type": "application/json" },
												body: JSON.stringify({ status: "pending", scheduledStart: null })
											});
											onSaved();
											setOpen(false);
											onClose?.();
										}}
									>
										Cancel scheduled start
									</button>
								</div>
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
								<label className="text-xs">
									<span className="block mb-1">Initial pot ($)</span>
									<input inputMode="numeric" pattern="[0-9]*" className="w-full px-3 py-2 rounded-md border border-deepBrown/40 bg-cream text-deepBrown"
										value={initialPot} onChange={e => setInitialPot(e.target.value)} />
								</label>
								<label className="text-xs">
									<span className="block mb-1">Weekly ante ($)</span>
									<input inputMode="numeric" pattern="[0-9]*" className="w-full px-3 py-2 rounded-md border border-deepBrown/40 bg-cream text-deepBrown"
										value={weeklyAnte} onChange={e => setWeeklyAnte(e.target.value)} />
								</label>
								<label className="text-xs flex items-center gap-2 md:col-span-2">
									<input type="checkbox" checked={scalingEnabled} onChange={e => setScalingEnabled(e.target.checked)} />
									<span>Scale ante with lobby size</span>
								</label>
								<label className={`text-xs ${scalingEnabled ? "" : "opacity-50"}`}>
									<span className="block mb-1">Per-player boost ($)</span>
									<input inputMode="numeric" pattern="[0-9]*" className="w-full px-3 py-2 rounded-md border border-deepBrown/40 bg-cream text-deepBrown"
										disabled={!scalingEnabled}
										value={perPlayerBoost} onChange={e => setPerPlayerBoost(e.target.value)} />
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
							<div className="mt-6">
								<div className="poster-headline text-sm mb-2">Danger zone</div>
								<div className="grid md:grid-cols-2 gap-3">
									<div className="border border-deepBrown/30 rounded-md p-3">
										<div className="text-xs mb-2">Remove player</div>
										<select className="w-full px-3 py-2 rounded-md border border-deepBrown/40 bg-cream text-deepBrown"
											value={removeId} onChange={e => setRemoveId(e.target.value)}>
											<option value="">Select player</option>
											{players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
										</select>
										<div className="mt-2 flex justify-end">
											<button className="btn-secondary px-3 py-2 rounded-md text-xs" onClick={removePlayer}>Remove</button>
										</div>
									</div>
									<div className="border border-deepBrown/30 rounded-md p-3">
										<div className="text-xs mb-2">Transfer ownership</div>
										<select className="w-full px-3 py-2 rounded-md border border-deepBrown/40 bg-cream text-deepBrown"
											value={newOwnerId} onChange={e => setNewOwnerId(e.target.value)}>
											<option value="">Select new owner</option>
											{players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
										</select>
										<div className="mt-2 flex justify-end">
											<button className="btn-secondary px-3 py-2 rounded-md text-xs" onClick={transferOwner}>Transfer</button>
										</div>
									</div>
								</div>
								<div className="border border-deepBrown/30 rounded-md p-3 mt-3">
									<div className="text-xs mb-2">Delete lobby (type lobby name to confirm)</div>
									<input className="w-full px-3 py-2 rounded-md border border-deepBrown/40 bg-cream text-deepBrown" placeholder="Type lobby name exactly"
										value={confirmName} onChange={e => setConfirmName(e.target.value)} />
									<div className="mt-2 flex justify-end">
										<button className="btn-vintage px-3 py-2 rounded-md text-xs"
											onClick={deleteLobby}
											disabled={confirmName.trim().length === 0}>
											Delete Lobby
										</button>
									</div>
								</div>
							</div>
						</motion.div>
					</motion.div>
				)}
			</AnimatePresence>
		</>
	);
}


