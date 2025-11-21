"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Home, Trophy, Plus, History, Menu, BarChart2, BookOpen, HelpCircle, X } from "lucide-react";
import { ManualActivityModal } from "./ManualActivityModal";
import { useToast } from "./ToastProvider";
import { IntroGuide } from "./IntroGuide";
import { CreateLobby } from "./CreateLobby";
import { useLastLobbySnapshot } from "@/hooks/useLastLobby";

export function MobileNav() {
	const pathname = usePathname();
	const toast = useToast();
	const lobbyMatch = pathname?.match(/^\/lobby\/([^/]+)/);
	const lobbyId = lobbyMatch?.[1] ?? null;
	const lastLobby = useLastLobbySnapshot();
	const resolvedLobbyId = lobbyId ?? lastLobby?.id ?? null;
	const [menuOpen, setMenuOpen] = useState(false);
	const [logModalOpen, setLogModalOpen] = useState(false);

	const statsHref = resolvedLobbyId ? `/lobby/${resolvedLobbyId}/stats` : "/stats";
	const historyHref = resolvedLobbyId ? `/lobby/${resolvedLobbyId}/history` : "/history";

	const isActive = (href: string) => pathname === href;
	const isHomeActive = isActive("/home") || /^\/lobby\/[^/]+$/.test(pathname ?? "");
	const isLobbiesActive = isActive("/lobbies");
	const isHistoryActive = isActive(historyHref);
	const isRulesActive = pathname?.startsWith("/rules");

	const navItems = [
		{ label: "Home", href: "/home", icon: Home, active: isHomeActive },
		{ label: "Lobbies", href: "/lobbies", icon: Trophy, active: isLobbiesActive },
		{ label: "Log", isLog: true },
		{ label: "History", href: historyHref, icon: History, active: isHistoryActive },
		{ label: "More", isMenu: true, icon: Menu, active: menuOpen }
	];

	function handleLogClick() {
		if (!resolvedLobbyId) {
			toast.push("Join or enter a lobby to log activity.");
			return;
		}
		setLogModalOpen(true);
	}

	return (
		<>
			<div className="h-[calc(60px+env(safe-area-inset-bottom))] sm:hidden" />
			<div className="fixed bottom-0 left-0 right-0 bg-main border-t border-deepBrown/20 z-40 sm:hidden pb-[env(safe-area-inset-bottom)] overflow-visible">
				<div className="flex items-center justify-around h-[60px]">
					{navItems.map((item) => {
						if (item.isLog) {
							return (
								<button
									key="log"
									onClick={handleLogClick}
									className="flex flex-col items-center justify-center w-16 h-full cursor-pointer relative z-50"
								>
									<span className="w-14 h-14 bg-[var(--accent-primary)] rounded-full flex items-center justify-center shadow-lg text-white mb-1 mt-[-24px] border-2 border-[var(--accent-primary)]">
										<Plus size={24} strokeWidth={3} />
									</span>
									<span className="text-[9px] uppercase font-bold tracking-wide mt-1">Log</span>
								</button>
							);
						}

						if (item.isMenu) {
							return (
								<button
									key="menu"
									onClick={() => setMenuOpen(!menuOpen)}
									className={`flex flex-col items-center justify-center w-16 h-full border-t-2 ${menuOpen ? "text-[var(--accent-primary)] border-[var(--accent-primary)]" : "text-deepBrown/60 border-transparent"}`}
								>
									<Menu size={20} />
									<span className="text-[9px] uppercase font-bold tracking-wide mt-1">More</span>
								</button>
							);
						}

						const Icon = item.icon!;
						return (
							<Link
								key={item.label}
								href={item.href!}
								className={`flex flex-col items-center justify-center w-16 h-full border-t-2 ${item.active ? "text-[var(--accent-primary)] border-[var(--accent-primary)]" : "text-deepBrown/60 border-transparent"}`}
							>
								<Icon size={20} />
								<span className="text-[9px] uppercase font-bold tracking-wide mt-1">{item.label}</span>
							</Link>
						);
					})}
				</div>
			</div>

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
									<CreateLobby>
										<span className="flex flex-col items-center justify-center p-4 rounded-xl bg-elevated border border-deepBrown/10 h-full w-full">
											<Plus size={24} className="mb-2 text-accent-primary" />
											<span className="text-xs font-medium">Create Lobby</span>
										</span>
									</CreateLobby>
									<Link
										href={statsHref}
										onClick={() => setMenuOpen(false)}
										className={`flex flex-col items-center justify-center p-4 rounded-xl bg-elevated border border-deepBrown/10 ${isActive(statsHref) ? "ring-2 ring-accent-primary" : ""}`}
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

			{resolvedLobbyId && (
				<ManualActivityModal
					open={logModalOpen}
					onClose={() => setLogModalOpen(false)}
					lobbyId={resolvedLobbyId}
					onSaved={() => {
						setLogModalOpen(false);
						try {
							if (typeof window !== "undefined") {
								window.dispatchEvent(new CustomEvent("gymdm:refresh-live", { detail: { lobbyId: resolvedLobbyId } }));
							}
						} catch {
							// ignore
						}
					}}
				/>
			)}
		</>
	);
}
