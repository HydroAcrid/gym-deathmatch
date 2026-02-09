"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
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

export function ManualActivityModal({
	open,
	onClose,
	lobbyId,
	onSaved
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
	const fileInputRef = useRef<HTMLInputElement>(null);
	const supabase = (require("@/lib/supabaseBrowser") as any).getBrowserSupabase?.() || null;
	const toast = useToast?.();
	const { user } = useAuth();

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

	async function submit() {
		if (!user?.id) {
			toast?.push?.("Sign in to log workouts");
			return;
		}
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
				let folder = user.id;
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
			await authFetch(`/api/lobby/${encodeURIComponent(lobbyId)}/activities/manual`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
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

	useLayoutEffect(() => {
		if (!open || typeof document === "undefined") return;
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = previousOverflow;
		};
	}, [open]);

	// Render in a portal so transforms on parents don't trap the overlay
	if (typeof window === "undefined" || !open) return null;
	return createPortal(
		<AnimatePresence>
			<motion.div
				className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 overflow-y-auto"
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				exit={{ opacity: 0 }}
			>
				<motion.div
					className="scoreboard-panel bg-card text-foreground w-full max-w-2xl mx-auto overflow-hidden"
					style={{ maxHeight: "calc(100vh - 2rem)" }}
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

					<div className="p-4 sm:p-6 space-y-5 overflow-y-auto">
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

						<div className="grid gap-4 sm:grid-cols-2">
							<div className="space-y-2">
								<Label className="text-xs uppercase tracking-wider">Type</Label>
								<Select value={type} onValueChange={setType}>
									<SelectTrigger className="bg-input border-border">
										<SelectValue placeholder="Select type" />
									</SelectTrigger>
									<SelectContent>
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

						<div className="flex flex-col sm:flex-row gap-2">
							<Button variant="secondary" onClick={onClose} disabled={busy}>
								Cancel
							</Button>
							<Button variant="arenaGold" onClick={submit} disabled={busy}>
								{busy ? "Saving..." : "Save workout"}
							</Button>
						</div>
					</div>
				</motion.div>
			</motion.div>
		</AnimatePresence>,
		document.body
	);
}
