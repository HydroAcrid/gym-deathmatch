"use client";

import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function OnboardPage() {
	const { user, isHydrated, signInWithGoogle } = useAuth();
	const router = useRouter();

	useEffect(() => {
		// If already logged in, redirect to lobbies
		if (isHydrated && user) {
			router.replace("/lobbies");
		}
	}, [user, isHydrated, router]);

	// Show loading while auth hydrates
	if (!isHydrated) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-main text-main">
				<div className="text-center">
					<div className="text-sm text-deepBrown/70">Loading…</div>
				</div>
			</div>
		);
	}

	// Show sign-in page
	return (
		<div className="mx-auto max-w-2xl py-10 px-4">
			<div className="paper-card paper-grain ink-edge p-6 border-b-4" style={{ borderColor: "#E1542A" }}>
				<div className="poster-headline text-xl mb-2">Welcome to Gym Deathmatch</div>
				<div className="text-sm mb-3">Sign in to get started.</div>
				<button className="btn-vintage px-4 py-2 rounded-md" onClick={signInWithGoogle}>
					Continue with Google
				</button>
			</div>
		</div>
	);
}

