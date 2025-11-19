"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

export default function RootPage() {
	const router = useRouter();
	const { user, isHydrated } = useAuth();

	useEffect(() => {
		// Wait for auth to hydrate before making routing decisions
		if (!isHydrated) return;

		// Not logged in → send them to onboarding/login
		if (!user) {
			router.replace("/onboard");
			return;
		}

		// Logged in → try last lobby
		const lastLobbyId = typeof window !== "undefined" ? localStorage.getItem("gymdm_lastLobbyId") : null;
		
		if (lastLobbyId) {
			// User has a last lobby, go there
			router.replace(`/lobby/${encodeURIComponent(lastLobbyId)}`);
		} else {
			// No last lobby, go to lobbies list
			router.replace("/lobbies");
		}
	}, [user, isHydrated, router]);

	// Show loading while waiting for auth to hydrate
	return (
		<div className="min-h-screen flex items-center justify-center bg-main text-main">
			<div className="text-center">
				<div className="text-sm text-deepBrown/70">Loading your arena…</div>
			</div>
		</div>
	);
}
