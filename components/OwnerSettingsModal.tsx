"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { useToast } from "./ToastProvider";
import { ChallengeSettingsCard } from "./ChallengeSettingsCard";
import type { ChallengeSettings, GameMode } from "@/types/game";
import { CreateLobbyInfo } from "./CreateLobbyInfo";
import { authFetch } from "@/lib/clientAuth";
import { toIsoFromLocalDateTimeInput, toLocalDateTimeInputValue } from "@/lib/datetime";

type OwnerModalMode = Extract<GameMode, "MONEY_SURVIVAL" | "MONEY_LAST_MAN" | "CHALLENGE_ROULETTE" | "CHALLENGE_CUMULATIVE">;

type LivePlayerRow = {
	id?: string;
	name?: string;
};

type AdminWindow = Window & {
	__gymdm_admin_token?: string;
};

const DEFAULT_CHALLENGE_SETTINGS: ChallengeSettings = {
	selection: "ROULETTE",
	spinFrequency: "WEEKLY",
	visibility: "PUBLIC",
	stackPunishments: false,
	allowSuggestions: true,
	requireLockBeforeSpin: true,
	autoSpinAtWeekStart: false,
	showLeaderboard: true,
	profanityFilter: true,
	suggestionCharLimit: 50,
};

function isOwnerModalMode(value: string): value is OwnerModalMode {
	return value === "MONEY_SURVIVAL" || value === "MONEY_LAST_MAN" || value === "CHALLENGE_ROULETTE" || value === "CHALLENGE_CUMULATIVE";
}

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
	open: openProp,
	isNextSeason
}: {
	lobbyId: string;
	ownerPlayerId?: string | null;
	defaultWeekly: number;
	defaultLives: number;
	defaultSeasonEnd?: string;
	defaultInitialPot?: number;
	defaultWeeklyAnte?: number;
	defaultScalingEnabled?: boolean;
	defaultPerPlayerBoost?: number;
	onSaved: (newSeasonEnd?: string) => void | Promise<void>;
	autoOpen?: boolean;
	hideTrigger?: boolean;
	onClose?: () => void;
	open?: boolean;
	isNextSeason?: boolean; // If true, will call /season/next instead of /settings
}) {
	const [open, setOpen] = useState<boolean>(!!autoOpen);
	const [weekly, setWeekly] = useState<number>(defaultWeekly);
	const [lives, setLives] = useState<number>(defaultLives);
	const [initialPot, setInitialPot] = useState<string>(String(defaultInitialPot ?? 0));
	const [weeklyAnte, setWeeklyAnte] = useState<string>(String(defaultWeeklyAnte ?? 10));
	const [scalingEnabled, setScalingEnabled] = useState<boolean>(!!defaultScalingEnabled);
	const [perPlayerBoost, setPerPlayerBoost] = useState<string>(String(defaultPerPlayerBoost ?? 0));
	const [seasonStart, setSeasonStart] = useState<string>("");
	const initialEnd = toLocalDateTimeInputValue(defaultSeasonEnd || new Date());
	const [seasonEnd, setSeasonEnd] = useState<string>(initialEnd);
	const [inviteEnabled, setInviteEnabled] = useState<boolean>(true);
	const [inviteTokenRequired, setInviteTokenRequired] = useState<boolean>(true);
	const [inviteExpiresAt, setInviteExpiresAt] = useState<string>("");
	const [rotateInviteToken, setRotateInviteToken] = useState<boolean>(false);
	const [saving, setSaving] = useState(false);
	const toast = useToast();
	const [players, setPlayers] = useState<Array<{ id: string; name: string }>>([]);
	const [removeId, setRemoveId] = useState<string>("");
	const [newOwnerId, setNewOwnerId] = useState<string>("");
	const [confirmName, setConfirmName] = useState<string>("");
	const [infoOpen, setInfoOpen] = useState(false);
	const [challengeSettings, setChallengeSettings] = useState<ChallengeSettings | null>(null);
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	useEffect(() => {
		if (!open || typeof document === "undefined") return;
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = previousOverflow;
		};
	}, [open]);

	// Allow external control
	useEffect(() => {
		if (openProp === undefined) return;
		setOpen(openProp);
	}, [openProp]);

	// Reset form values when modal opens or defaults change
	useEffect(() => {
		if (open) {
			setWeekly(defaultWeekly);
			setLives(defaultLives);
			setInitialPot(String(defaultInitialPot ?? 0));
			setWeeklyAnte(String(defaultWeeklyAnte ?? 10));
			setScalingEnabled(!!defaultScalingEnabled);
			setPerPlayerBoost(String(defaultPerPlayerBoost ?? 0));
			setInviteEnabled(true);
			setInviteTokenRequired(true);
			setInviteExpiresAt("");
			setRotateInviteToken(false);
			if (defaultSeasonEnd) {
				setSeasonEnd(toLocalDateTimeInputValue(defaultSeasonEnd));
			}
		}
	}, [open, defaultWeekly, defaultLives, defaultInitialPot, defaultWeeklyAnte, defaultScalingEnabled, defaultPerPlayerBoost, defaultSeasonEnd]);

	const [mode, setMode] = useState<OwnerModalMode>("MONEY_SURVIVAL");
	const [suddenDeath, setSuddenDeath] = useState<boolean>(false);

	useEffect(() => {
		(async () => {
			try {
				const res = await authFetch(`/api/lobby/${encodeURIComponent(lobbyId)}/mode`, { cache: "no-store" });
				if (res.ok) {
					const j = await res.json();
					if (j?.mode) setMode(j.mode);
					if (typeof j?.suddenDeathEnabled === "boolean") setSuddenDeath(!!j.suddenDeathEnabled);
					if (j?.challengeSettings) setChallengeSettings(j.challengeSettings as ChallengeSettings);
				}
			} catch { /* ignore */ }
		})();
	}, [lobbyId, open]);

	async function save() {
		setSaving(true);
		try {
			// If this is for next season, call the next season endpoint
			if (isNextSeason) {
				const newSeasonStart = toIsoFromLocalDateTimeInput(seasonStart) || new Date().toISOString();
				const newSeasonEnd = toIsoFromLocalDateTimeInput(seasonEnd);
				if (!newSeasonEnd) {
					toast.push("Invalid season end date");
					return;
				}
				
				// First update settings, then start next season
				await authFetch(`/api/lobby/${encodeURIComponent(lobbyId)}/settings`, {
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						weeklyTarget: Number(weekly),
						initialLives: Number(lives),
						seasonEnd: newSeasonEnd,
						initialPot: Number(initialPot || 0),
						weeklyAnte: Number(weeklyAnte || 0),
						scalingEnabled: Boolean(scalingEnabled),
						perPlayerBoost: Number(perPlayerBoost || 0),
						mode,
						suddenDeathEnabled: suddenDeath,
						challengeSettings: challengeSettings,
						inviteEnabled: inviteEnabled,
						inviteTokenRequired: inviteTokenRequired,
						inviteExpiresAt: inviteExpiresAt ? (toIsoFromLocalDateTimeInput(inviteExpiresAt) || null) : null,
						rotateInviteToken: rotateInviteToken
					})
				});
				
				// Then start next season
				const res = await authFetch(`/api/lobby/${encodeURIComponent(lobbyId)}/season/next`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						seasonStart: newSeasonStart,
						seasonEnd: newSeasonEnd
					})
				});
				
				if (!res.ok) {
					const j = await res.json().catch(() => ({}));
					toast.push(j?.error || "Failed to start next season");
					return;
				}
				
				await onSaved(newSeasonEnd);
				setRotateInviteToken(false);
				setOpen(false);
				if (onClose) onClose();
				return;
			}
			
			// Normal settings update
			const seasonEndIso = toIsoFromLocalDateTimeInput(seasonEnd);
			if (!seasonEndIso) {
				toast.push("Invalid season end date");
				return;
			}
			const res = await authFetch(`/api/lobby/${encodeURIComponent(lobbyId)}/settings`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					weeklyTarget: Number(weekly),
					initialLives: Number(lives),
					seasonStart: seasonStart ? (toIsoFromLocalDateTimeInput(seasonStart) || undefined) : undefined,
					seasonEnd: seasonEndIso,
					initialPot: Number(initialPot || 0),
					weeklyAnte: Number(weeklyAnte || 0),
					scalingEnabled: Boolean(scalingEnabled),
					perPlayerBoost: Number(perPlayerBoost || 0),
					mode,
					suddenDeathEnabled: suddenDeath,
					inviteEnabled: inviteEnabled,
					inviteTokenRequired: inviteTokenRequired,
					inviteExpiresAt: inviteExpiresAt ? (toIsoFromLocalDateTimeInput(inviteExpiresAt) || null) : null,
					rotateInviteToken: rotateInviteToken
				})
			});
			if (res.ok) {
				toast.push("Settings saved");
				await onSaved();
				setRotateInviteToken(false);
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
				const res = await authFetch(`/api/lobby/${encodeURIComponent(lobbyId)}/live`, { cache: "no-store" });
				const data = await res.json();
				const p = ((data?.lobby?.players ?? []) as LivePlayerRow[])
					.map((player) => ({ id: String(player.id || ""), name: String(player.name || "Unknown") }))
					.filter((player) => player.id.length > 0);
				setPlayers(p);
				// Prefer scheduledStart for preview; otherwise use seasonStart
				const iso: string | undefined = (data?.lobby?.scheduledStart || data?.lobby?.seasonStart);
				if (iso) {
					setSeasonStart(toLocalDateTimeInputValue(iso));
				}
					const inviteEnabledRaw = data?.lobby?.inviteEnabled;
					setInviteEnabled(inviteEnabledRaw !== false);
					const inviteRequiredRaw = data?.lobby?.inviteTokenRequired;
					setInviteTokenRequired(inviteRequiredRaw === true);
				const inviteExpiresRaw = data?.lobby?.inviteExpiresAt ?? null;
				setInviteExpiresAt(inviteExpiresRaw ? toLocalDateTimeInputValue(inviteExpiresRaw) : "");
			} catch { /* ignore */ }
		})();
	}, [open, lobbyId]);

	async function adminHeaders() {
		const token = typeof window !== "undefined" ? (window as AdminWindow).__gymdm_admin_token : null;
		return token ? { Authorization: `Bearer ${token}` } : { Authorization: undefined };
	}

	async function removePlayer() {
		if (!removeId) return;
		// owner path requires ownerPlayerId; admin path uses header
		const admin = await adminHeaders();
		const headers: HeadersInit = {
			"Content-Type": "application/json",
			...(admin.Authorization ? { Authorization: admin.Authorization } : {})
		};
		const isAdmin = Boolean(admin.Authorization);
		const url = isAdmin
			? `/api/admin/lobby/${encodeURIComponent(lobbyId)}/player/${encodeURIComponent(removeId)}`
			: `/api/lobby/${encodeURIComponent(lobbyId)}/players/${encodeURIComponent(removeId)}`;
		const body = undefined;
		const res = isAdmin
			? await fetch(url, { method: "DELETE", headers, body })
			: await authFetch(url, { method: "DELETE", headers: { "Content-Type": "application/json" } });
		if (res.ok) {
			toast.push("Player removed");
			onSaved();
		} else {
			toast.push("Failed to remove player");
		}
	}

	async function deleteLobby() {
		if (!confirmName || confirmName.trim().length < 1) return;
		const admin = await adminHeaders();
		const headers: HeadersInit = {
			"Content-Type": "application/json",
			...(admin.Authorization ? { Authorization: admin.Authorization } : {})
		};
		const isAdmin = Boolean(admin.Authorization);
		const url = isAdmin
			? `/api/admin/lobby/${encodeURIComponent(lobbyId)}`
			: `/api/lobby/${encodeURIComponent(lobbyId)}`;
		const body = undefined;
		const res = isAdmin
			? await fetch(url, { method: "DELETE", headers, body })
			: await authFetch(url, { method: "DELETE", headers: { "Content-Type": "application/json" } });
		if (res.ok) {
			toast.push("Lobby deleted");
			window.location.href = "/lobbies";
		} else {
			toast.push("Failed to delete lobby");
		}
	}

	async function transferOwner() {
		if (!newOwnerId) return;
		const res = await authFetch(`/api/lobby/${encodeURIComponent(lobbyId)}/owner`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
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

	const resolvedChallengeSettings: ChallengeSettings = challengeSettings ?? DEFAULT_CHALLENGE_SETTINGS;

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
			{mounted
				? createPortal(
					<AnimatePresence>
						{open && (
							<motion.div
								className="fixed inset-0 z-[150] flex items-start sm:items-center justify-center p-0 sm:p-6 bg-black/80 backdrop-blur-sm"
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								exit={{ opacity: 0 }}
								onClick={() => {
									setOpen(false);
									onClose?.();
								}}
							>
									<motion.div
										role="dialog"
										aria-modal="true"
										className="scoreboard-panel relative w-full sm:max-w-5xl h-[100dvh] sm:h-[85vh] rounded-none sm:rounded-2xl shadow-2xl border bg-[hsl(var(--card))] flex flex-col box-border max-w-full overflow-hidden"
									initial={{ scale: 0.96, opacity: 0 }}
									animate={{ scale: 1, opacity: 1 }}
									exit={{ scale: 0.96, opacity: 0 }}
									onClick={(e) => e.stopPropagation()}
								>
										<header className="sticky top-0 z-20 bg-[hsl(var(--card))] border-2 border-border px-4 sm:px-6 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] pb-3 border-b flex items-center justify-between gap-3">
								<div className="min-w-0">
									<h2 className="font-display tracking-widest text-primary text-lg sm:text-xl tracking-wide truncate">Edit Lobby</h2>
									<p className="text-muted-foreground text-xs sm:text-sm truncate">Adjust dates, mode, pot, and challenge options</p>
								</div>
								<div className="shrink-0 flex items-center gap-2">
									<button
										className="h-9 w-9 rounded-md border border-border flex items-center justify-center"
										aria-label="Help"
										onClick={() => setInfoOpen(true)}
										title="Lobby Info"
									>
										<span className="text-base leading-none">?</span>
									</button>
									<button className="px-3 py-2 rounded-md border border-border text-xs" onClick={() => { setOpen(false); onClose?.(); }}>Cancel</button>
									<button className="arena-badge arena-badge-primary px-3 py-2 rounded-md text-xs" onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</button>
								</div>
							</header>
							<div className="flex-1 overflow-y-auto overscroll-contain arena-scrollbar px-4 sm:px-6 py-4 pb-[calc(env(safe-area-inset-bottom,0px)+8rem)] sm:pb-6 max-w-full [overflow-wrap:anywhere] break-words hyphens-auto">
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pr-2 sm:pr-0">
								<div>
									{/* Basic Info */}
									<div className="mb-4">
										<div className="font-display tracking-widest text-primary text-sm mb-2">BASIC INFO</div>
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
										<div className="font-display tracking-widest text-primary text-sm mb-2">SEASON TIMING</div>
										<div className="grid gap-3">
											<label className="text-xs">
												<span className="block mb-1">Season start (local)</span>
												<input
													type="datetime-local"
													className="arena-datetime-input w-full px-3 py-2 rounded-md border border-strong bg-main text-main"
													value={seasonStart} onChange={e => setSeasonStart(e.target.value)} />
											</label>
											<label className="text-xs">
												<span className="block mb-1">Season end (local)</span>
												<input
													type="datetime-local"
													className="arena-datetime-input w-full px-3 py-2 rounded-md border border-strong bg-main text-main"
													value={seasonEnd} onChange={e => setSeasonEnd(e.target.value)} />
											</label>
										</div>
										<div className="mt-2 text-[11px] text-muted-foreground">
											Season start is kept in sync with scheduled start while lobby is pre-stage/scheduled.
										</div>
									</div>
								</div>
								<div>
									{/* Pot & Ante */}
									<div className="mb-4">
										<div className="font-display tracking-widest text-primary text-sm mb-2">POT & ANTE</div>
										{String(mode).startsWith("CHALLENGE_") && (
											<div className="text-[11px] text-muted-foreground mb-1 flex items-center gap-1">
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
									{/* Invite controls */}
									<div className="mt-4">
										<div className="font-display tracking-widest text-primary text-sm mb-2">INVITE CONTROLS</div>
										<div className="grid gap-3">
											<label className="text-xs flex items-center gap-2">
												<input type="checkbox" checked={inviteEnabled} onChange={e => setInviteEnabled(e.target.checked)} />
												<span>Enable invite links</span>
											</label>
											<label className={`text-xs flex items-center gap-2 ${inviteEnabled ? "" : "opacity-50"}`}>
												<input
													type="checkbox"
													checked={inviteTokenRequired}
													onChange={e => setInviteTokenRequired(e.target.checked)}
													disabled={!inviteEnabled}
												/>
												<span>Require tokenized invite link</span>
											</label>
											<label className={`text-xs ${inviteEnabled ? "" : "opacity-50"}`}>
												<span className="block mb-1">Invite expiry (local)</span>
												<input
													type="datetime-local"
													className="arena-datetime-input w-full px-3 py-2 rounded-md border border-strong bg-main text-main"
													value={inviteExpiresAt}
													onChange={e => setInviteExpiresAt(e.target.value)}
													disabled={!inviteEnabled}
												/>
												<span className="block mt-1 text-[11px] text-muted-foreground">
													Leave empty for no expiry.
												</span>
											</label>
											<label className={`text-xs flex items-center gap-2 ${inviteEnabled ? "" : "opacity-50"}`}>
												<input
													type="checkbox"
													checked={rotateInviteToken}
													onChange={e => setRotateInviteToken(e.target.checked)}
													disabled={!inviteEnabled || !inviteTokenRequired}
												/>
												<span>Rotate invite token on next save</span>
											</label>
										</div>
									</div>
									{/* Stage controls */}
									<div className="mt-4">
										<div className="font-display tracking-widest text-primary text-sm mb-2">STAGE CONTROLS</div>
										<div className="grid sm:grid-cols-3 gap-2">
											<button
												className="arena-badge px-3 py-2 rounded-md text-xs"
												title="Return to pre-stage (waiting room)"
												onClick={async () => {
														await authFetch(`/api/lobby/${encodeURIComponent(lobbyId)}/stage`, {
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
												className="arena-badge px-3 py-2 rounded-md text-xs"
												title="Begin now"
												onClick={async () => {
														await authFetch(`/api/lobby/${encodeURIComponent(lobbyId)}/stage`, {
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
												className="arena-badge px-3 py-2 rounded-md text-xs"
												title="Mark season completed"
												onClick={async () => {
														await authFetch(`/api/lobby/${encodeURIComponent(lobbyId)}/stage`, {
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
										<div className="font-display tracking-widest text-primary text-sm mb-2">GAME MODE</div>
										<div className="grid gap-3">
											<label className="text-xs">
												<span className="block mb-1">Mode</span>
													<select
														className="bg-input border border-border text-foreground w-full h-10 px-3 rounded-md"
														value={mode}
														onChange={(e) => {
															if (isOwnerModalMode(e.target.value)) {
																setMode(e.target.value);
															}
														}}
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
													<div className="scoreboard-panel rounded-xl p-4 border">
														<ChallengeSettingsCard mode={mode} value={resolvedChallengeSettings} onChange={(value) => setChallengeSettings(value)} />
													</div>
												)}
										</div>
									</div>
								</div>
							</div>
							{/* Danger zone */}
							<div className="mt-6 md:mt-8 md:col-span-2">
								<div className="font-display tracking-widest text-primary text-sm mb-2">DANGER ZONE</div>
								<div className="grid gap-3">
									<div className="border border-strong rounded-md p-3">
										<div className="text-xs mb-2">Remove player</div>
										<select className="bg-input border border-border text-foreground w-full h-10 px-3 rounded-md"
											value={removeId} onChange={e => setRemoveId(e.target.value)}>
											<option value="">Select player</option>
											{players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
										</select>
										<div className="mt-2 flex justify-end">
											<button className="arena-badge px-3 py-2 rounded-md text-xs" onClick={removePlayer}>Remove</button>
										</div>
									</div>
									<div className="border border-strong rounded-md p-3">
										<div className="text-xs mb-2">Transfer ownership</div>
										<select className="bg-input border border-border text-foreground w-full h-10 px-3 rounded-md"
											value={newOwnerId} onChange={e => setNewOwnerId(e.target.value)}>
											<option value="">Select new owner</option>
											{players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
										</select>
										<div className="mt-2 flex justify-end">
											<button className="arena-badge px-3 py-2 rounded-md text-xs" onClick={transferOwner}>Transfer</button>
										</div>
									</div>
									<div className="border border-strong rounded-md p-3">
										<div className="text-xs mb-2">Delete lobby (type lobby name to confirm)</div>
										<input className="w-full px-3 py-2 rounded-md border border-strong bg-main text-main" placeholder="Type lobby name exactly"
											value={confirmName} onChange={e => setConfirmName(e.target.value)} />
										<div className="mt-2 flex justify-end">
											<button className="arena-badge arena-badge-primary px-3 py-2 rounded-md text-xs"
												onClick={deleteLobby}
												disabled={confirmName.trim().length === 0}>
												Delete Lobby
											</button>
										</div>
									</div>
									<button
										className="px-3 py-2 rounded-md border border-strong text-xs"
										onClick={async () => {
												await authFetch(`/api/lobby/${encodeURIComponent(lobbyId)}/stage`, {
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
							</div>
								</motion.div>
								<CreateLobbyInfo open={infoOpen} onClose={() => setInfoOpen(false)} />
							</motion.div>
						)}
					</AnimatePresence>,
					document.body
				)
				: null}
		</>
	);
}
