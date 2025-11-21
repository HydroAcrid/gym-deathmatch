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

		router.replace(user ? "/home" : "/lobbies");
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
