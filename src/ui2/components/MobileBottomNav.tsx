"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Home, Trophy, Plus, History, Menu, BarChart3, BookOpen, HelpCircle, LogIn, LogOut } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "../ui/sheet";
import { ManualActivityModal } from "@/components/ManualActivityModal";
import { useToast } from "@/components/ToastProvider";
import { IntroGuide } from "@/components/IntroGuide";
import { CreateLobby } from "@/components/CreateLobby";
import { useAuth } from "@/components/AuthProvider";
import { useLastLobbySnapshot } from "@/hooks/useLastLobby";

export function MobileBottomNav() {
	const pathname = usePathname();
	const toast = useToast();
	const { user, signInWithGoogle, signOut } = useAuth();
	const [mounted, setMounted] = useState(false);
	const lobbyMatch = pathname?.match(/^\/lobby\/([^/]+)/);
	const lobbyId = lobbyMatch?.[1] ?? null;
	const lastLobby = useLastLobbySnapshot();
	const resolvedLobbyId = lobbyId ?? lastLobby?.id ?? null;
	const [moreOpen, setMoreOpen] = useState(false);
	const [logModalOpen, setLogModalOpen] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

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
		{ label: "More", isMenu: true, icon: Menu, active: moreOpen },
	];

	function handleLogClick() {
		if (!resolvedLobbyId) {
			toast.push("Join or enter a lobby to log activity.");
			return;
		}
		setLogModalOpen(true);
	}

	async function handleAuthClick() {
		try {
			if (user) {
				await signOut();
				setMoreOpen(false);
				return;
			}
			await signInWithGoogle();
			setMoreOpen(false);
		} catch (err) {
			console.error("[MobileBottomNav] auth click failed:", err);
		}
	}

	if (!mounted) {
		return (
			<>
				<div className="mobile-bottom-nav lg:hidden h-[calc(76px+env(safe-area-inset-bottom))]" />
				<nav className="mobile-bottom-nav lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-card border-t-2 border-border safe-area-inset-bottom">
					<div className="h-16 safe-area-pb" />
				</nav>
			</>
		);
	}

	return (
		<>
			<div className="mobile-bottom-nav lg:hidden h-[calc(76px+env(safe-area-inset-bottom))]" />
			<nav className="mobile-bottom-nav lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-card border-t-2 border-border safe-area-inset-bottom">
				<div className="flex items-stretch justify-around h-16 safe-area-pb">
					{navItems.map((item) => {
						if (item.isLog) {
							return (
								<button
									key="log"
									onClick={handleLogClick}
									className="flex flex-col items-center justify-center flex-1 -mt-4"
								>
									<div
										className="w-14 h-14 bg-primary flex items-center justify-center border-2 border-primary/60 touch-target-xl"
										style={{ boxShadow: "0 0 20px hsl(var(--primary) / 0.4), 0 4px 0 hsl(0 0% 0% / 0.3)" }}
									>
										<Plus className="w-6 h-6 text-primary-foreground" />
									</div>
								</button>
							);
						}

						if (item.isMenu) {
							return (
								<Sheet key="more" open={moreOpen} onOpenChange={setMoreOpen}>
									<SheetTrigger asChild>
										<button
											className={`flex flex-col items-center justify-center flex-1 gap-1 transition-colors border-t-2 -mt-0.5 touch-target ${
												item.active
													? "text-primary border-primary"
													: "text-muted-foreground border-transparent"
											}`}
										>
											<Menu className="w-5 h-5" />
											<span className="text-[10px] font-display tracking-widest font-bold">MORE</span>
										</button>
									</SheetTrigger>
									<SheetContent side="bottom" className="bg-card border-t-2 border-border p-0 max-h-[70vh] safe-area-pb">
										<SheetHeader className="p-4 border-b-2 border-border">
											<SheetTitle className="font-display text-base tracking-widest text-primary text-left font-bold">
												MORE OPTIONS
											</SheetTitle>
										</SheetHeader>

										<div className="py-2">
											<CreateLobby>
												<button className="flex items-center gap-4 px-6 py-4 transition-colors active:bg-muted/30 border-l-2 touch-target text-foreground border-transparent w-full text-left">
													<Plus className="w-5 h-5" />
													<span className="font-display text-xs tracking-widest font-bold">CREATE LOBBY</span>
												</button>
											</CreateLobby>
											<Link
												href={statsHref}
												onClick={() => setMoreOpen(false)}
												className={`flex items-center gap-4 px-6 py-4 transition-colors active:bg-muted/30 border-l-2 touch-target ${
													isActive(statsHref)
														? "text-primary bg-primary/10 border-primary"
														: "text-foreground border-transparent"
												}`}
											>
												<BarChart3 className="w-5 h-5" />
												<span className="font-display text-xs tracking-widest font-bold">STATS</span>
											</Link>
											<Link
												href="/rules"
												onClick={() => setMoreOpen(false)}
												className={`flex items-center gap-4 px-6 py-4 transition-colors active:bg-muted/30 border-l-2 touch-target ${
													isRulesActive
														? "text-primary bg-primary/10 border-primary"
														: "text-foreground border-transparent"
												}`}
											>
												<BookOpen className="w-5 h-5" />
												<span className="font-display text-xs tracking-widest font-bold">RULES</span>
											</Link>
											<IntroGuide>
												<button className="flex items-center gap-4 px-6 py-4 transition-colors active:bg-muted/30 border-l-2 touch-target text-foreground border-transparent w-full text-left">
													<HelpCircle className="w-5 h-5" />
													<span className="font-display text-xs tracking-widest font-bold">GUIDE</span>
												</button>
											</IntroGuide>
											<button
												type="button"
												onClick={handleAuthClick}
												className="flex items-center gap-4 px-6 py-4 transition-colors active:bg-muted/30 border-l-2 touch-target text-foreground border-transparent w-full text-left"
											>
												{user ? <LogOut className="w-5 h-5" /> : <LogIn className="w-5 h-5" />}
												<span className="font-display text-xs tracking-widest font-bold">{user ? "SIGN OUT" : "SIGN IN"}</span>
											</button>
										</div>
									</SheetContent>
								</Sheet>
							);
						}

						const Icon = item.icon!;
						return (
							<Link
								key={item.label}
								href={item.href!}
								className={`flex flex-col items-center justify-center flex-1 gap-1 transition-colors border-t-2 -mt-0.5 touch-target ${
									item.active ? "text-primary border-primary" : "text-muted-foreground border-transparent"
								}`}
							>
								<Icon className="w-5 h-5" />
								<span className="text-[10px] font-display tracking-widest font-bold">{item.label}</span>
							</Link>
						);
					})}
				</div>
			</nav>

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
