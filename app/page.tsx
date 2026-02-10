"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

export default function RootPage() {
	const router = useRouter();
	const { isHydrated } = useAuth();

	useEffect(() => {
		// Wait for auth to hydrate before making routing decisions
		if (!isHydrated) return;

		// Always land on home first so first-open onboarding/sign-in CTA is obvious on mobile.
		router.replace("/home");
	}, [isHydrated, router]);

	// Show loading while waiting for auth to hydrate
	return (
		<div className="min-h-screen flex items-center justify-center">
			<div className="text-center text-muted-foreground">Loading your arena…</div>
		</div>
	);
}
