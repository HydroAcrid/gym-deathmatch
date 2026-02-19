"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ToastProvider";
import { getBrowserSupabase } from "@/lib/supabaseBrowser";
import { Button } from "@/src/ui2/ui/button";
import { Input } from "@/src/ui2/ui/input";
import { Label } from "@/src/ui2/ui/label";
import { authFetch } from "@/lib/clientAuth";

export default function OnboardPage() {
	const routeParams = useParams<{ lobbyId?: string }>();
	const lobbyId = useMemo(() => {
		const fromRoute = typeof routeParams?.lobbyId === "string" ? routeParams.lobbyId : "";
		return fromRoute.trim();
	}, [routeParams?.lobbyId]);
	const searchParams = useSearchParams();
	const toast = useToast();
	const { user, isHydrated, signInWithGoogle } = useAuth();
	const [displayName, setDisplayName] = useState("");
	const [location, setLocation] = useState("");
	const [quip, setQuip] = useState("");
	const [avatarUrl, setAvatarUrl] = useState("");
	const [fileName, setFileName] = useState("");
	const fileInputRef = useRef<HTMLInputElement | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const [existingPlayerId, setExistingPlayerId] = useState<string | null>(null);
	const [membershipChecked, setMembershipChecked] = useState(false);
	const [lobbyMissing, setLobbyMissing] = useState(false);
	const [joinBlockedReason, setJoinBlockedReason] = useState<string | null>(null);
	const [joinError, setJoinError] = useState<string | null>(null);
	const [openingExisting, setOpeningExisting] = useState(false);
	const emailName = useMemo(() => (user?.email || "").split("@")[0], [user?.email]);
	const inviteToken = useMemo(() => {
		const token = searchParams?.get("t");
		return token && token.trim().length ? token.trim() : null;
	}, [searchParams]);

	// Prefill from profile when signed in
	useEffect(() => {
		(async () => {
			if (!user?.id) return;
			try {
				const res = await authFetch(`/api/user/profile`, { cache: "no-store" });
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
				setLobbyMissing(false);
				setJoinBlockedReason(null);
				setMembershipChecked(false);
				setOpeningExisting(false);
				return;
			}
			setExistingPlayerId(null);
			setLobbyMissing(false);
			setJoinBlockedReason(null);
			setMembershipChecked(false);
			setOpeningExisting(false);
			const controller = new AbortController();
			const requestTimeout = window.setTimeout(() => controller.abort(), 12000);
			try {
				const tokenQuery = inviteToken ? `?t=${encodeURIComponent(inviteToken)}` : "";
				const res = await authFetch(`/api/lobby/${encodeURIComponent(lobbyId)}/access-state${tokenQuery}`, {
					cache: "no-store",
					signal: controller.signal
				});
				if (res.status === 404) {
					setLobbyMissing(true);
					setMembershipChecked(true);
					return;
				}
				if (!res.ok) {
					setJoinBlockedReason("Unable to verify lobby access right now.");
					setMembershipChecked(true);
					return;
				}
				const data = await res.json();
				if (data?.state === "member" && data?.memberPlayerId) {
					setExistingPlayerId(data.memberPlayerId);
					setOpeningExisting(true);
					setMembershipChecked(true);
					return;
				}
				if (data?.state === "not_member" && data?.canJoin === false) {
					setJoinBlockedReason(data?.reasonMessage || "You cannot join this lobby with this link.");
				}
				setMembershipChecked(true);
			} catch {
				setExistingPlayerId(null);
				setJoinBlockedReason("Unable to verify lobby access right now. Please refresh and try again.");
				setMembershipChecked(true);
			} finally {
				window.clearTimeout(requestTimeout);
			}
		})();
	}, [user?.id, lobbyId, inviteToken]);

	useEffect(() => {
		if (!openingExisting) return;
		const timer = window.setTimeout(() => {
			window.location.replace(`/lobby/${encodeURIComponent(lobbyId)}`);
		}, 450);
		return () => window.clearTimeout(timer);
	}, [openingExisting, lobbyId]);

	const canSubmit = Boolean(user?.id && lobbyId);

	async function saveProfile() {
		if (!user?.id) return;
		setSubmitting(true);
		try {
			await authFetch("/api/user/profile", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					displayName,
					avatarUrl,
					location,
					quip
				})
			});
			// Sync all player rows for this user to the updated profile
			await authFetch("/api/user/sync", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ overwriteAll: true })
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
		if (joinBlockedReason) {
			toast.push(joinBlockedReason);
			return;
		}
		setSubmitting(true);
		setJoinError(null);
		try {
			const res = await authFetch(`/api/lobby/${encodeURIComponent(lobbyId)}/invite`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: displayName || emailName || "Me",
					avatarUrl: avatarUrl || null,
					location: location || null,
					quip: quip || null,
					inviteToken
				})
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) {
				const message = data?.error || "Failed to join lobby";
				setJoinError(message);
				toast.push(message);
				return;
			}
			const resultingPlayerId = data?.playerId || crypto.randomUUID();
			setExistingPlayerId(resultingPlayerId);
			window.location.replace(`/lobby/${encodeURIComponent(lobbyId)}?joined=1`);
		} catch (err) {
			console.error("[onboard] join error", err);
			setJoinError("Failed to join lobby. Please try again.");
			toast.push("Failed to join lobby. Please try again.");
		} finally {
			setSubmitting(false);
		}
	}

	if (!isHydrated) {
		return (
			<div className="min-h-screen flex items-center justify-center">
				<div className="text-muted-foreground">Loading…</div>
			</div>
		);
	}

	if (!user) {
		return (
			<div className="min-h-screen">
				<div className="container mx-auto max-w-2xl py-10 px-3 sm:px-6 pb-[calc(env(safe-area-inset-bottom,0px)+6.5rem)]">
					<div className="scoreboard-panel p-6 sm:p-8 space-y-3 text-center">
						<div className="font-display text-xl tracking-widest text-primary">WELCOME</div>
						<div className="text-sm text-muted-foreground">You were invited to a lobby. Sign in to get started.</div>
						<Button variant="arenaPrimary" onClick={signInWithGoogle}>Continue with Google</Button>
					</div>
				</div>
			</div>
		);
	}

	if (lobbyMissing) {
		return (
			<div className="min-h-screen">
				<div className="container mx-auto max-w-2xl py-10 px-3 sm:px-6 pb-[calc(env(safe-area-inset-bottom,0px)+6.5rem)]">
					<div className="scoreboard-panel p-6 sm:p-8 space-y-3 text-center">
						<div className="font-display text-xl tracking-widest text-primary">LOBBY NOT FOUND</div>
						<div className="text-sm text-muted-foreground">This invite link is invalid or the lobby was removed.</div>
					</div>
				</div>
			</div>
		);
	}

	if (!lobbyId) {
		return (
			<div className="min-h-screen">
				<div className="container mx-auto max-w-2xl py-10 px-3 sm:px-6 pb-[calc(env(safe-area-inset-bottom,0px)+6.5rem)]">
					<div className="scoreboard-panel p-6 sm:p-8 space-y-3 text-center">
						<div className="font-display text-xl tracking-widest text-primary">INVALID INVITE LINK</div>
						<div className="text-sm text-muted-foreground">We could not read this lobby link. Please ask for a new invite.</div>
					</div>
				</div>
			</div>
		);
	}

	if (!membershipChecked) {
		return (
			<div className="min-h-screen">
				<div className="container mx-auto max-w-2xl py-10 px-3 sm:px-6 pb-[calc(env(safe-area-inset-bottom,0px)+6.5rem)]">
					<div className="scoreboard-panel p-6 sm:p-8 space-y-3 text-center">
						<div className="font-display text-xl tracking-widest text-primary">CHECKING INVITE</div>
						<div className="text-sm text-muted-foreground">Looking up your lobby access...</div>
					</div>
				</div>
			</div>
		);
	}

	if (openingExisting) {
		return (
			<div className="min-h-screen">
				<div className="container mx-auto max-w-2xl py-10 px-3 sm:px-6 pb-[calc(env(safe-area-inset-bottom,0px)+6.5rem)]">
					<div className="scoreboard-panel p-6 sm:p-8 space-y-3 text-center">
						<div className="font-display text-xl tracking-widest text-primary">OPENING LOBBY</div>
						<div className="text-sm text-muted-foreground">You are already in this lobby. Taking you there now...</div>
					</div>
				</div>
			</div>
		);
	}

	if (joinBlockedReason) {
		return (
			<div className="min-h-screen">
				<div className="container mx-auto max-w-2xl py-10 px-3 sm:px-6 pb-[calc(env(safe-area-inset-bottom,0px)+6.5rem)]">
					<div className="scoreboard-panel p-6 sm:p-8 space-y-3 text-center">
						<div className="font-display text-xl tracking-widest text-primary">INVITE UNAVAILABLE</div>
						<div className="text-sm text-muted-foreground">{joinBlockedReason}</div>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen">
			<div className="container mx-auto max-w-2xl py-10 px-3 sm:px-6 pb-[calc(env(safe-area-inset-bottom,0px)+6.5rem)] space-y-4">
				<div className="scoreboard-panel p-4 sm:p-6 space-y-4 overflow-hidden">
					<div className="font-display text-xl tracking-widest text-primary">SET UP YOUR PROFILE</div>
					<div className="grid gap-3">
						<div className="space-y-2">
							<Label className="text-xs uppercase tracking-wider">Display name</Label>
							<Input
								className="bg-input border-border"
								value={displayName}
								onChange={(e) => setDisplayName(e.target.value)}
								placeholder="Your name"
							/>
						</div>
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
							<div className="space-y-2">
								<Label className="text-xs uppercase tracking-wider">Location</Label>
								<Input
									className="bg-input border-border"
									value={location}
									onChange={(e) => setLocation(e.target.value)}
									placeholder="City, State"
								/>
							</div>
							<div className="space-y-2">
								<Label className="text-xs uppercase tracking-wider">Quip</Label>
								<Input
									className="bg-input border-border"
									value={quip}
									onChange={(e) => setQuip(e.target.value)}
									placeholder="Short tagline"
								/>
							</div>
						</div>
						<div className="space-y-2">
							<Label className="text-xs uppercase tracking-wider">Paste image URL</Label>
							<Input
								className="bg-input border-border"
								value={avatarUrl}
								onChange={(e) => setAvatarUrl(e.target.value)}
								placeholder="https://..."
							/>
						</div>
						<div className="text-center text-xs text-muted-foreground">— or —</div>
						<div className="space-y-2">
							<Label className="text-xs uppercase tracking-wider">Upload image (avatars bucket)</Label>
							<div className="flex items-center gap-2">
								<Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={submitting}>
									Choose file
								</Button>
								<span className="text-[11px] text-muted-foreground truncate min-w-0 flex-1">{fileName}</span>
							</div>
							<input ref={fileInputRef} className="hidden" type="file" accept="image/*" onChange={onUpload} />
						</div>
						{avatarUrl && (
							<div className="mt-2 flex items-center gap-3 min-w-0">
								<img src={avatarUrl} alt="preview" className="h-12 w-12 object-cover border border-border" />
								<span className="text-xs text-muted-foreground truncate min-w-0 flex-1">{avatarUrl}</span>
							</div>
						)}
						<div className="flex flex-col sm:flex-row gap-2">
							<Button className="w-full sm:w-auto" variant="secondary" onClick={saveProfile} disabled={submitting}>
								Save profile
							</Button>
							<Button className="w-full sm:w-auto" variant="arenaPrimary" onClick={joinLobby} disabled={submitting}>
								Join this lobby
							</Button>
						</div>
						{joinError ? <div className="text-xs text-destructive">{joinError}</div> : null}
					</div>
				</div>
				<div className="scoreboard-panel p-4 sm:p-6 space-y-3 overflow-hidden">
					<div className="font-display text-lg tracking-widest text-primary">CONNECT STRAVA</div>
					<div className="text-sm text-muted-foreground">Once you’ve joined, connect your Strava account so your workouts sync.</div>
					<a
						className="arena-badge arena-badge-primary px-4 py-2 inline-flex"
						href={`/api/strava/authorize?playerId=${encodeURIComponent(existingPlayerId || user.id)}&lobbyId=${encodeURIComponent(lobbyId)}`}
					>
						Connect my Strava
					</a>
				</div>
			</div>
		</div>
	);
}
