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

		// Check localStorage for last lobby
		const lastLobbyId = typeof window !== "undefined" ? localStorage.getItem("gymdm_lastLobbyId") : null;
		
		if (lastLobbyId) {
			// User has a last lobby, go there
			router.replace(`/lobby/${encodeURIComponent(lastLobbyId)}`);
		} else {
			// No last lobby, go to lobbies list
			router.replace("/lobbies");
		}
	}, [isHydrated, router]);

	// Show loading while waiting for auth to hydrate
	if (!isHydrated) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-main text-main">
				<div className="text-center">
					<div className="poster-headline text-xl mb-2">Loading your lobby...</div>
					<div className="text-sm opacity-70">Please wait</div>
				</div>
			</div>
		);
	}

	// This should rarely render (redirect happens quickly), but show a fallback
	return null;
}
