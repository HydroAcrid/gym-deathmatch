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

	const [mode, setMode] = useState<"MONEY_SURVIVAL"|"MONEY_LAST_MAN"|"CHALLENGE_ROULETTE"|"CHALLENGE_CUMULATIVE">("MONEY_SURVIVAL");
	const [suddenDeath, setSuddenDeath] = useState<boolean>(false);

	useEffect(() => {
		(async () => {
			try {
				const res = await fetch(`/api/lobby/${encodeURIComponent(lobbyId)}/mode`, { cache: "no-store" });
				if (res.ok) {
					const j = await res.json();
					if (j?.mode) setMode(j.mode);
					if (typeof j?.suddenDeathEnabled === "boolean") setSuddenDeath(!!j.suddenDeathEnabled);
				}
			} catch { /* ignore */ }
		})();
	}, [lobbyId, open]);

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
					perPlayerBoost: Number(perPlayerBoost || 0),
					mode,
					suddenDeathEnabled: suddenDeath
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
					className="px-2 py-1 rounded-md border border-strong text-main text-xs bg-main hover:bg-elevated"
					title="Lobby settings"
					onClick={() => setOpen(true)}
				>
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
						<path d="M12 20h9" />
						<path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4Z" />
					</svg>
				</button>
			)}
			<AnimatePresence>
				{open && (
					<motion.div className="fixed inset-0 z-50 flex items-center justify-center"
						style={{ background: "var(--overlay-backdrop)" }}
						initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
						<motion.div
							className="paper-card paper-grain ink-edge max-w-md md:max-w-2xl lg:max-w-3xl w-[92%] p-5 md:p-6"
							// Make inner panel scroll on small screens while keeping the overlay fixed
							style={{ maxHeight: "85vh", overflowY: "auto", WebkitOverflowScrolling: "touch" }}
							initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}>
							<div className="poster-headline text-xl mb-3">Edit Lobby</div>
							{/* 2-column desktop layout to reduce scrolling */}
							<div className="grid md:grid-cols-2 gap-6">
								<div>
									{/* Basic Info */}
									<div className="mb-4">
										<div className="poster-headline text-sm mb-2">BASIC INFO</div>
										<div className="grid gap-3">
											<label className="text-xs">
												<span className="block mb-1">Weekly target</span>
												<input type="number" min={1} className="w-full px-3 py-2 rounded-md border border-strong bg-main text-main"
													value={weekly} onChange={e => setWeekly(Number(e.target.value))} />
											</label>
											<label className="text-xs">
												<span className="block mb-1">Initial lives</span>
												<input type="number" min={1} className="w-full px-3 py-2 rounded-md border border-strong bg-main text-main"
													value={lives} onChange={e => setLives(Number(e.target.value))} />
											</label>
										</div>
									</div>
									{/* Season Timing */}
									<div className="mb-4">
										<div className="poster-headline text-sm mb-2">SEASON TIMING</div>
										<div className="grid gap-3">
											<label className="text-xs">
												<span className="block mb-1">Season start (local)</span>
												<input type="datetime-local" className="w-full px-3 py-2 rounded-md border border-strong bg-main text-main"
													value={seasonStart} onChange={e => setSeasonStart(e.target.value)} />
											</label>
											<label className="text-xs">
												<span className="block mb-1">Season end (local)</span>
												<input type="datetime-local" className="w-full px-3 py-2 rounded-md border border-strong bg-main text-main"
													value={seasonEnd} onChange={e => setSeasonEnd(e.target.value)} />
											</label>
										</div>
									</div>
								</div>
								<div>
									{/* Pot & Ante */}
									<div className="mb-4">
										<div className="poster-headline text-sm mb-2">POT & ANTE</div>
										{String(mode).startsWith("CHALLENGE_") && (
											<div className="text-[11px] text-deepBrown/60 mb-1 flex items-center gap-1">
												<span>🔒</span>
												<span>Disabled in Challenge modes</span>
											</div>
										)}
										<div className={`grid gap-3 ${String(mode).startsWith("CHALLENGE_") ? "opacity-40 pointer-events-none select-none" : ""}`}>
											<label className="text-xs">
												<span className="block mb-1">Initial pot ($)</span>
												<input inputMode="numeric" pattern="[0-9]*" className="w-full px-3 py-2 rounded-md border border-strong bg-main text-main"
													disabled={String(mode).startsWith("CHALLENGE_")}
													value={initialPot} onChange={e => setInitialPot(e.target.value)} />
											</label>
											<label className="text-xs">
												<span className="block mb-1">Weekly ante ($)</span>
												<input inputMode="numeric" pattern="[0-9]*" className="w-full px-3 py-2 rounded-md border border-strong bg-main text-main"
													disabled={String(mode).startsWith("CHALLENGE_")}
													value={weeklyAnte} onChange={e => setWeeklyAnte(e.target.value)} />
											</label>
											<label className="text-xs flex items-center gap-2">
												<input type="checkbox" checked={scalingEnabled} onChange={e => setScalingEnabled(e.target.checked)} disabled={String(mode).startsWith("CHALLENGE_")} />
												<span>Scale ante with lobby size</span>
											</label>
											<label className={`text-xs ${scalingEnabled ? "" : "opacity-50"}`}>
												<span className="block mb-1">Per-player boost ($)</span>
												<input inputMode="numeric" pattern="[0-9]*" className="w-full px-3 py-2 rounded-md border border-strong bg-main text-main"
													disabled={!scalingEnabled || String(mode).startsWith("CHALLENGE_")}
													value={perPlayerBoost} onChange={e => setPerPlayerBoost(e.target.value)} />
											</label>
										</div>
									</div>
									{/* Stage controls */}
									<div className="mt-4">
										<div className="poster-headline text-sm mb-2">STAGE CONTROLS</div>
										<div className="grid sm:grid-cols-3 gap-2">
											<button
												className="btn-secondary px-3 py-2 rounded-md text-xs"
												title="Return to pre-stage (waiting room)"
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
												Set to Pre-Stage
											</button>
											<button
												className="btn-secondary px-3 py-2 rounded-md text-xs"
												title="Begin now"
												onClick={async () => {
													await fetch(`/api/lobby/${encodeURIComponent(lobbyId)}/stage`, {
														method: "PATCH",
														headers: { "Content-Type": "application/json" },
														body: JSON.stringify({ startNow: true })
													});
													onSaved();
													setOpen(false);
													onClose?.();
												}}
											>
												Start now
											</button>
											<button
												className="btn-secondary px-3 py-2 rounded-md text-xs"
												title="Mark season completed"
												onClick={async () => {
													await fetch(`/api/lobby/${encodeURIComponent(lobbyId)}/stage`, {
														method: "PATCH",
														headers: { "Content-Type": "application/json" },
														body: JSON.stringify({ status: "completed" })
													});
													onSaved();
													setOpen(false);
													onClose?.();
												}}
											>
												Complete season
											</button>
										</div>
									</div>
									{/* Mode */}
									<div className="mt-6">
										<div className="poster-headline text-sm mb-2">GAME MODE</div>
										<div className="grid gap-3">
											<label className="text-xs">
												<span className="block mb-1">Mode</span>
												<select
													className="w-full px-3 py-2 rounded-md border border-strong bg-main text-main"
													value={mode}
													onChange={e => setMode(e.target.value as any)}
												>
													<option value="MONEY_SURVIVAL">Money: Survival (classic)</option>
													<option value="MONEY_LAST_MAN">Money: Last Man Standing</option>
													<option value="CHALLENGE_ROULETTE">Challenge: Roulette</option>
													<option value="CHALLENGE_CUMULATIVE">Challenge: Cumulative</option>
												</select>
											</label>
											<label className="text-xs flex items-center gap-2 mt-1">
												<input type="checkbox" checked={suddenDeath} onChange={e => setSuddenDeath(e.target.checked)} />
												<span>Allow Sudden Death revive (1 heart, cannot win pot)</span>
											</label>
											{String(mode).startsWith("CHALLENGE_") && (
												<div className="mt-2 grid gap-2">
													<div className="poster-headline text-sm">CHALLENGE SETTINGS</div>
													<label className="text-xs flex items-center gap-2">
														<input type="checkbox" checked={challengeAllowSuggestions} onChange={e => setChallengeAllowSuggestions(e.target.checked)} />
														<span>Allow player suggestions</span>
													</label>
													<label className="text-xs flex items-center gap-2">
														<input type="checkbox" checked={challengeRequireLock} onChange={e => setChallengeRequireLock(e.target.checked)} />
														<span>Require list lock before spin</span>
													</label>
													<label className="text-xs flex items-center gap-2">
														<input type="checkbox" checked={challengeAutoSpin} onChange={e => setChallengeAutoSpin(e.target.checked)} />
														<span>Auto‑spin at week start</span>
													</label>
												</div>
											)}
										</div>
									</div>
								</div>
							</div>
							{/* Danger zone */}
							<div className="mt-8 md:mt-10 md:col-span-2">
								<div className="poster-headline text-sm mb-2">DANGER ZONE</div>
								<div className="grid gap-3">
									<div className="border border-strong rounded-md p-3">
										<div className="text-xs mb-2">Remove player</div>
										<select className="w-full px-3 py-2 rounded-md border border-strong bg-main text-main"
											value={removeId} onChange={e => setRemoveId(e.target.value)}>
											<option value="">Select player</option>
											{players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
										</select>
										<div className="mt-2 flex justify-end">
											<button className="btn-secondary px-3 py-2 rounded-md text-xs" onClick={removePlayer}>Remove</button>
										</div>
									</div>
									<div className="border border-strong rounded-md p-3">
										<div className="text-xs mb-2">Transfer ownership</div>
										<select className="w-full px-3 py-2 rounded-md border border-strong bg-main text-main"
											value={newOwnerId} onChange={e => setNewOwnerId(e.target.value)}>
											<option value="">Select new owner</option>
											{players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
										</select>
										<div className="mt-2 flex justify-end">
											<button className="btn-secondary px-3 py-2 rounded-md text-xs" onClick={transferOwner}>Transfer</button>
										</div>
									</div>
									<div className="border border-strong rounded-md p-3">
										<div className="text-xs mb-2">Delete lobby (type lobby name to confirm)</div>
										<input className="w-full px-3 py-2 rounded-md border border-strong bg-main text-main" placeholder="Type lobby name exactly"
											value={confirmName} onChange={e => setConfirmName(e.target.value)} />
										<div className="mt-2 flex justify-end">
											<button className="btn-vintage px-3 py-2 rounded-md text-xs"
												onClick={deleteLobby}
												disabled={confirmName.trim().length === 0}>
												Delete Lobby
											</button>
										</div>
									</div>
									<button
										className="px-3 py-2 rounded-md border border-strong text-xs"
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
							</div>
							{/* Actions fixed at the very bottom */}
							<div className="mt-8 flex flex-col sm:flex-row gap-2">
								<button className="px-3 py-2 rounded-md border border-strong text-xs flex-1" onClick={() => { setOpen(false); onClose?.(); }}>Cancel</button>
								<button className="btn-vintage px-3 py-2 rounded-md text-xs flex-1" onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</button>
							</div>
						</motion.div>
					</motion.div>
				)}
			</AnimatePresence>
		</>
	);
}


