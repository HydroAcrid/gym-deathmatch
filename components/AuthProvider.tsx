"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { User, AuthChangeEvent, Session } from "@supabase/supabase-js";
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
			setIsHydrated(true);
			return;
		}

		let mounted = true;

		async function bootstrap() {
			try {
				const { data } = await supabase.auth.getUser();
				if (mounted) {
					setUser(data.user ?? null);
				}
			} catch (err) {
				console.error("[AuthProvider] getUser error:", err);
			} finally {
				if (mounted) setIsHydrated(true);
			}
		}

		bootstrap();

		const { data: subscription } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
			if (!mounted) return;
			setUser(session?.user ?? null);
			setIsHydrated(true);
		});

		return () => {
			mounted = false;
			subscription.subscription.unsubscribe();
		};
	}, [supabase]);

	async function signInWithGoogle() {
		if (!supabase) {
			alert("Auth not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
			return;
		}

		const base =
			process.env.NEXT_PUBLIC_BASE_URL ||
			(typeof window !== "undefined" ? window.location.origin : "https://gym-deathmatch.vercel.app");
		const path = typeof window !== "undefined" ? window.location.pathname + window.location.search + window.location.hash : "/";
		const redirectTo = `${base.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;

		await supabase.auth.signInWithOAuth({
			provider: "google",
			options: {
				redirectTo,
			},
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
