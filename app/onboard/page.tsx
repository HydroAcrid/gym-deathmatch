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
			<div className="min-h-screen flex items-center justify-center">
				<div className="text-muted-foreground">Loading…</div>
			</div>
		);
	}

	// Show sign-in page
	return (
		<div className="min-h-screen">
			<div className="container mx-auto max-w-2xl py-12 px-4">
				<div className="scoreboard-panel p-6 sm:p-8 space-y-3 text-center">
					<div className="font-display text-xl tracking-widest text-primary">WELCOME TO GYM DEATHMATCH</div>
					<div className="text-sm text-muted-foreground">Sign in to get started.</div>
					<div>
						<button className="arena-badge arena-badge-primary px-4 py-2" onClick={signInWithGoogle}>
							CONTINUE WITH GOOGLE
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}

