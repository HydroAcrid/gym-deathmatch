"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getBrowserSupabase } from "@/lib/supabaseBrowser";

type AuthContextValue = {
	user: User | null;
	isHydrated: boolean; // true once we've checked auth state (even if user is null)
	signInMagic: (email?: string) => Promise<void>;
	signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
	user: null,
	isHydrated: false,
	signInMagic: async () => {},
	signOut: async () => {}
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
	const supabase = useMemo(() => getBrowserSupabase(), []);
	const [user, setUser] = useState<User | null>(null);
	const [isHydrated, setIsHydrated] = useState(false);

	useEffect(() => {
		if (!supabase) {
			setIsHydrated(true); // No supabase = hydrated (but no auth)
			return;
		}
		let ignore = false;
		supabase.auth.getUser().then(({ data }: { data: { user: User | null } }) => {
			if (!ignore) {
				setUser(data.user ?? null);
				setIsHydrated(true); // Mark as hydrated after initial check
			}
		});
		const { data: sub } = supabase.auth.onAuthStateChange((_e: any, session: any) => {
			setUser(session?.user ?? null);
			setIsHydrated(true); // Mark as hydrated on any auth state change
			try {
				if (typeof window !== "undefined" && session?.user?.id) {
					localStorage.setItem("gymdm_userId", session.user.id);
				}
			} catch { /* ignore */ }
		});
		return () => {
			ignore = true;
			sub.subscription.unsubscribe();
		};
	}, [supabase]);

	async function signInMagic(email?: string) {
		if (!supabase) {
			alert("Auth not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
			return;
		}
		const e = email || window.prompt("Enter your email for a magic sign-in link") || "";
		if (!e) return;
		// Use window.location.origin to ensure magic link returns to the exact origin the user is on
		// This prevents domain mismatch issues (e.g., NEXT_PUBLIC_BASE_URL pointing to vercel.app
		// while PWA is installed from a different domain)
		const origin = window.location.origin;
		// If user is on an onboarding or join route, return them to the same page after magic link
		// Otherwise, redirect to "/" which will handle routing based on localStorage
		let nextPath = "/";
		try {
			const path = window.location.pathname || "";
			if (path.startsWith("/onboard/") || path.startsWith("/join/")) {
				nextPath = path;
			}
		} catch { /* ignore */ }
		await supabase.auth.signInWithOtp({ email: e, options: { emailRedirectTo: origin + nextPath } });
		alert("Check your email for the sign-in link.");
	}

	async function signOut() {
		if (!supabase) return;
		await supabase.auth.signOut();
	}

	return <AuthContext.Provider value={{ user, isHydrated, signInMagic, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
	return useContext(AuthContext);
}


