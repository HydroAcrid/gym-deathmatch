"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Lobby, Player } from "@/types/game";
import { motion, AnimatePresence } from "framer-motion";
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
	const [wheelAngle, setWheelAngle] = useState<number>(0);
	const [spinIndex, setSpinIndex] = useState<number | null>(null);
	const [spinNonce, setSpinNonce] = useState<number>(0);
	const pendingChosenRef = useRef<string | null>(null);
	const [overlayOpen, setOverlayOpen] = useState<boolean>(false);

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
			// Create a hash of items to detect actual changes
			const itemsHash = JSON.stringify(newItems.map((i: any) => ({ id: i.id, text: i.text, created_by: i.created_by })).sort((a: any, b: any) => a.id.localeCompare(b.id)));
			// Only update state if items actually changed
			if (itemsHash !== itemsHashRef.current) {
				itemsHashRef.current = itemsHash;
				setItems(newItems);
				setLocked(!!j.locked);
				if (j.active?.text) setChosen(j.active.text);
			}
		} catch { /* ignore */ }
	};

	// Find current user's submission and pre-fill input
	const prevMySubmissionRef = useRef<{ id: string; text: string } | null>(null);
	useEffect(() => {
		// Skip auto-fill if we just submitted (to avoid overwriting user's new text)
		if (justSubmittedRef.current) {
			return;
		}
		if (!user?.id && !localStorage.getItem("gymdm_playerId")) return;
		let meId: string | null = null;
		if (user?.id) {
			const mine = players.find(p => (p as any).userId === user.id);
			if (mine) meId = mine.id;
		}
		if (!meId) {
			meId = typeof window !== "undefined" ? localStorage.getItem("gymdm_playerId") : null;
		}
		if (meId) {
			const mySub = items.find(i => {
				const createdBy = i.created_by;
				return createdBy === meId || createdBy === (players.find(p => p.id === meId) as any)?.userId;
			});
			const prevSub = prevMySubmissionRef.current;
			setMySubmission(mySub || null);
			// Pre-fill input only when:
			// 1. We first find a submission (prevSub is null, mySub exists)
			// 2. The submission text changed (prevSub exists but text is different)
			// Don't overwrite if user is currently typing
			if (mySub) {
				if (!prevSub || prevSub.text !== mySub.text) {
					// Only update if input is empty or matches the old submission
					if (!myText || myText === prevSub?.text) {
						setMyText(mySub.text);
					}
				}
				prevMySubmissionRef.current = { id: mySub.id, text: mySub.text };
			} else {
				prevMySubmissionRef.current = null;
			}
		}
	}, [items, players, user?.id]);

	// Track items hash to detect changes
	const itemsHashRef = useRef<string>("");
	
	useEffect(() => {
		loadPunishments();
		let cancelled = false;
		let pollTimeout: any;
		
		// Only poll when tab becomes visible (not on interval)
		const handleVisibilityChange = () => {
			if (!document.hidden && !cancelled) {
				loadPunishments();
			}
		};
		
		// Very infrequent background check (every 60 seconds) only when visible
		function scheduleNextPoll() {
			if (cancelled || document.hidden) return;
			pollTimeout = setTimeout(() => {
				if (!cancelled && !document.hidden) {
					loadPunishments();
					scheduleNextPoll();
				}
			}, 60 * 1000); // 60 seconds
		}
		
		document.addEventListener("visibilitychange", handleVisibilityChange);
		scheduleNextPoll();
		
		return () => {
			cancelled = true;
			clearTimeout(pollTimeout);
			document.removeEventListener("visibilitychange", handleVisibilityChange);
		};
	}, [lobby.id]);

	// Enrich player list with userId - only refresh when tab becomes visible
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
		const handleVisibilityChange = () => {
			if (!document.hidden) refresh();
		};
		document.addEventListener("visibilitychange", handleVisibilityChange);
		return () => {
			cancelled = true;
			document.removeEventListener("visibilitychange", handleVisibilityChange);
		};
	}, [lobby.id]);

	// Build entries for roulette slices (one per player with a suggestion)
	const wheelEntries: PunishmentEntry[] = useMemo(() => {
		const byId = new Map(players.map(p => [p.id, p]));
		const seen = new Set<string>();
		const out: PunishmentEntry[] = [];
		for (const it of items) {
			const pid = (it as any).created_by as string | undefined;
			if (!pid) continue;
			if (seen.has(pid)) continue;
			const pl = byId.get(pid);
			if (!pl) continue;
			const text = String((it as any).text || "").trim();
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
	}, [items, players]);
	async function submitSuggestion() {
		try {
			console.log("[Submit] Starting submission...", { myText, playersCount: players.length });
			setErrorMsg(null);
			const textToSubmit = myText.trim();
			if (!textToSubmit) {
				console.log("[Submit] No text to submit");
				return;
			}
			// Find my playerId - prioritize matching by userId first, then localStorage
			let meId: string | null = null;
			if (user?.id) {
				const mine = players.find(p => (p as any).userId === user.id);
				if (mine) {
					meId = mine.id;
					console.log("[Submit] Found playerId from userId match:", meId, mine);
				}
			}
			// Fallback to localStorage if no userId match
			if (!meId) {
				meId = typeof window !== "undefined" ? localStorage.getItem("gymdm_playerId") : null;
				console.log("[Submit] Using playerId from localStorage:", meId);
				// Verify this playerId exists in the players array
				if (meId && !players.find(p => p.id === meId)) {
					console.warn("[Submit] localStorage playerId not found in players array, trying to find by userId");
					meId = null;
				}
			}
			// Also try to find by matching user email/name if playerId not found
			if (!meId && user?.email) {
				const emailName = user.email.split("@")[0].toLowerCase();
				const mine = players.find(p => p.name.toLowerCase().includes(emailName) || emailName.includes(p.name.toLowerCase()));
				if (mine) {
					meId = mine.id;
					console.log("[Submit] Found playerId from email match:", meId, mine);
				}
			}
			if (!meId) {
				console.error("[Submit] No playerId found!", { user, players: players.map(p => ({ id: p.id, name: p.name, userId: (p as any).userId })) });
				setErrorMsg("Sign in as a player to submit. If you're already a player, try refreshing the page.");
				return;
			}
			console.log("[Submit] Using playerId:", meId, "Text:", textToSubmit, "Updating existing:", !!mySubmission);
			// Mark that we're submitting to prevent auto-fill from overwriting
			justSubmittedRef.current = true;
			// Optimistically update before API call
			let tempId: string | null = null;
			if (mySubmission) {
				// Update existing submission
				setItems(prev => prev.map(item => 
					item.id === mySubmission.id 
						? { ...item, text: textToSubmit }
						: item
				));
			} else {
				// Add new submission
				tempId = `temp-${Date.now()}`;
				console.log("[Submit] Adding optimistic update with tempId:", tempId);
				setItems(prev => {
					const newItems = [...prev, { id: tempId!, text: textToSubmit, created_by: meId as string }];
					console.log("[Submit] Optimistic items:", newItems);
					return newItems;
				});
			}
			// Keep the text in the input so user can see what they submitted
			
			console.log("[Submit] Calling API...");
			const r = await fetch(`/api/lobby/${encodeURIComponent(lobby.id)}/punishments`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ text: textToSubmit, playerId: meId })
			});
			console.log("[Submit] API response status:", r.status, r.ok);
			if (!r.ok) {
				const j = await r.json().catch(() => ({}));
				console.error("[Submit] API error:", j);
				setErrorMsg(j?.error || "Submit failed");
				// Remove optimistic update on error
				if (mySubmission) {
					// Revert the update
					setItems(prev => prev.map(item => 
						item.id === mySubmission.id 
							? { ...item, text: mySubmission.text }
							: item
					));
				} else if (tempId) {
					// Remove the temp item
					setItems(prev => prev.filter(item => item.id !== tempId));
				}
				justSubmittedRef.current = false;
				return;
			}
			// Reload list for authoritative state (with small delay to ensure DB commit)
			console.log("[Submit] Waiting 200ms before reload...");
			await new Promise(resolve => setTimeout(resolve, 200));
			console.log("[Submit] Reloading from server...");
			const res = await fetch(`/api/lobby/${encodeURIComponent(lobby.id)}/punishments`, { cache: "no-store" });
			const j = await res.json();
			console.log("[Submit] Reloaded items:", j.items, "Locked:", j.locked);
			const newItems = j.items || [];
			// Update hash and state
			const itemsHash = JSON.stringify(newItems.map((i: any) => ({ id: i.id, text: i.text, created_by: i.created_by })).sort((a: any, b: any) => a.id.localeCompare(b.id)));
			itemsHashRef.current = itemsHash;
			setItems(newItems);
			setLocked(!!j.locked);
			// Update mySubmission state so button changes to "Update"
			const updatedSub = (j.items || []).find((i: any) => {
				const createdBy = i.created_by;
				return createdBy === meId || createdBy === (players.find(p => p.id === meId) as any)?.userId;
			});
			if (updatedSub) {
				setMySubmission(updatedSub);
				// Update the input text to match the server response (in case it was trimmed or changed)
				if (updatedSub.text !== textToSubmit) {
					setMyText(updatedSub.text);
				}
			}
			// Clear the just-submitted flag after a short delay to allow the state to settle
			setTimeout(() => {
				justSubmittedRef.current = false;
			}, 500);
			console.log("[Submit] Submission complete!");
		} catch (err) {
			console.error("[Submit] Exception:", err);
			setErrorMsg("Submit failed");
			// Remove optimistic update on error
			setItems(prev => prev.filter(item => !item.id?.startsWith("temp-")));
		}
	}

	async function spin() {
		setErrorMsg(null);
		setSpinning(true);
		try {
			const r = await fetch(`/api/lobby/${encodeURIComponent(lobby.id)}/spin`, { method: "POST" });
			if (!r.ok) {
				const j = await r.json().catch(() => ({}));
				setErrorMsg(j?.error || "Spin failed");
				setSpinning(false);
				return;
			}
			const j = await r.json();
			// Defer setting 'chosen' until the wheel visually stops to avoid mid-spin layout churn
			pendingChosenRef.current = j?.chosen?.text || null;
			if (j?.chosen?.text) {
				const idx = wheelEntries.findIndex(e => e.punishment === j.chosen.text);
				const finalIdx = idx >= 0 ? idx : (wheelEntries.length ? Math.floor(Math.random() * wheelEntries.length) : 0);
				setSpinIndex(finalIdx);
				setSpinNonce(n => n + 1);
			}
		} catch {
			setErrorMsg("Spin failed");
		} finally {
			// spinner state is cleared in onStop callback after the wheel halts
		}
	}

	async function startWeek() {
		setErrorMsg(null);
		try {
			const res = await fetch(`/api/lobby/${encodeURIComponent(lobby.id)}/stage`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ startNow: true })
			});
			if (!res.ok) {
				const j = await res.json().catch(() => ({}));
				setErrorMsg(j?.error || "Failed to start week");
				return;
			}
			// reload page to switch to ACTIVE layout
			if (typeof window !== "undefined") window.location.reload();
		} catch {
			setErrorMsg("Failed to start week");
		}
	}

	return (
		<div className="mx-auto max-w-6xl">
			<div className="paper-card paper-grain ink-edge p-4 sm:p-6 mb-6">
				<div className="poster-headline text-xl mb-1">Week {computeWeekIndex(lobby.seasonStart)} · Punishment Selection</div>
				<div className="text-deepBrown/70 text-sm">Here’s what everyone put on the wheel.</div>
				{/* Debug helpers: visible when localStorage.gymdm_debug=1 */}
				{typeof window !== "undefined" && window.localStorage?.getItem("gymdm_debug") === "1" && (
					<div className="mt-2 flex flex-wrap gap-2 text-[11px]">
						<button
							className="px-2 py-1 rounded-md border border-deepBrown/30"
							onClick={() => {
								const mocks = players.slice(0, Math.max(3, Math.min(players.length, 6))).map((p, i) => ({
									id: `mock-${i}-${Date.now()}`,
									text: `Mock ${i + 1}`,
									created_by: p.id as any
								}));
								setItems(mocks);
								setChosen(null);
							}}
						>
							Add mock slices
						</button>
						<button
							className="px-2 py-1 rounded-md border border-deepBrown/30"
							onClick={() => { setItems([]); setChosen(null); }}
						>
							Clear local
						</button>
						<button
							className="px-2 py-1 rounded-md border border-deepBrown/30"
							onClick={async () => {
								try {
                                    const res = await fetch(`/api/lobby/${encodeURIComponent(lobby.id)}/punishments`, { cache: "no-store" });
                                    const j = await res.json();
                                    setItems(j.items || []);
									setLocked(!!j.locked);
                                } catch { /* ignore */ }
							}}
						>
							Reload from server
						</button>
					</div>
				)}
				{errorMsg && <div className="mt-2 text-[12px] text-[#a13535]">⚠ {errorMsg}</div>}
				<div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
					<div>
						<div className="text-xs text-deepBrown/70 mb-2">Submissions</div>
						<ul className="space-y-2">
							{players.map(p => {
								// Match submissions by player ID or userId (since created_by might be either)
								const sub = items.find(i => {
									const createdBy = i.created_by;
									return createdBy === p.id || createdBy === (p as any).userId;
								});
								if (typeof window !== "undefined" && window.localStorage?.getItem("gymdm_debug") === "1") {
									console.log("[Display] Player:", p.name, "ID:", p.id, "userId:", (p as any).userId, "Submission:", sub, "All items:", items);
								}
								return (
									<li key={p.id} className="flex items-start gap-2">
										<div className="h-8 w-8 rounded-full overflow-hidden bg-tan border border-deepBrown/30">
											{p.avatarUrl ? <img src={p.avatarUrl} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full flex items-center justify-center text-sm">🏋️</div>}
										</div>
										<div className="flex-1">
											<div className="text-sm font-semibold">{p.name}</div>
											<div className="text-[12px] text-deepBrown/70">{p.location || "—"}</div>
											<div className="text-[13px] mt-0.5">{sub ? `“${sub.text}”` : <span className="text-deepBrown/60 italic">No suggestion submitted</span>}</div>
										</div>
									</li>
								);
							})}
							{players.length === 0 && <li className="text-sm text-deepBrown/70">No players yet.</li>}
						</ul>
						{/* Suggestion input if allowed and not locked */}
						{!locked && (
							<div className="mt-3 flex gap-2">
								<input
									className="flex-1 px-3 py-2 rounded-md border border-deepBrown/30 bg-cream text-deepBrown"
									placeholder={mySubmission ? "Update your punishment (max 50 chars)" : "Suggest a punishment (max 50 chars)"}
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
									// Big, flashy reveal overlay
									setOverlayOpen(true);
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
									try {
										const r = await fetch(`/api/lobby/${encodeURIComponent(lobby.id)}/punishments/lock`, {
											method: "POST",
											headers: { "Content-Type": "application/json" },
											body: JSON.stringify({ locked: !locked })
										});
										if (!r.ok) {
											const j = await r.json().catch(() => ({}));
											setErrorMsg(j?.error || "Lock toggle failed");
										} else {
											setErrorMsg(null);
											setLocked(!locked);
										}
									} catch {
										setErrorMsg("Lock toggle failed");
									}
								}}
							>
								{locked ? "Unlock list" : "Lock list"}
							</button>
							<button
								className="btn-vintage px-3 py-2 rounded-md text-xs"
								onClick={spin}
								disabled={spinning || wheelEntries.length === 0 || (locked === false && requiresLock(lobby))}
								title={requiresLock(lobby) && !locked ? "Lock list before spinning" : undefined}
							>
								{spinning ? "Spinning…" : "Spin wheel"}
							</button>
							<button
								className="px-3 py-2 rounded-md border border-deepBrown/30 text-xs disabled:opacity-60"
								onClick={startWeek}
								disabled={!chosen}
							>
								Start week
							</button>
						</>
					) : (
						<div className="text-xs text-deepBrown/70">
							{spinning ? "Wheel is spinning…" : "Waiting for host to spin…"}
						</div>
					)}
				</div>
				<AnimatePresence>
					{chosen && (
						<motion.div
							initial={{ opacity: 0, y: 8 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: -6 }}
							className="mt-4 p-3 rounded-md border border-deepBrown/30 bg-cream/5"
						>
							<div className="text-sm">Punishment of the week:</div>
							<div className="poster-headline text-xl">“{chosen}” 🎯</div>
						</motion.div>
					)}
				</AnimatePresence>
				{/* Full-screen reveal overlay */}
				<AnimatePresence>
					{overlayOpen && (
						<motion.div
							className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							onClick={() => setOverlayOpen(false)}
						>
							<motion.div
								className="paper-card paper-grain ink-edge p-8 text-center max-w-lg w-[92%] rounded-2xl border"
								initial={{ scale: 0.9, opacity: 0 }}
								animate={{ scale: 1, opacity: 1 }}
								exit={{ scale: 0.9, opacity: 0 }}
								onClick={(e) => e.stopPropagation()}
							>
								<div className="text-5xl mb-3">🎡</div>
								<div className="poster-headline text-2xl mb-2">This week’s punishment is:</div>
								<div className="poster-headline text-3xl text-accent-primary mb-6 break-anywhere">
									{chosen ? `“${chosen}”` : "—"}
								</div>
								{isOwner ? (
									<button
										className="btn-vintage px-5 py-3 rounded-md text-xs"
										onClick={startWeek}
									>
										Proceed
									</button>
								) : (
									<div className="text-sm text-deepBrown/80">Waiting for host to proceed…</div>
								)}
							</motion.div>
						</motion.div>
					)}
				</AnimatePresence>
			</div>
		</div>
	);
}

function computeWeekIndex(seasonStart: string) {
	const start = new Date(seasonStart).getTime();
	const now = Date.now();
	const idx = Math.max(1, Math.floor((now - start) / (7 * 24 * 60 * 60 * 1000)) + 1);
	return idx;
}

function requiresLock(lobby: Lobby) {
	const cs = (lobby as any).challengeSettings || {};
	return !!cs.requireLockBeforeSpin;
}


