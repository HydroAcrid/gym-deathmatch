"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "./AuthProvider";
import { getBrowserSupabase } from "@/lib/supabaseBrowser";

export function ProfileAvatar() {
	const { user } = useAuth();
	const [open, setOpen] = useState(false);
	const [busy, setBusy] = useState(false);
	const [url, setUrl] = useState("");
	const [fileName, setFileName] = useState("");
	const inputRef = useRef<HTMLInputElement | null>(null);
	const [current, setCurrent] = useState<string>("");

	if (!user) return null;

	// Load current avatar (by user_id, then fallback to local player id)
	useEffect(() => {
		(async () => {
			try {
				const supabase = getBrowserSupabase();
				if (!supabase) return;
				let avatar: string | null = null;
				const { data, error } = await supabase.from("player").select("avatar_url").eq("user_id", user.id).maybeSingle();
				if (!error && data?.avatar_url) avatar = data.avatar_url as string;
				if (!avatar) {
					const pid = typeof window !== "undefined" ? localStorage.getItem("gymdm_playerId") : null;
					if (pid) {
						const { data: d2 } = await supabase.from("player").select("avatar_url").eq("id", pid).maybeSingle();
						if (d2?.avatar_url) avatar = d2.avatar_url as string;
					}
				}
				if (avatar) setCurrent(avatar);
			} catch {
				// ignore
			}
		})();
	}, [user?.id]);

	async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		if (!file) return;
		setFileName(file.name);
		setBusy(true);
		try {
			const supabase = getBrowserSupabase();
			if (!supabase) {
				alert("Upload not configured. Paste an image URL instead.");
				return;
			}
			const path = `${user.id}/${Date.now()}_${file.name}`;
			const bucket = supabase.storage.from("avatars");
			const { error: upErr } = await bucket.upload(path, file, {
				upsert: true,
				cacheControl: "3600",
				contentType: file.type || "image/*"
			});
			if (upErr) {
				const msg = (upErr as any)?.message || String(upErr);
				if (msg.includes("Bucket not found")) {
					alert("Storage bucket 'avatars' not found. Create a public bucket named 'avatars' in Supabase → Storage.");
				} else if (msg.toLowerCase().includes("row-level security")) {
					alert("Upload blocked by Storage RLS. Add storage policies for bucket 'avatars' to allow authenticated insert/update.");
				} else {
					alert("Upload failed: " + msg);
				}
				return;
			}
			const { data } = bucket.getPublicUrl(path);
			if (data?.publicUrl) {
				setUrl(data.publicUrl);
			}
		} finally {
			setBusy(false);
		}
	}

	async function save() {
		if (!url.trim()) {
			alert("Provide an avatar URL or upload a file.");
			return;
		}
		setBusy(true);
		try {
			await fetch("/api/user/avatar", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ userId: user.id, avatarUrl: url.trim(), playerId: localStorage.getItem("gymdm_playerId") || null })
			});
			setOpen(false);
		} finally {
			setBusy(false);
		}
	}

	return (
		<>
			<button className="ml-2 h-7 w-7 rounded-full bg-cream text-deepBrown flex items-center justify-center border border-deepBrown/30 overflow-hidden"
				title="Edit profile picture"
				onClick={() => setOpen(true)}
			>
				{current ? (
					<img src={current} alt="me" className="h-full w-full object-cover" />
				) : (
					<span>👤</span>
				)}
			</button>
			<AnimatePresence>
				{open && (
					<motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
						initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
						<motion.div className="paper-card paper-grain ink-edge max-w-md w-[92%] p-6 bg-tan"
							initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}>
							<div className="poster-headline text-xl mb-3">Update Profile Picture</div>
							<div className="space-y-3">
								<label className="block text-xs">
									<span className="block mb-1">Paste image URL</span>
									<input className="w-full px-3 py-2 rounded-md border border-deepBrown/40 bg-cream text-deepBrown"
										placeholder="https://..."
										value={url}
										onChange={(e) => setUrl(e.target.value)}
									/>
								</label>
								<div className="text-center text-xs text-deepBrown/70">— or —</div>
								<div className="block text-xs">
									<span className="block mb-1">Upload image (uses Supabase Storage ‘avatars’ bucket)</span>
									<div className="flex items-center gap-2">
										<button type="button" className="px-3 py-2 rounded-md border border-deepBrown/30 text-xs" onClick={() => inputRef.current?.click()} disabled={busy}>
											Choose file
										</button>
										<span className="text-[11px] text-deepBrown/70 truncate max-w-[220px]">{fileName}</span>
									</div>
									<input ref={inputRef} className="hidden" type="file" accept="image/*" onChange={onUpload} />
								</div>
								{url && (
									<div className="mt-2 flex items-center gap-3">
										<img src={url} alt="preview" className="h-12 w-12 rounded-full object-cover border border-deepBrown/30" />
										<span className="text-xs text-deepBrown/70 truncate">{url}</span>
									</div>
								)}
								<div className="flex justify-end gap-2 mt-2">
									<button className="px-3 py-2 rounded-md border border-deepBrown/30 text-xs" onClick={() => setOpen(false)} disabled={busy}>Cancel</button>
									<button className="btn-vintage px-3 py-2 rounded-md text-xs" onClick={async () => { await save(); setCurrent(url || current); }} disabled={busy}>{busy ? "Saving..." : "Save"}</button>
								</div>
							</div>
						</motion.div>
					</motion.div>
				)}
			</AnimatePresence>
		</>
	);
}


