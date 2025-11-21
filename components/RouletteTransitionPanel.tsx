"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Lobby, Player } from "@/types/game";
import { motion } from "framer-motion";
import { useAuth } from "./AuthProvider";
import { PunishmentWheel, type PunishmentEntry } from "./punishment/PunishmentWheel";

export function RouletteTransitionPanel({ lobby }: { lobby: Lobby }) {
	const { user } = useAuth();
	const [players, setPlayers] = useState<Player[]>(lobby.players);
	const [items, setItems] = useState<{ id: string; text: string; created_by?: string | null }[]>([]);
	const [locked, setLocked] = useState<boolean>(false);
	const [spinning, setSpinning] = useState<boolean>(false);
	const [chosen, setChosen] = useState<string | null>(null);
	const [errorMsg, setErrorMsg] = useState<string | null>(null);
	const [myText, setMyText] = useState<string>("");
	const [mySubmission, setMySubmission] = useState<{ id: string; text: string; created_by?: string | null } | null>(null);
	const justSubmittedRef = useRef<boolean>(false);
	const [isOwner, setIsOwner] = useState<boolean>(false);
	const [spinIndex, setSpinIndex] = useState<number | null>(null);
	const [spinNonce, setSpinNonce] = useState<number>(0);
	const pendingChosenRef = useRef<string | null>(null);
	const [showDebug, setShowDebug] = useState<boolean>(false);
	const initialLoadRef = useRef(false);
	const prevActiveRef = useRef<string | null>(null);
	
	useEffect(() => {
		if (typeof window === "undefined") return;
		const search = new URLSearchParams(window.location.search);
		setShowDebug(search.get("debug") === "1");
	}, []);

	useEffect(() => {
		const ownerUserId = (lobby as any).ownerUserId;
		const ownerPlayer = lobby.players.find(p => p.id === lobby.ownerId);
		if (user?.id && ownerUserId) setIsOwner(user.id === ownerUserId);
		else if (user?.id && ownerPlayer?.userId) setIsOwner(user.id === ownerPlayer.userId);
		else setIsOwner(false);
	}, [user?.id, lobby.ownerId, (lobby as any).ownerUserId]);

	const loadPunishments = async () => {
		try {
			const res = await fetch(`/api/lobby/${encodeURIComponent(lobby.id)}/punishments`, { cache: "no-store" });
			if (!res.ok) return;
			const j = await res.json();
			const newItems = j.items || [];
			
			// Update items if changed
			const itemsHash = JSON.stringify(newItems.map((i: any) => ({ id: i.id, text: i.text, created_by: i.created_by })).sort((a: any, b: any) => a.id.localeCompare(b.id)));
			if (itemsHash !== itemsHashRef.current) {
				itemsHashRef.current = itemsHash;
				setItems(newItems);
			}
			
			setLocked(!!j.locked);

			// Handle spin trigger
			const activeText = j.active?.text || null;
			if (activeText && activeText !== prevActiveRef.current) {
				// New active punishment detected
				if (initialLoadRef.current && !chosen) {
					// We are live and watching, trigger spin!
					// Need to map text to index
					// Note: We need up-to-date wheelEntries. computed from 'items' and 'players'.
					// Since we just set 'items', we might need to compute it here or wait for render.
					// But we can't wait. Let's compute locally.
					// Actually, assume wheelEntries updates fast enough or use current 'items' if we just set it?
					// 'setItems' is async.
					// We can use 'newItems' to compute.
					const currentEntries = computeEntries(newItems, players);
					const idx = currentEntries.findIndex(e => e.punishment === activeText);
					
					if (idx >= 0) {
						console.log("Remote spin triggered!", activeText, idx);
						setSpinIndex(idx);
						setSpinNonce(n => n + 1);
						setSpinning(true);
						pendingChosenRef.current = activeText;
					} else {
						// Item not found on wheel? Fallback to just showing it.
						setChosen(activeText);
					}
				} else if (!initialLoadRef.current) {
					// Initial load, just show result
					setChosen(activeText);
				}
			}
			prevActiveRef.current = activeText;
			initialLoadRef.current = true;

		} catch { /* ignore */ }
	};

	// Listen for realtime updates
	useEffect(() => {
		function onRefresh() { loadPunishments(); }
		if (typeof window !== "undefined") window.addEventListener("gymdm:refresh-live", onRefresh as any);
		return () => { if (typeof window !== "undefined") window.removeEventListener("gymdm:refresh-live", onRefresh as any); };
	}, [lobby.id]);

	// Find current user's submission
	const prevMySubmissionRef = useRef<{ id: string; text: string } | null>(null);
	useEffect(() => {
		if (justSubmittedRef.current) return;
		if (!user?.id) return;
		const mine = players.find(p => (p as any).userId === user.id);
		if (!mine) return;
		const mySub = items.find(i => {
			const createdBy = i.created_by;
			return createdBy === mine.id || createdBy === user.id;
		});
		const prevSub = prevMySubmissionRef.current;
		setMySubmission(mySub || null);
		if (mySub) {
			if (!prevSub || prevSub.text !== mySub.text) {
				if (!myText || myText === prevSub?.text) {
					setMyText(mySub.text);
				}
			}
			prevMySubmissionRef.current = { id: mySub.id, text: mySub.text };
		} else {
			prevMySubmissionRef.current = null;
		}
	}, [items, players, user?.id, myText]);

	const itemsHashRef = useRef<string>("");
	
	useEffect(() => {
		setItems([]);
		setMyText("");
		setMySubmission(null);
		setChosen(null);
		setLocked(false);
		setErrorMsg(null);
		setSpinning(false);
		setSpinIndex(null);
		setSpinNonce(0);
		pendingChosenRef.current = null;
		justSubmittedRef.current = false;
		prevMySubmissionRef.current = null;
		itemsHashRef.current = "";
		initialLoadRef.current = false;
		prevActiveRef.current = null;
	}, [lobby.id]);
	
	useEffect(() => {
		loadPunishments();
		// Keep a slow poll just in case realtime misses
		const id = setInterval(loadPunishments, 10000);
		return () => clearInterval(id);
	}, [lobby.id]);

	useEffect(() => {
		let cancelled = false;
		async function refresh() {
			if (cancelled || document.hidden) return;
			try {
				const res = await fetch(`/api/lobby/${encodeURIComponent(lobby.id)}/live`, { cache: "no-store" });
				if (!res.ok) return;
				const data = await res.json();
				if (!cancelled && data?.lobby?.players) {
					setPlayers(data.lobby.players);
				}
			} catch { /* ignore */ }
		}
		refresh();
		// Refresh players on visibility change
		const handleVisibilityChange = () => { if (!document.hidden) refresh(); };
		document.addEventListener("visibilitychange", handleVisibilityChange);
		return () => {
			cancelled = true;
			document.removeEventListener("visibilitychange", handleVisibilityChange);
		};
	}, [lobby.id]);

	const wheelEntries: PunishmentEntry[] = useMemo(() => {
		return computeEntries(items, players);
	}, [items, players]);

	async function submitSuggestion() {
		// ... (submission logic same as before)
		try {
			setErrorMsg(null);
			const textToSubmit = myText.trim();
			if (!textToSubmit) return;
			
			// Find ID logic...
			let meId: string | null = null;
			if (user?.id) {
				const mine = players.find(p => (p as any).userId === user.id);
				if (mine) meId = mine.id;
			}
			
			if (!meId) {
				setErrorMsg("Sign in to submit.");
				return;
			}

			justSubmittedRef.current = true;
			// Optimistic update
			if (mySubmission) {
				setItems(prev => prev.map(item => item.id === mySubmission!.id ? { ...item, text: textToSubmit } : item));
			} else {
				setItems(prev => [...prev, { id: `temp-${Date.now()}`, text: textToSubmit, created_by: meId as string }]);
			}
			
			const r = await fetch(`/api/lobby/${encodeURIComponent(lobby.id)}/punishments`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ text: textToSubmit, playerId: meId })
			});
			
			if (!r.ok) {
				setErrorMsg("Submit failed");
				loadPunishments(); // revert
				return;
			}
			
			setTimeout(() => { justSubmittedRef.current = false; loadPunishments(); }, 500);
		} catch (err) {
			setErrorMsg("Submit failed");
			loadPunishments();
		}
	}

	async function spin() {
		setErrorMsg(null);
		// Don't set spinning locally yet, wait for DB
		// But disable button
		setSpinning(true); 
		try {
			const r = await fetch(`/api/lobby/${encodeURIComponent(lobby.id)}/spin`, { method: "POST" });
			if (!r.ok) {
				setSpinning(false);
				setErrorMsg("Spin failed");
			}
			// Success: do nothing, wait for realtime event to trigger animation
		} catch {
			setSpinning(false);
			setErrorMsg("Spin failed");
		}
	}

	return (
		<div className="mx-auto max-w-6xl">
			<div className="paper-card paper-grain ink-edge p-4 sm:p-6 mb-6">
				<div className="poster-headline text-xl mb-1">Punishment Selection</div>
				<div className="text-deepBrown/70 text-sm">Here's what everyone put on the wheel.</div>
				{showDebug && (
					<div className="mt-2 flex flex-wrap gap-2 text-[11px]">
						{/* Debug buttons */}
					</div>
				)}
				{errorMsg && <div className="mt-2 text-[12px] text-[#a13535]">⚠ {errorMsg}</div>}
				<div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
					<div>
						<div className="text-xs text-deepBrown/70 mb-2">Submissions</div>
						<ul className="space-y-2">
							{players.map(p => {
								const sub = items.find(i => {
									const createdBy = i.created_by;
									return createdBy === p.id || createdBy === (p as any).userId;
								});
								return (
									<li key={p.id} className="flex items-start gap-2">
										<div className="h-8 w-8 rounded-full overflow-hidden bg-tan border border-deepBrown/30">
											{p.avatarUrl ? <img src={p.avatarUrl} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full flex items-center justify-center text-sm">🏋️</div>}
										</div>
										<div className="flex-1">
											<div className="text-sm font-semibold">{p.name}</div>
											<div className="text-[13px] mt-0.5">{sub ? `“${sub.text}”` : <span className="text-deepBrown/60 italic">No suggestion submitted</span>}</div>
										</div>
									</li>
								);
							})}
						</ul>
						{!locked && (
							<div className="mt-3 flex gap-2">
								<input
									className="flex-1 px-3 py-2 rounded-md border border-deepBrown/30 bg-cream text-deepBrown"
									placeholder={mySubmission ? "Update your punishment" : "Suggest a punishment"}
									value={myText}
									maxLength={50}
									onChange={e => setMyText(e.target.value)}
								/>
								<button className="btn-secondary px-3 py-2 rounded-md text-xs" onClick={submitSuggestion} disabled={!myText.trim()}>
									{mySubmission ? "Update" : "Submit"}
								</button>
							</div>
						)}
						{locked && mySubmission && (
							<div className="mt-3 text-xs text-deepBrown/70 italic">
								List is locked. Your submission: "{mySubmission.text}"
							</div>
						)}
					</div>
					<div className="relative flex items-center justify-center">
						<div className="relative">
							<PunishmentWheel
								entries={wheelEntries}
								disabled={locked === false && requiresLock(lobby)}
								spinToIndex={spinIndex ?? undefined}
								spinNonce={spinNonce}
								onStop={(idx) => {
									const winner = wheelEntries[idx];
									const finalText = pendingChosenRef.current ?? winner?.punishment ?? null;
									pendingChosenRef.current = null;
									if (finalText) setChosen(finalText);
									setSpinning(false);
									// Reload page after animation
									setTimeout(() => {
										if (typeof window !== "undefined") window.location.reload();
									}, 2500);
								}}
							/>
						</div>
					</div>
				</div>
				<div className="mt-4 flex flex-wrap items-center gap-2">
					{isOwner ? (
						<>
							<button
								className="px-3 py-2 rounded-md border border-deepBrown/30 text-xs"
								onClick={async () => {
									await fetch(`/api/lobby/${encodeURIComponent(lobby.id)}/punishments/lock`, {
										method: "POST",
										headers: { "Content-Type": "application/json" },
										body: JSON.stringify({ locked: !locked })
									});
									loadPunishments();
								}}
							>
								{locked ? "Unlock list" : "Lock list"}
							</button>
							<button
								className="btn-vintage px-3 py-2 rounded-md text-xs"
								onClick={spin}
								disabled={spinning || wheelEntries.length === 0 || (locked === false && requiresLock(lobby))}
							>
								{spinning ? "Spinning…" : "Spin wheel"}
							</button>
						</>
					) : (
						<div className="text-xs text-deepBrown/70">
							{spinning ? "Wheel is spinning…" : "Waiting for host to spin…"}
						</div>
					)}
				</div>
				{chosen && (
					<motion.div
						initial={{ opacity: 0, y: 8 }}
						animate={{ opacity: 1, y: 0 }}
						className="mt-4 p-3 rounded-md border border-deepBrown/30 bg-cream/5"
					>
						<div className="text-sm">Punishment selected: <strong>{chosen}</strong>. Reloading...</div>
					</motion.div>
				)}
			</div>
		</div>
	);
}

function computeEntries(items: any[], players: Player[]): PunishmentEntry[] {
	const byId = new Map(players.map(p => [p.id, p]));
	const seen = new Set<string>();
	const out: PunishmentEntry[] = [];
	for (const it of items) {
		const pid = it.created_by as string | undefined;
		if (!pid) continue;
		if (seen.has(pid)) continue;
		const pl = byId.get(pid);
		if (!pl) continue;
		const text = String(it.text || "").trim();
		if (!text) continue;
		seen.add(pid);
		out.push({
			id: pid,
			displayName: pl.name,
			avatarUrl: pl.avatarUrl,
			punishment: text,
			createdBy: pid
		});
	}
	return out;
}

function requiresLock(lobby: Lobby) {
	const cs = (lobby as any).challengeSettings || {};
	return !!cs.requireLockBeforeSpin;
}
