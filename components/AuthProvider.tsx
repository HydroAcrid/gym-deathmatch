"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getBrowserSupabase } from "@/lib/supabaseBrowser";

type AuthContextValue = {
	user: User | null;
	isHydrated: boolean; // true once we've checked auth state (even if user is null)
	signInWithGoogle: () => Promise<void>;
	signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
	user: null,
	isHydrated: false,
	signInWithGoogle: async () => {},
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
		let initialCheckComplete = false;
		
		// Initial auth check - must complete before isHydrated is true
		supabase.auth.getUser().then(({ data }: { data: { user: User | null } }) => {
			if (!ignore) {
				setUser(data.user ?? null);
				initialCheckComplete = true;
				setIsHydrated(true); // Mark as hydrated ONLY after initial check completes
				try {
					if (typeof window !== "undefined" && data.user?.id) {
						localStorage.setItem("gymdm_userId", data.user.id);
					}
				} catch { /* ignore */ }
			}
		}).catch((err: unknown) => {
			console.error("[AuthProvider] getUser error:", err);
			if (!ignore) {
				initialCheckComplete = true;
				setIsHydrated(true); // Even on error, mark as hydrated so UI doesn't hang
			}
		});
		
		// Listen for auth state changes (OAuth callbacks, sign out, etc.)
		const { data: sub } = supabase.auth.onAuthStateChange((_e: any, session: any) => {
			if (!ignore) {
				setUser(session?.user ?? null);
				// Only set isHydrated if initial check already completed
				// This prevents race conditions where onAuthStateChange fires before getUser() resolves
				if (initialCheckComplete) {
					setIsHydrated(true);
				}
				try {
					if (typeof window !== "undefined" && session?.user?.id) {
						localStorage.setItem("gymdm_userId", session.user.id);
					}
				} catch { /* ignore */ }
			}
		});
		return () => {
			ignore = true;
			sub.subscription.unsubscribe();
		};
	}, [supabase]);

	async function signInWithGoogle() {
		if (!supabase) {
			alert("Auth not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
			return;
		}

		const fromEnv = process.env.NEXT_PUBLIC_BASE_URL;
		const base = (
			fromEnv && fromEnv.startsWith("http")
				? fromEnv
				: (typeof window !== "undefined" ? window.location.origin : "")
		).replace(/\/$/, "");

		let nextPath = "/";
		try {
			if (typeof window !== "undefined") {
				const path = window.location.pathname || "/";
				nextPath = path;
			}
		} catch {
			// ignore
		}

		const redirectTo = `${base}${nextPath}`;

		await supabase.auth.signInWithOAuth({
			provider: "google",
			options: {
				redirectTo
			}
		});
	}

	async function signOut() {
		if (!supabase) return;
		await supabase.auth.signOut();
	}

	return <AuthContext.Provider value={{ user, isHydrated, signInWithGoogle, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
	return useContext(AuthContext);
}


