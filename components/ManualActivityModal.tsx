"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { useToast } from "./ToastProvider";
import { useAuth } from "./AuthProvider";
import { Button } from "@/src/ui2/ui/button";
import { Input } from "@/src/ui2/ui/input";
import { Label } from "@/src/ui2/ui/label";
import { Textarea } from "@/src/ui2/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/src/ui2/ui/select";
import { authFetch } from "@/lib/clientAuth";
import { MANUAL_ACTIVITY_TARGETS_CACHE_KEY } from "@/lib/localStorageKeys";
import { getBrowserSupabase } from "@/lib/supabaseBrowser";

const ELIGIBLE_LOBBY_STATUSES = new Set(["pending", "scheduled", "transition_spin", "active"]);
const MAX_TARGET_LOBBIES = 25;

type EligibleLobby = {
	id: string;
	name: string;
	status: string;
};

type SubmitSummary = {
	successes: Array<{ lobbyId: string; lobbyName: string }>;
	failures: Array<{ lobbyId: string; lobbyName: string; error: string }>;
};

function normalizeLobbyIds(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	const out: string[] = [];
	const seen = new Set<string>();
	for (const raw of value) {
		if (typeof raw !== "string") continue;
		const id = raw.trim();
		if (!id || seen.has(id)) continue;
		seen.add(id);
		out.push(id);
		if (out.length >= MAX_TARGET_LOBBIES) break;
	}
	return out;
}

function arraysEqual(a: string[], b: string[]) {
	return a.length === b.length && a.every((value, index) => value === b[index]);
}

async function parseApiError(response: Response) {
	const fallback = `HTTP ${response.status}`;
	const text = await response.text();
	if (!text) return fallback;
	try {
		const json = JSON.parse(text);
		return String(json?.error || json?.message || fallback);
	} catch {
		return text.slice(0, 160);
	}
}

async function runWithConcurrency<T, R>(
	items: T[],
	limit: number,
	worker: (item: T) => Promise<R>
): Promise<Array<PromiseSettledResult<R>>> {
	const settled: Array<PromiseSettledResult<R>> = new Array(items.length);
	let index = 0;

	async function loop() {
		while (index < items.length) {
			const current = index;
			index += 1;
			try {
				const value = await worker(items[current]);
				settled[current] = { status: "fulfilled", value };
			} catch (reason) {
				settled[current] = { status: "rejected", reason };
			}
		}
	}

	const workerCount = Math.max(1, Math.min(limit, items.length || 1));
	await Promise.all(Array.from({ length: workerCount }, () => loop()));
	return settled;
}

export function ManualActivityModal({
	open,
	onClose,
	lobbyId,
	onSaved,
}: {
	open: boolean;
	onClose: () => void;
	lobbyId: string;
	onSaved?: () => void;
}) {
	const [type, setType] = useState<string>("gym");
	const [duration, setDuration] = useState<string>("");
	const [distance, setDistance] = useState<string>("");
	const [notes, setNotes] = useState<string>("");
	const [caption, setCaption] = useState<string>("");
	const [file, setFile] = useState<File | null>(null);
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);
	const [busy, setBusy] = useState<boolean>(false);
	const [eligibleLobbies, setEligibleLobbies] = useState<EligibleLobby[]>([]);
	const [selectedLobbyIds, setSelectedLobbyIds] = useState<string[]>([]);
	const [targetsLoading, setTargetsLoading] = useState<boolean>(false);
	const [targetSearch, setTargetSearch] = useState<string>("");
	const [targetSelectorOpen, setTargetSelectorOpen] = useState<boolean>(false);
	const [submitSummary, setSubmitSummary] = useState<SubmitSummary | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const persistRevisionRef = useRef(0);
	const persistErrorToastAtRef = useRef(0);
	const supabase = getBrowserSupabase();
	const toast = useToast?.();
	const { user } = useAuth();

	const eligibleById = useMemo(() => {
		return new Map(eligibleLobbies.map((lobby) => [lobby.id, lobby]));
	}, [eligibleLobbies]);

	const filteredLobbies = useMemo(() => {
		const q = targetSearch.trim().toLowerCase();
		if (!q) return eligibleLobbies;
		return eligibleLobbies.filter((lobby) => lobby.name.toLowerCase().includes(q));
	}, [eligibleLobbies, targetSearch]);

	const selectedLobbyNames = useMemo(() => {
		return selectedLobbyIds
			.map((id) => eligibleById.get(id)?.name)
			.filter((name): name is string => Boolean(name));
	}, [eligibleById, selectedLobbyIds]);

	useEffect(() => {
		if (!file) {
			setPreviewUrl(null);
			return;
		}
		const url = URL.createObjectURL(file);
		setPreviewUrl(url);
		return () => {
			URL.revokeObjectURL(url);
		};
	}, [file]);

	useEffect(() => {
		return () => {
			if (persistTimerRef.current) {
				clearTimeout(persistTimerRef.current);
				persistTimerRef.current = null;
			}
		};
	}, []);

	const persistTargets = useCallback((nextIds: string[], immediate = false) => {
		if (!user?.id) return;
		const deduped = normalizeLobbyIds(nextIds);
		if (typeof window !== "undefined") {
			window.localStorage.setItem(MANUAL_ACTIVITY_TARGETS_CACHE_KEY, JSON.stringify(deduped));
		}
		persistRevisionRef.current += 1;
		const revision = persistRevisionRef.current;

		const runPersist = async () => {
			try {
				const response = await authFetch("/api/user/activity-targets", {
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ lobbyIds: deduped }),
					trackLoading: false,
				});
				if (!response.ok) {
					throw new Error(await parseApiError(response));
				}
				const json = await response.json().catch(() => ({ lobbyIds: deduped }));
				if (persistRevisionRef.current !== revision) return;
				const sanitized = normalizeLobbyIds(json?.lobbyIds ?? deduped);
				if (typeof window !== "undefined") {
					window.localStorage.setItem(MANUAL_ACTIVITY_TARGETS_CACHE_KEY, JSON.stringify(sanitized));
				}
				if (!arraysEqual(sanitized, deduped)) {
					setSelectedLobbyIds(sanitized);
				}
			} catch (error) {
				if (persistRevisionRef.current !== revision) return;
				const now = Date.now();
				if (now - persistErrorToastAtRef.current > 7000) {
					persistErrorToastAtRef.current = now;
					toast?.push?.("Couldn't sync lobby targets yet. We'll retry on next change.");
				}
				console.error("manual activity target persistence failed", error);
			}
		};

		if (immediate) {
			void runPersist();
			return;
		}
		if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
		persistTimerRef.current = setTimeout(() => {
			void runPersist();
		}, 500);
	}, [toast, user?.id]);

	useEffect(() => {
		if (!open) return;
		setTargetSearch("");
		setTargetSelectorOpen(false);
		setSubmitSummary(null);
		if (!user?.id) return;

		let cancelled = false;
		setTargetsLoading(true);
		(async () => {
			try {
				const cached = (() => {
					if (typeof window === "undefined") return [];
					try {
						return normalizeLobbyIds(JSON.parse(window.localStorage.getItem(MANUAL_ACTIVITY_TARGETS_CACHE_KEY) || "[]"));
					} catch {
						return [];
					}
				})();
				if (cached.length) setSelectedLobbyIds(cached);

				const [lobbiesRes, targetsRes] = await Promise.all([
					authFetch("/api/lobbies", { trackLoading: false }),
					authFetch("/api/user/activity-targets", { trackLoading: false }),
				]);

				const lobbiesJson = await lobbiesRes.json().catch(() => ({ lobbies: [] }));
				const targetJson = targetsRes.ok
					? await targetsRes.json().catch(() => ({ lobbyIds: [] }))
					: { lobbyIds: [] };

				const allLobbies: Array<{ id?: string; name?: string; status?: string }> = Array.isArray(lobbiesJson?.lobbies)
					? lobbiesJson.lobbies
					: [];
				const eligible: EligibleLobby[] = allLobbies
					.map((row) => ({
						id: String(row?.id || ""),
						name: String(row?.name || row?.id || ""),
						status: String(row?.status || ""),
					}))
					.filter((lobby) => lobby.id && ELIGIBLE_LOBBY_STATUSES.has(lobby.status))
					.slice(0, 200);

				if (cancelled) return;
				setEligibleLobbies(eligible);
				const eligibleSet = new Set(eligible.map((lobby) => lobby.id));

				const saved = normalizeLobbyIds(targetJson?.lobbyIds ?? []).filter((id) => eligibleSet.has(id));
				const cachedEligible = cached.filter((id) => eligibleSet.has(id));

				let initial = saved.length ? saved : cachedEligible;
				if (!initial.length && eligibleSet.has(lobbyId)) {
					initial = [lobbyId];
				}

				setSelectedLobbyIds(initial);
				if (typeof window !== "undefined") {
					window.localStorage.setItem(MANUAL_ACTIVITY_TARGETS_CACHE_KEY, JSON.stringify(initial));
				}

				if (targetsRes.ok && !arraysEqual(saved, initial)) {
					persistTargets(initial, true);
				}
			} catch (error) {
				console.error("manual activity targets load failed", error);
				toast?.push?.("Couldn't load lobby targets.");
			} finally {
				if (!cancelled) setTargetsLoading(false);
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [open, user?.id, lobbyId, persistTargets, toast]);

	function toggleLobbySelection(targetLobbyId: string) {
		if (busy) return;
		setSubmitSummary(null);
		setSelectedLobbyIds((previous) => {
			let next: string[];
			if (previous.includes(targetLobbyId)) {
				next = previous.filter((id) => id !== targetLobbyId);
			} else {
				if (previous.length >= MAX_TARGET_LOBBIES) {
					toast?.push?.(`You can target up to ${MAX_TARGET_LOBBIES} lobbies.`);
					return previous;
				}
				next = [...previous, targetLobbyId];
			}
			persistTargets(next, false);
			return next;
		});
	}

	async function submit() {
		if (!user?.id) {
			toast?.push?.("Sign in to log workouts");
			return;
		}
		if (!file || !caption.trim()) {
			alert("Please add a photo and caption.");
			return;
		}

		const selectedTargets = selectedLobbyIds
			.map((id) => eligibleById.get(id))
			.filter((lobby): lobby is EligibleLobby => Boolean(lobby));
		if (!selectedTargets.length) {
			toast?.push?.("Select at least one lobby.");
			return;
		}

		setBusy(true);
		setSubmitSummary(null);
		try {
			let publicUrl = "";
			if (supabase && file) {
				const folder = user.id;
				const safeName = file.name.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9._-]/g, "");
				const path = `${folder}/${Date.now()}_${safeName}`;
				const bucket = supabase.storage.from("manual-activity-photos");
				const { error: upErr } = await bucket.upload(path, file, { upsert: true, cacheControl: "3600" });
				if (upErr) {
					const msg = (upErr as any)?.message || String(upErr);
					if (msg.toLowerCase().includes("row-level security")) {
						alert("Upload blocked by Storage RLS. Ensure the object key starts with your auth user id folder.");
					} else {
						alert("Photo upload failed: " + msg);
					}
					return;
				}
				const { data: pub } = bucket.getPublicUrl(path);
				publicUrl = pub?.publicUrl || "";
			}
			if (!publicUrl) {
				alert("Photo upload did not return a public URL.");
				return;
			}

			const payload = {
				type,
				durationMinutes: duration ? Number(duration) : null,
				distanceKm: distance ? Number(distance) : null,
				notes,
				photoUrl: publicUrl,
				caption,
			};

			const settled = await runWithConcurrency(selectedTargets, 4, async (targetLobby) => {
				const response = await authFetch(`/api/lobby/${encodeURIComponent(targetLobby.id)}/activities/manual`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(payload),
				});
				if (!response.ok) {
					throw new Error(await parseApiError(response));
				}
				return response.json().catch(() => ({}));
			});

			const successes: SubmitSummary["successes"] = [];
			const failures: SubmitSummary["failures"] = [];
			settled.forEach((result, index) => {
				const targetLobby = selectedTargets[index];
				if (result.status === "fulfilled") {
					successes.push({ lobbyId: targetLobby.id, lobbyName: targetLobby.name });
					return;
				}
				const message =
					result.reason instanceof Error
						? result.reason.message
						: String(result.reason || "Unknown error");
				failures.push({
					lobbyId: targetLobby.id,
					lobbyName: targetLobby.name,
					error: message,
				});
			});

			if (successes.length > 0) {
				toast?.push?.(
					successes.length === 1
						? `Saved to ${successes[0].lobbyName} ✍️`
						: `Saved to ${successes.length} lobbies ✍️`
				);
				try {
					if (typeof window !== "undefined") {
						window.dispatchEvent(new CustomEvent("gymdm:refresh-live", { detail: { lobbyId } }));
					}
				} catch {
					// ignore
				}
				onSaved?.();
			}

			if (!failures.length) {
				onClose();
				return;
			}

			setSubmitSummary({ successes, failures });
			setSelectedLobbyIds(failures.map((failure) => failure.lobbyId));
			if (successes.length > 0) {
				toast?.push?.(`Saved ${successes.length}; ${failures.length} failed. Retry remaining.`);
			} else {
				toast?.push?.("Couldn't save to selected lobbies. Please retry.");
			}
		} finally {
			setBusy(false);
		}
	}

	useLayoutEffect(() => {
		if (!open || typeof document === "undefined") return;
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = previousOverflow;
		};
	}, [open]);

	if (typeof window === "undefined" || !open) return null;
	return createPortal(
		<AnimatePresence>
			<motion.div
				className="fixed inset-0 z-[120] flex items-start sm:items-center justify-center bg-black/70 p-2 sm:p-4 overflow-y-auto pt-[calc(env(safe-area-inset-top)+0.5rem)] pb-[calc(env(safe-area-inset-bottom)+0.75rem)]"
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				exit={{ opacity: 0 }}
				onClick={onClose}
			>
				<motion.div
					className="scoreboard-panel bg-card text-foreground w-full max-w-2xl mx-auto overflow-hidden flex flex-col"
					style={{ maxHeight: "calc(100dvh - 1rem)" }}
					initial={{ y: 20, opacity: 0 }}
					animate={{ y: 0, opacity: 1 }}
					exit={{ y: 20, opacity: 0 }}
					transition={{ duration: 0.2 }}
					onClick={(e) => e.stopPropagation()}
				>
					<div className="flex items-center justify-between p-4 border-b-2 border-border">
						<div>
							<div className="font-display text-lg tracking-widest text-primary">LOG WORKOUT</div>
							<div className="text-xs text-muted-foreground">Manual post with photo evidence</div>
						</div>
						<Button variant="ghost" size="sm" onClick={onClose}>
							Close
						</Button>
					</div>

					<div className="flex-1 min-h-0 p-4 sm:p-6 space-y-5 overflow-y-auto arena-scrollbar pb-6">
						<div className="space-y-2">
							<Label className="text-xs uppercase tracking-wider">Photo (required)</Label>
							{previewUrl ? (
								<div className="relative">
									<img
										src={previewUrl}
										alt="Workout preview"
										className="w-full h-48 object-cover border-2 border-border"
									/>
									<Button
										variant="destructive"
										size="sm"
										className="absolute top-2 right-2"
										onClick={() => {
											setFile(null);
											if (fileInputRef.current) fileInputRef.current.value = "";
										}}
									>
										Remove
									</Button>
								</div>
							) : (
								<button
									type="button"
									onClick={() => fileInputRef.current?.click()}
									className="w-full h-32 border-2 border-dashed border-border bg-muted/30 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors"
								>
									<span className="text-sm text-muted-foreground font-display tracking-wider">
										TAP TO UPLOAD PHOTO
									</span>
								</button>
							)}
							<input
								ref={fileInputRef}
								type="file"
								accept="image/*"
								onChange={(e) => setFile(e.target.files?.[0] || null)}
								className="hidden"
							/>
							<p className="text-xs text-muted-foreground">Photo evidence is required for manual posts.</p>
						</div>

						<div className="space-y-2">
							<Label className="text-xs uppercase tracking-wider">Record in lobbies</Label>
							<button
								type="button"
								onClick={() => setTargetSelectorOpen((prev) => !prev)}
								className="w-full h-10 px-3 rounded-md border border-border bg-input text-left text-sm font-display tracking-wider hover:border-primary/60"
								disabled={busy || targetsLoading}
							>
								{targetsLoading
									? "Loading lobbies..."
									: `${selectedLobbyIds.length} selected${selectedLobbyIds.length === 1 ? "" : ""}`}
							</button>
							{selectedLobbyNames.length > 0 && (
								<div className="flex flex-wrap gap-1.5">
									{selectedLobbyNames.map((name, index) => (
										<span
											key={`${name}-${index}`}
											className="arena-badge px-2 py-0.5 text-[10px] max-w-[220px] truncate"
											title={name}
										>
											{name}
										</span>
									))}
								</div>
							)}
							<p className="text-xs text-muted-foreground">
								One workout can post to multiple active or pre-stage lobbies.
							</p>

							{targetSelectorOpen && (
								<div className="border border-border rounded-md bg-muted/20 p-3 space-y-2">
									<Input
										value={targetSearch}
										onChange={(e) => setTargetSearch(e.target.value)}
										placeholder="Search lobbies..."
										className="bg-input border-border h-9"
									/>
									<div className="max-h-44 overflow-y-auto arena-scrollbar space-y-1 pr-1">
										{filteredLobbies.length === 0 ? (
											<div className="text-xs text-muted-foreground p-2">No eligible lobbies found.</div>
										) : (
											filteredLobbies.map((targetLobby) => {
												const selected = selectedLobbyIds.includes(targetLobby.id);
												return (
													<label
														key={targetLobby.id}
														className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/40 cursor-pointer"
													>
														<input
															type="checkbox"
															checked={selected}
															onChange={() => toggleLobbySelection(targetLobby.id)}
															disabled={busy}
															className="h-4 w-4"
														/>
														<span className="text-sm flex-1 truncate">{targetLobby.name}</span>
														<span className="text-[10px] text-muted-foreground uppercase tracking-wider">
															{targetLobby.status.replace("_", " ")}
														</span>
													</label>
												);
											})
										)}
									</div>
								</div>
							)}
						</div>

						<div className="grid gap-4 sm:grid-cols-2">
							<div className="space-y-2">
								<Label className="text-xs uppercase tracking-wider">Type</Label>
								<Select value={type} onValueChange={setType}>
									<SelectTrigger className="bg-[hsl(var(--input))] border-border !opacity-100">
										<SelectValue placeholder="Select type" />
									</SelectTrigger>
									<SelectContent
										position="item-aligned"
										className="z-[220] border-2 border-border !bg-[hsl(var(--card))] !opacity-100 shadow-[0_24px_48px_hsl(0_0%_0%/0.85)]"
									>
										<SelectItem value="run">Run</SelectItem>
										<SelectItem value="ride">Ride</SelectItem>
										<SelectItem value="gym">Gym</SelectItem>
										<SelectItem value="walk">Walk</SelectItem>
										<SelectItem value="other">Other</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div className="space-y-2">
								<Label className="text-xs uppercase tracking-wider">Caption (required)</Label>
								<Input
									value={caption}
									onChange={(e) => setCaption(e.target.value)}
									maxLength={200}
									placeholder="What did you do?"
									className="bg-input border-border"
								/>
							</div>
						</div>

						<div className="grid gap-4 sm:grid-cols-2">
							<div className="space-y-2">
								<Label className="text-xs uppercase tracking-wider">Duration (min)</Label>
								<Input
									type="number"
									inputMode="numeric"
									min="0"
									value={duration}
									onChange={(e) => setDuration(e.target.value)}
									className="bg-input border-border"
								/>
							</div>
							<div className="space-y-2">
								<Label className="text-xs uppercase tracking-wider">Distance (km)</Label>
								<Input
									type="number"
									inputMode="decimal"
									min="0"
									step="0.1"
									value={distance}
									onChange={(e) => setDistance(e.target.value)}
									className="bg-input border-border"
								/>
							</div>
						</div>

						<div className="space-y-2">
							<Label className="text-xs uppercase tracking-wider">Notes (optional)</Label>
							<Textarea
								value={notes}
								onChange={(e) => setNotes(e.target.value)}
								maxLength={200}
								className="bg-input border-border min-h-[100px]"
								placeholder="Optional notes..."
							/>
						</div>

						{submitSummary && (
							<div className="scoreboard-panel p-3 space-y-2">
								<div className="font-display text-xs tracking-widest text-primary">
									SAVE SUMMARY
								</div>
								{submitSummary.successes.length > 0 && (
									<div className="text-xs text-[hsl(var(--status-online))]">
										Saved: {submitSummary.successes.map((item) => item.lobbyName).join(", ")}
									</div>
								)}
								{submitSummary.failures.length > 0 && (
									<div className="space-y-1">
										<div className="text-xs text-destructive">
											Failed ({submitSummary.failures.length}) - retry selected:
										</div>
										<ul className="text-xs text-muted-foreground space-y-0.5">
											{submitSummary.failures.map((item) => (
												<li key={item.lobbyId}>
													{item.lobbyName}: {item.error}
												</li>
											))}
										</ul>
									</div>
								)}
							</div>
						)}
					</div>

					<div className="border-t-2 border-border p-3 sm:p-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] bg-card/95">
						<div className="flex flex-col sm:flex-row gap-2">
							<Button variant="secondary" onClick={onClose} disabled={busy}>
								Cancel
							</Button>
							<Button
								variant="arenaGold"
								onClick={submit}
								disabled={busy || selectedLobbyIds.length === 0 || targetsLoading}
							>
								{busy
									? "Saving..."
									: selectedLobbyIds.length > 1
										? `Save to ${selectedLobbyIds.length} lobbies`
										: "Save workout"}
							</Button>
						</div>
					</div>
				</motion.div>
			</motion.div>
		</AnimatePresence>,
		document.body
	);
}
