"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { useToast } from "./ToastProvider";

export function ManualActivityModal({
	open,
	onClose,
	lobbyId,
	playerId,
	onSaved
}: {
	open: boolean;
	onClose: () => void;
	lobbyId: string;
	playerId: string;
	onSaved?: () => void;
}) {
	const [type, setType] = useState<string>("gym");
	const [duration, setDuration] = useState<string>("");
	const [distance, setDistance] = useState<string>("");
	const [notes, setNotes] = useState<string>("");
	const [caption, setCaption] = useState<string>("");
	const [file, setFile] = useState<File | null>(null);
	const [busy, setBusy] = useState<boolean>(false);
	const supabase = (require("@/lib/supabaseBrowser") as any).getBrowserSupabase?.() || null;
	const userId = (typeof window !== "undefined" && localStorage.getItem("gymdm_playerUserId")) || null;
	const toast = useToast?.();

	async function submit() {
		if (!file || !caption.trim()) {
			alert("Please add a photo and caption.");
			return;
		}
		setBusy(true);
		try {
			// upload photo to "manual-activity-photos" bucket
			let publicUrl = "";
			if (supabase && file) {
				// Storage RLS expects folder == auth.uid(). Use that when available, otherwise fall back.
				let folder = playerId;
				try {
					const { data } = await supabase.auth.getUser();
					const uid = (data && (data as any).user && (data as any).user.id) || null;
					if (uid) folder = uid;
				} catch {
					// ignore - will fall back to playerId
				}
				// Sanitize filename to avoid illegal path characters
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
			await fetch(`/api/lobby/${encodeURIComponent(lobbyId)}/activities/manual`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					playerId,
					// Date is automatically set to current time on the server
					type,
					durationMinutes: duration ? Number(duration) : null,
					distanceKm: distance ? Number(distance) : null,
					notes,
					photoUrl: publicUrl,
					caption
				})
			});
			// Toast confirmation
			try { toast?.push?.("Post submitted ✍️"); } catch { /* ignore */ }
			onClose();
			onSaved?.();
		} finally {
			setBusy(false);
		}
	}

	// Render in a portal so transforms on parents don't trap the overlay
	if (typeof window === "undefined" || !open) return null;
	return createPortal(
		<AnimatePresence>
			<motion.div
				className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4"
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				exit={{ opacity: 0 }}
			>
				<motion.div
					className="paper-card paper-grain ink-edge bg-tan text-deepBrown w-full h-[92vh] sm:h-auto sm:max-w-lg sm:w-[92%] p-4 sm:p-6 overflow-y-auto"
					initial={{ y: 20, opacity: 0 }}
					animate={{ y: 0, opacity: 1 }}
					exit={{ y: 20, opacity: 0 }}
					transition={{ duration: 0.2 }}
					onClick={(e) => e.stopPropagation()}
				>
					<div className="poster-headline text-xl sm:text-2xl mb-3">Log workout manually</div>
					<div className="grid gap-3">
						<label className="text-xs">
								<span className="block mb-1">Type</span>
								<select
									value={type}
									onChange={(e) => setType(e.target.value)}
									className="w-full px-3 py-2 rounded-md border border-deepBrown/40 bg-[#1f1a17] text-cream"
									style={{ colorScheme: "dark" }}
								>
									<option value="run">Run</option>
									<option value="ride">Ride</option>
									<option value="gym">Gym</option>
									<option value="walk">Walk</option>
									<option value="other">Other</option>
								</select>
							</label>
							<label className="text-xs">
								<span className="block mb-1">Photo (required)</span>
								<input
									type="file"
									accept="image/*"
									onChange={(e) => setFile(e.target.files?.[0] || null)}
									className="w-full px-3 py-2 rounded-md border border-deepBrown/40 bg-cream text-deepBrown"
								/>
							</label>
							<label className="text-xs">
								<span className="block mb-1">Caption (required)</span>
								<input
									type="text"
									value={caption}
									onChange={(e) => setCaption(e.target.value)}
									maxLength={200}
									placeholder="What did you do?"
									className="w-full px-3 py-2 rounded-md border border-deepBrown/40 bg-cream text-deepBrown"
								/>
							</label>
							<div className="grid grid-cols-2 gap-3">
								<label className="text-xs">
									<span className="block mb-1">Duration (min)</span>
									<input
										type="number"
										inputMode="numeric"
										min="0"
										value={duration}
										onChange={(e) => setDuration(e.target.value)}
										className="w-full px-3 py-2 rounded-md border border-deepBrown/40 bg-cream text-deepBrown"
										style={{ colorScheme: "dark" }}
									/>
								</label>
								<label className="text-xs">
									<span className="block mb-1">Distance (km)</span>
									<input
										type="number"
										inputMode="decimal"
										min="0"
										step="0.1"
										value={distance}
										onChange={(e) => setDistance(e.target.value)}
										className="w-full px-3 py-2 rounded-md border border-deepBrown/40 bg-cream text-deepBrown"
										style={{ colorScheme: "dark" }}
									/>
								</label>
							</div>
							<label className="text-xs">
								<span className="block mb-1">Notes (optional)</span>
								<textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={200}
									className="w-full px-3 py-2 rounded-md border border-deepBrown/40 bg-cream text-deepBrown min-h-[80px]" />
							</label>
						</div>

						<div className="mt-4 flex gap-2">
							<button className="btn-secondary px-3 py-2 rounded-md min-h-[44px] text-xs" onClick={onClose} disabled={busy}>
								Cancel
							</button>
							<button className="btn-vintage px-4 py-2 rounded-md min-h-[44px] text-xs" onClick={submit} disabled={busy}>
								Save workout
							</button>
						</div>
				</motion.div>
			</motion.div>
		</AnimatePresence>,
		document.body
	);
}


