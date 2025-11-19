"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";

function slugify(s: string) {
	return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export default function OnboardPage({ params }: { params: Promise<{ lobbyId: string }> }) {
	// In app router, params is a Promise in Next.js 15/16
	// We read it client-side using React.use() pattern by awaiting inside an effect;
	// but for simplicity here, we'll parse from location as a fallback.
	const [lobbyId, setLobbyId] = useState<string>("");
	useEffect(() => {
		let mounted = true;
		(async () => {
			try {
				// Next passes params as a promise to client components too in some versions
				// Attempt to unwrap if it's a promise
				const p: any = params as any;
				const resolved = typeof p?.then === "function" ? await p : p;
				const id = decodeURIComponent(resolved?.lobbyId || window.location.pathname.split("/").pop() || "");
				if (mounted) setLobbyId(id);
			} catch {
				const id = decodeURIComponent(window.location.pathname.split("/").pop() || "");
				if (mounted) setLobbyId(id);
			}
		})();
		return () => { mounted = false; };
	}, [params]);
	const { user, signInWithGoogle } = useAuth();
	const [displayName, setDisplayName] = useState("");
	const [location, setLocation] = useState("");
	const [quip, setQuip] = useState("");
	const [avatarUrl, setAvatarUrl] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const emailName = useMemo(() => (user?.email || "").split("@")[0], [user?.email]);

	useEffect(() => {
		(async () => {
			if (!user?.id) return;
			// If already a member of this lobby, jump straight to the lobby
			try {
				const r = await fetch(`/api/lobbies?userId=${encodeURIComponent(user.id)}`, { cache: "no-store" });
				const j = await r.json();
				const isMember = (j?.lobbies ?? []).some((l: any) => l.id === lobbyId);
				if (isMember) {
					window.location.replace(`/lobby/${encodeURIComponent(lobbyId)}`);
					return;
				}
			} catch { /* ignore */ }
			try {
				const res = await fetch(`/api/user/profile?userId=${encodeURIComponent(user.id)}`, { cache: "no-store" });
				if (!res.ok) return;
				const j = await res.json();
				if (j?.name) setDisplayName(j.name);
				if (j?.location) setLocation(j.location);
				if (j?.quip) setQuip(j.quip);
				if (j?.avatarUrl) setAvatarUrl(j.avatarUrl);
			} catch { /* ignore */ }
		})();
	}, [user?.id]);

	async function saveProfile() {
		if (!user?.id) return;
		setSubmitting(true);
		try {
			await fetch("/api/profile", {
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
		} finally {
			setSubmitting(false);
		}
	}

	async function joinLobby() {
		if (!user?.id) return;
		setSubmitting(true);
		try {
			// Use the Supabase user id as the player id to guarantee uniqueness and proper membership mapping
			const id = user.id;
			await fetch(`/api/lobby/${encodeURIComponent(lobbyId)}/invite`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					id, // player primary key
					name: displayName || emailName || "Me",
					avatarUrl: avatarUrl || null,
					location: location || null,
					quip: quip || null,
					userId: user.id
				})
			});
			localStorage.setItem("gymdm_playerId", id);
			localStorage.setItem("gymdm_lastLobbyId", lobbyId);
			// Go to lobby; the connect banner is shown there when not connected
			window.location.replace(`/lobby/${encodeURIComponent(lobbyId)}?joined=1`);
		} finally {
			setSubmitting(false);
		}
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
						<input className="w-full px-3 py-2 rounded-md border border-deepBrown/40 bg-cream text-deepBrown"
							value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your name" />
					</label>
					<div className="grid grid-cols-2 gap-3">
						<label className="text-xs">
							<span className="block mb-1">Location</span>
							<input className="w-full px-3 py-2 rounded-md border border-deepBrown/40 bg-cream text-deepBrown"
								value={location} onChange={e => setLocation(e.target.value)} placeholder="City, State" />
						</label>
						<label className="text-xs">
							<span className="block mb-1">Quip</span>
							<input className="w-full px-3 py-2 rounded-md border border-deepBrown/40 bg-cream text-deepBrown"
								value={quip} onChange={e => setQuip(e.target.value)} placeholder="Short tagline" />
						</label>
					</div>
					<label className="text-xs">
						<span className="block mb-1">Avatar URL (optional)</span>
						<input className="w-full px-3 py-2 rounded-md border border-deepBrown/40 bg-cream text-deepBrown"
							value={avatarUrl} onChange={e => setAvatarUrl(e.target.value)} placeholder="https://..." />
					</label>
					<div className="flex gap-2">
						<button className="px-3 py-2 rounded-md border border-deepBrown/30 text-xs" onClick={saveProfile} disabled={submitting}>Save profile</button>
						<button className="btn-vintage px-3 py-2 rounded-md text-xs" onClick={joinLobby} disabled={submitting}>Join this lobby</button>
					</div>
				</div>
			</div>
			<div className="paper-card paper-grain ink-edge p-6">
				<div className="poster-headline text-lg mb-2">Connect Strava</div>
				<div className="text-sm mb-3">Once you’ve joined, connect your Strava account so your workouts sync.</div>
				<a className="btn-vintage px-4 py-2 rounded-md text-xs"
					href={`/api/strava/authorize?playerId=${encodeURIComponent(localStorage.getItem("gymdm_playerId") || "")}&lobbyId=${encodeURIComponent(lobbyId)}`}>
					Connect my Strava
				</a>
			</div>
		</div>
	);
}


