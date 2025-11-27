"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { getBrowserSupabase } from "@/lib/supabaseBrowser";

function slugify(s: string) {
	return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export default function OnboardPage({ params }: { params: { lobbyId: string } }) {
	const lobbyId = params.lobbyId;
	const { user, isHydrated, signInWithGoogle } = useAuth();
	const [displayName, setDisplayName] = useState("");
	const [location, setLocation] = useState("");
	const [quip, setQuip] = useState("");
	const [avatarUrl, setAvatarUrl] = useState("");
	const [fileName, setFileName] = useState("");
	const fileInputRef = useRef<HTMLInputElement | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const [existingPlayerId, setExistingPlayerId] = useState<string | null>(null);
	const emailName = useMemo(() => (user?.email || "").split("@")[0], [user?.email]);

	// Prefill from profile when signed in
	useEffect(() => {
		(async () => {
			if (!user?.id) return;
			try {
				const res = await fetch(`/api/user/profile?userId=${encodeURIComponent(user.id)}`, { cache: "no-store" });
				if (!res.ok) return;
				const j = await res.json();
				if (j?.name) setDisplayName(j.name);
				if (j?.location) setLocation(j.location);
				if (j?.quip) setQuip(j.quip);
				if (j?.avatarUrl) setAvatarUrl(j.avatarUrl);
			} catch {
				/* ignore */
			}
		})();
	}, [user?.id]);

	// Check if the user already has a player in this lobby
	useEffect(() => {
		(async () => {
			if (!user?.id || !lobbyId) {
				setExistingPlayerId(null);
				return;
			}
			try {
				const res = await fetch(`/api/lobby/${encodeURIComponent(lobbyId)}/live`, { cache: "no-store" });
				if (!res.ok) return;
				const data = await res.json();
				const players = (data?.lobby?.players || []) as Array<{ id: string; userId?: string | null }>;
				const mine = players.find((p) => p.userId === user.id);
				setExistingPlayerId(mine ? mine.id : null);
			} catch {
				setExistingPlayerId(null);
			}
		})();
	}, [user?.id, lobbyId]);

	const canSubmit = Boolean(user?.id && lobbyId);

	async function saveProfile() {
		if (!user?.id) return;
		setSubmitting(true);
		try {
			await fetch("/api/user/profile", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					userId: user.id,
					displayName,
					avatarUrl,
					location,
					quip
				})
			});
			// Sync all player rows for this user to the updated profile
			await fetch("/api/user/sync", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ userId: user.id, overwriteAll: true })
			});
		} finally {
			setSubmitting(false);
		}
	}

	async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		if (!file || !user?.id) return;
		setFileName(file.name);
		setSubmitting(true);
		try {
			const supabase = getBrowserSupabase();
			if (!supabase) {
				alert("Upload not configured. Paste an image URL instead.");
				return;
			}
			const path = `${user.id}/${Date.now()}_${file.name}`;
			const bucket = supabase.storage.from("avatars");
			const { error } = await bucket.upload(path, file, {
				upsert: true,
				cacheControl: "3600",
				contentType: file.type || "image/*"
			});
			if (error) {
				const msg = (error as any)?.message || String(error);
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
				setAvatarUrl(data.publicUrl);
			}
		} finally {
			setSubmitting(false);
		}
	}

	async function joinLobby() {
		if (!canSubmit) return;
		setSubmitting(true);
		try {
			const res = await fetch(`/api/lobby/${encodeURIComponent(lobbyId)}/invite`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: displayName || emailName || "Me",
					avatarUrl: avatarUrl || null,
					location: location || null,
					quip: quip || null,
					userId: user!.id
				})
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) {
				throw new Error(data?.error || "Failed to join lobby");
			}
			const resultingPlayerId = data?.playerId || crypto.randomUUID();
			setExistingPlayerId(resultingPlayerId);
			window.location.replace(`/lobby/${encodeURIComponent(lobbyId)}?joined=1`);
		} catch (err) {
			console.error("[onboard] join error", err);
		} finally {
			setSubmitting(false);
		}
	}

	if (!isHydrated) {
		return (
			<div className="mx-auto max-w-2xl py-10 px-4">
				<div className="paper-card paper-grain ink-edge p-6 border-b-4" style={{ borderColor: "#E1542A" }}>
					<div className="text-sm text-deepBrown/70">Loading…</div>
				</div>
			</div>
		);
	}

	if (!user) {
		return (
			<div className="mx-auto max-w-2xl py-10 px-4">
				<div className="paper-card paper-grain ink-edge p-6 border-b-4" style={{ borderColor: "#E1542A" }}>
					<div className="poster-headline text-xl mb-2">Welcome to Gym Deathmatch</div>
					<div className="text-sm mb-3">You were invited to a lobby. Sign in to get started.</div>
					<button className="btn-vintage px-4 py-2 rounded-md" onClick={signInWithGoogle}>Continue with Google</button>
				</div>
			</div>
		);
	}

	return (
		<div className="mx-auto max-w-2xl py-10 px-4">
			<div className="paper-card paper-grain ink-edge p-6 border-b-4 mb-4" style={{ borderColor: "#E1542A" }}>
				<div className="poster-headline text-xl mb-2">Set up your profile</div>
				<div className="grid gap-3">
					<label className="text-xs">
						<span className="block mb-1">Display name</span>
						<input
							className="arena-input"
							value={displayName}
							onChange={(e) => setDisplayName(e.target.value)}
							placeholder="Your name"
						/>
					</label>
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
						<label className="text-xs">
							<span className="block mb-1">Location</span>
							<input
								className="arena-input"
								value={location}
								onChange={(e) => setLocation(e.target.value)}
								placeholder="City, State"
							/>
						</label>
						<label className="text-xs">
							<span className="block mb-1">Quip</span>
							<input
								className="arena-input"
								value={quip}
								onChange={(e) => setQuip(e.target.value)}
								placeholder="Short tagline"
							/>
						</label>
					</div>
					<label className="text-xs">
						<span className="block mb-1">Paste image URL</span>
						<input
							className="arena-input"
							value={avatarUrl}
							onChange={(e) => setAvatarUrl(e.target.value)}
							placeholder="https://..."
						/>
					</label>
					<div className="text-center text-xs text-deepBrown/70">— or —</div>
					<div className="block text-xs">
						<span className="block mb-1">Upload image (Supabase Storage ‘avatars’ bucket)</span>
						<div className="flex items-center gap-2">
							<button type="button" className="px-3 py-2 rounded-md border border-deepBrown/30 text-xs" onClick={() => fileInputRef.current?.click()} disabled={submitting}>
								Choose file
							</button>
							<span className="text-[11px] text-deepBrown/70 truncate max-w-[220px]">{fileName}</span>
						</div>
						<input ref={fileInputRef} className="hidden" type="file" accept="image/*" onChange={onUpload} />
					</div>
					{avatarUrl && (
						<div className="mt-2 flex items-center gap-3">
							<img src={avatarUrl} alt="preview" className="h-12 w-12 rounded-full object-cover border border-deepBrown/30" />
							<span className="text-xs text-deepBrown/70 truncate">{avatarUrl}</span>
						</div>
					)}
					<div className="flex gap-2">
						<button className="px-3 py-2 rounded-md border border-deepBrown/30 text-xs" onClick={saveProfile} disabled={submitting}>
							Save profile
						</button>
						<button className="btn-vintage px-3 py-2 rounded-md text-xs" onClick={joinLobby} disabled={submitting || !!existingPlayerId}>
							{existingPlayerId ? "Already joined" : "Join this lobby"}
						</button>
					</div>
				</div>
			</div>
			<div className="paper-card paper-grain ink-edge p-6">
				<div className="poster-headline text-lg mb-2">Connect Strava</div>
				<div className="text-sm mb-3">Once you’ve joined, connect your Strava account so your workouts sync.</div>
				<a
					className="btn-vintage px-4 py-2 rounded-md text-xs"
					href={`/api/strava/authorize?playerId=${encodeURIComponent(existingPlayerId || user.id)}&lobbyId=${encodeURIComponent(lobbyId)}`}
				>
					Connect my Strava
				</a>
			</div>
		</div>
	);
}
