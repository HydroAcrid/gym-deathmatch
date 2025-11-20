"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Home, Trophy, Plus, BarChart2, Menu, History, BookOpen, HelpCircle, X } from "lucide-react";
import { CreateLobby } from "./CreateLobby";
import { IntroGuide } from "./IntroGuide";
import { useState, useEffect } from "react";

export function MobileNav() {
	const pathname = usePathname();
	const [lastLobbyId, setLastLobbyId] = useState<string | null>(null);
	const [menuOpen, setMenuOpen] = useState(false);

	useEffect(() => {
		if (typeof window === "undefined") return;
		setLastLobbyId(localStorage.getItem("gymdm_lastLobbyId"));
	}, [pathname]);

	// Determine correct paths based on lobby context
	const lobbyMatch = pathname?.match(/^\/lobby\/([^\/]+)/);
	const lobbyId = lobbyMatch ? lobbyMatch[1] : lastLobbyId;

	const statsHref = lobbyId ? `/lobby/${lobbyId}/stats` : "/stats";
	const historyHref = lobbyId ? `/lobby/${lobbyId}/history` : "/history";

	const isActive = (path: string) => pathname === path;
	
	// Special check for Home active state
	const isHomeActive = isActive("/home") || /^\/lobby\/[^/]+$/.test(pathname ?? "");
	const isStatsActive = isActive(statsHref);
	const isHistoryActive = isActive(historyHref);
	const isLobbiesActive = isActive("/lobbies");
	const isRulesActive = isActive("/rules");

	const navItems = [
		{ label: "Home", href: "/home", icon: Home, active: isHomeActive },
		{ label: "Lobbies", href: "/lobbies", icon: Trophy, active: isLobbiesActive },
		{ label: "Create", isCreate: true, icon: Plus },
		{ label: "History", href: historyHref, icon: History, active: isHistoryActive },
		{ label: "More", isMenu: true, icon: Menu, active: menuOpen }
	];

	return (
		<>
			{/* Spacer to prevent content from being hidden behind navbar */}
			<div className="h-[calc(60px+env(safe-area-inset-bottom))] sm:hidden" />

			{/* Bottom Navigation Bar */}
			<div className="fixed bottom-0 left-0 right-0 bg-main border-t border-deepBrown/20 z-40 sm:hidden pb-[env(safe-area-inset-bottom)] overflow-visible">
				<div className="flex items-center justify-around h-[60px]">
					{navItems.map((item, index) => {
						if (item.isCreate) {
							return (
								<CreateLobby key="create">
									<span className="flex flex-col items-center justify-center w-16 h-full cursor-pointer relative z-50">
										<span className="w-14 h-14 bg-[var(--accent-primary)] rounded-full flex items-center justify-center shadow-lg text-white mb-1 mt-[-24px] border-2 border-[var(--accent-primary)]">
											<Plus size={24} strokeWidth={3} />
										</span>
										<span className="text-[9px] uppercase font-bold tracking-wide mt-1">Create</span>
									</span>
								</CreateLobby>
							);
						}

						if (item.isMenu) {
							return (
								<button
									key="menu"
									onClick={() => setMenuOpen(!menuOpen)}
									className={`flex flex-col items-center justify-center w-16 h-full border-t-2 ${menuOpen ? "text-[var(--accent-primary)] border-[var(--accent-primary)]" : "text-muted border-transparent"}`}
								>
									<Menu size={20} />
									<span className="text-[9px] uppercase font-bold tracking-wide mt-1">More</span>
								</button>
							);
						}

						const Icon = item.icon;
						return (
							<Link
								key={item.label}
								href={item.href!}
								className={`flex flex-col items-center justify-center w-16 h-full border-t-2 ${item.active ? "text-[var(--accent-primary)] border-[var(--accent-primary)]" : "text-muted border-transparent"}`}
							>
								<Icon size={20} />
								<span className="text-[9px] uppercase font-bold tracking-wide mt-1">{item.label}</span>
							</Link>
						);
					})}
				</div>
			</div>

			{/* More Menu Drawer */}
			<AnimatePresence>
				{menuOpen && (
					<>
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							onClick={() => setMenuOpen(false)}
							className="fixed inset-0 bg-black/50 z-40 sm:hidden"
						/>
						<motion.div
							initial={{ y: "100%" }}
							animate={{ y: 0 }}
							exit={{ y: "100%" }}
							transition={{ type: "spring", damping: 25, stiffness: 300 }}
							className="fixed bottom-0 left-0 right-0 bg-main rounded-t-2xl z-50 sm:hidden pb-[calc(60px+env(safe-area-inset-bottom))]"
						>
							<div className="p-4">
								<div className="flex items-center justify-between mb-4">
									<h3 className="poster-headline text-lg">More</h3>
									<button onClick={() => setMenuOpen(false)} className="p-2 bg-deepBrown/5 rounded-full">
										<X size={20} />
									</button>
								</div>
								<div className="grid grid-cols-3 gap-4">
									<Link
										href={statsHref}
										onClick={() => setMenuOpen(false)}
										className={`flex flex-col items-center justify-center p-4 rounded-xl bg-elevated border border-deepBrown/10 ${isStatsActive ? "ring-2 ring-accent-primary" : ""}`}
									>
										<BarChart2 size={24} className="mb-2 text-accent-primary" />
										<span className="text-xs font-medium">Stats</span>
									</Link>
									<Link
										href="/rules"
										onClick={() => setMenuOpen(false)}
										className={`flex flex-col items-center justify-center p-4 rounded-xl bg-elevated border border-deepBrown/10 ${isRulesActive ? "ring-2 ring-accent-primary" : ""}`}
									>
										<BookOpen size={24} className="mb-2 text-accent-primary" />
										<span className="text-xs font-medium">Rules</span>
									</Link>
									<IntroGuide>
										<span className="flex flex-col items-center justify-center p-4 rounded-xl bg-elevated border border-deepBrown/10 h-full w-full">
											<HelpCircle size={24} className="mb-2 text-accent-primary" />
											<span className="text-xs font-medium">Guide</span>
										</span>
									</IntroGuide>
								</div>
							</div>
						</motion.div>
					</>
				)}
			</AnimatePresence>
		</>
	);
}

