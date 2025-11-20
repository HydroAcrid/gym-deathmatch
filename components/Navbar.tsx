"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { IntroGuide } from "./IntroGuide";
import { JoinLobby } from "./JoinLobby";
import { CreateLobby } from "./CreateLobby";
import { useAuth } from "./AuthProvider";
import { ProfileAvatar } from "./ProfileAvatar";
import { useEffect, useState } from "react";
import { useTheme } from "./useTheme";

const baseTabs = [
	{ href: "/home", label: "Home" },
	{ href: "/lobbies", label: "Lobbies" },
	{ href: "/stats", label: "Stats" },
	{ href: "/history", label: "History" },
	{ href: "/rules", label: "Rules" }
];

export function Navbar() {
	const pathname = usePathname();
	const { user, signInWithGoogle, signOut } = useAuth();
	const [lastLobbyId, setLastLobbyId] = useState<string | null>(null);
	const { theme, toggleTheme } = useTheme();
	useEffect(() => {
		if (typeof window === "undefined") return;
		setLastLobbyId(localStorage.getItem("gymdm_lastLobbyId"));
	}, [pathname]);
	// If on a lobby route, make History contextual to that lobby; otherwise fall back to last lobby
	let tabs = baseTabs;
	const lobbyMatch = pathname?.match(/^\/lobby\/([^\/]+)/);
	if (lobbyMatch) {
		const lobbyId = lobbyMatch[1];
		tabs = baseTabs.map(t => {
			if (t.label === "History") return { ...t, href: `/lobby/${lobbyId}/history` };
			if (t.label === "Stats") return { ...t, href: `/lobby/${lobbyId}/stats` };
			return t;
		});
	} else if (lastLobbyId) {
		tabs = baseTabs.map(t => {
			if (t.label === "History") return { ...t, href: `/lobby/${lastLobbyId}/history` };
			if (t.label === "Stats") return { ...t, href: `/lobby/${lastLobbyId}/stats` };
			return t;
		});
	}
	return (
		<div className="sticky top-0 z-50 bg-main">
			<div className="mx-auto max-w-6xl">
				<div className="flex items-center justify-between py-1.5 sm:py-2 px-2 sm:px-3 border-b-4" style={{ borderColor: "var(--accent-primary)" }}>
					<div className="poster-headline text-xl sm:text-2xl text-main">GYM DEATHMATCH</div>
					<div className="flex items-center gap-2">
						<div className="flex items-center gap-2">
							{user ? (
								<button onClick={signOut} className="px-3 py-1 rounded-full border border-deepBrown/30 text-[10px] sm:text-xs font-medium hover:bg-deepBrown/5 transition-colors">
									Sign out
								</button>
							) : (
								<button onClick={signInWithGoogle} className="px-3 py-1 rounded-full border border-deepBrown/30 text-[10px] sm:text-xs font-medium hover:bg-deepBrown/5 transition-colors">
									Sign in
								</button>
							)}
						</div>
						{user && <ProfileAvatar />}
						{/* Theme toggle */}
						<button
							aria-label="Toggle theme"
							className="w-7 h-7 flex items-center justify-center rounded-md border border-[var(--accent-primary)] text-xs hover:bg-[var(--accent-primary)] hover:text-white transition-colors"
							onClick={toggleTheme}
							title={theme === "dark" ? "Switch to light" : "Switch to dark"}
						>
							{theme === "dark" ? "☀️" : "🌙"}
						</button>
					</div>
				</div>
				<nav className="hidden sm:flex items-center gap-3 sm:gap-4 py-1.5 sm:py-2 px-2 sm:px-3 overflow-x-auto whitespace-nowrap">
					{tabs.map((t) => {
						let active = pathname === t.href; // exact match
						// Treat lobby root pages as "Home" active
						if (!active && t.label === "Home" && /^\/lobby\/[^/]+$/.test(pathname ?? "")) {
							active = true;
						}
						// Treat per-lobby history exact route as History active
						if (!active && t.label === "History" && /^\/lobby\/[^/]+\/history$/.test(pathname ?? "")) {
							active = true;
						}
						return (
							<Link key={t.href} href={t.href} className="relative min-h-[44px] flex items-center">
								<motion.span className="poster-headline text-[11px] sm:text-sm tracking-wide relative block px-0.5"
									whileHover={{ y: -1, filter: "brightness(1.1)" }}
								>
									<span className="px-1">{t.label.toUpperCase()}</span>
									{active && (
										<motion.span
											layoutId={`nav-underline`}
											className="absolute left-0 -bottom-1 h-1 rounded-sm"
											style={{ backgroundColor: "var(--accent-primary)", width: "100%" }}
											transition={{ type: "spring", stiffness: 500, damping: 35 }}
										/>
									)}
								</motion.span>
							</Link>
						);
					})}
					<div className="ml-auto flex items-center gap-2">
						<CreateLobby />
						{user && <Link href="/lobbies" className="btn-secondary px-3 py-2 rounded-md text-xs min-h-[44px] flex items-center">My Lobbies</Link>}
						<IntroGuide />
					</div>
				</nav>
			</div>
		</div>
	);
}


