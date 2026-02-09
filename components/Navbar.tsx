"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { IntroGuide } from "./IntroGuide";
import { CreateLobby } from "./CreateLobby";
import { useAuth } from "./AuthProvider";
import { ProfileAvatar } from "./ProfileAvatar";
import { useLastLobbySnapshot } from "@/hooks/useLastLobby";

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
	const lobbyMatch = pathname?.match(/^\/lobby\/([^/]+)/);
	const lobbyId = lobbyMatch?.[1] ?? null;
	const lastLobby = useLastLobbySnapshot();
	const resolvedLobbyId = lobbyId ?? lastLobby?.id ?? null;

	const tabs = baseTabs.map((tab) => {
		if (!resolvedLobbyId) return tab;
		if (tab.label === "History") return { ...tab, href: `/lobby/${resolvedLobbyId}/history` };
		if (tab.label === "Stats") return { ...tab, href: `/lobby/${resolvedLobbyId}/stats` };
		return tab;
	});
	return (
		<div className="sticky top-0 z-50 bg-background text-foreground">
			<div className="mx-auto max-w-6xl">
				<div className="flex items-center justify-between py-1.5 sm:py-2 px-2 sm:px-3 border-b border-border">
					<div className="font-display text-xl sm:text-2xl text-primary">GYM DEATHMATCH</div>
					<div className="flex items-center gap-2">
						<div className="flex items-center gap-2">
							{user ? (
								<button type="button" onClick={signOut} className="arena-badge px-3 py-1 text-[10px] sm:text-xs">
									Sign out
								</button>
							) : (
								<button type="button" onClick={signInWithGoogle} className="arena-badge px-3 py-1 text-[10px] sm:text-xs">
									Sign in
								</button>
							)}
						</div>
						{user && <ProfileAvatar />}
					</div>
				</div>
				{/* Desktop Navigation - Hidden on mobile, shown on sm and up */}
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
								<motion.span className="font-display text-[11px] sm:text-sm tracking-wide relative block px-0.5 text-foreground"
									whileHover={{ y: -1, filter: "brightness(1.1)" }}
								>
									<span className="px-1">{t.label.toUpperCase()}</span>
									{active && (
										<motion.span
											layoutId={`nav-underline`}
											className="absolute left-0 -bottom-1 h-1 rounded-sm bg-primary"
											style={{ width: "100%" }}
											transition={{ type: "spring", stiffness: 500, damping: 35 }}
										/>
									)}
								</motion.span>
							</Link>
						);
					})}
					<div className="ml-auto flex items-center gap-2">
						<CreateLobby />
						{user && <Link href="/lobbies" className="arena-badge px-3 py-2 text-xs min-h-[44px] flex items-center">My Lobbies</Link>}
						<IntroGuide />
					</div>
				</nav>
			</div>
		</div>
	);
}
