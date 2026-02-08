"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { History, Menu, BookOpen, Home, Trophy } from "lucide-react";
import { Button } from "../ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "../ui/sheet";
import { CreateLobby } from "@/components/CreateLobby";
import { IntroGuide } from "@/components/IntroGuide";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { useAuth } from "@/components/AuthProvider";
import { useTheme } from "@/components/useTheme";
import { useLastLobbySnapshot } from "@/hooks/useLastLobby";

const baseTabs = [
	{ href: "/home", label: "HOME", icon: Home },
	{ href: "/lobbies", label: "LOBBIES", icon: Trophy },
	{ href: "/stats", label: "STATS", icon: History },
	{ href: "/history", label: "HISTORY", icon: History },
	{ href: "/rules", label: "RULES", icon: BookOpen },
];

export function ArenaNav() {
	const pathname = usePathname();
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
	const { user, signInWithGoogle, signOut } = useAuth();
	const { theme, toggleTheme } = useTheme();

	const lobbyMatch = pathname?.match(/^\/lobby\/([^/]+)/);
	const lobbyId = lobbyMatch?.[1] ?? null;
	const lastLobby = useLastLobbySnapshot();
	const resolvedLobbyId = lobbyId ?? lastLobby?.id ?? null;

	const tabs = baseTabs.map((tab) => {
		if (!resolvedLobbyId) return tab;
		if (tab.label === "HISTORY") return { ...tab, href: `/lobby/${resolvedLobbyId}/history` };
		if (tab.label === "STATS") return { ...tab, href: `/lobby/${resolvedLobbyId}/stats` };
		return tab;
	});

	const isActive = (href: string) => {
		if (pathname === href) return true;
		if (href === "/home" && /^\/lobby\/[^/]+$/.test(pathname ?? "")) return true;
		if (href.endsWith("/history") && /^\/lobby\/[^/]+\/history$/.test(pathname ?? "")) return true;
		if (href.endsWith("/stats") && /^\/lobby\/[^/]+\/stats$/.test(pathname ?? "")) return true;
		return false;
	};

	return (
		<nav className="ui2-scope border-b-2 border-border bg-card/50 sticky top-0 z-40 safe-area-pt">
			<div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-6 lg:gap-8">
						<Link
							href="/home"
							className="font-display text-base sm:text-xl font-bold tracking-widest text-primary hover:text-primary/80 transition-colors"
							style={{ textShadow: "0 0 20px hsl(var(--primary) / 0.3)" }}
						>
							GYM DEATHMATCH
						</Link>

						<div className="hidden lg:flex items-center gap-1">
							{tabs.map((link) => (
								<Link
									key={link.href}
									href={link.href}
									className={`font-display text-xs tracking-widest px-3 py-2 transition-colors border-b-2 ${
										isActive(link.href)
											? "text-primary border-primary"
											: "text-muted-foreground hover:text-foreground border-transparent hover:border-border"
									}`}
								>
									{link.label}
								</Link>
							))}
						</div>
					</div>

					<div className="flex items-center gap-2">
						<div className="hidden lg:flex items-center gap-2">
							<CreateLobby />
							{user && (
								<Button variant="outline" size="sm" asChild>
									<Link href="/lobbies">
										<History className="w-4 h-4" />
										<span className="hidden md:inline ml-2">MY LOBBIES</span>
									</Link>
								</Button>
							)}
							<IntroGuide />
						</div>

						<Button
							variant="outline"
							size="sm"
							onClick={user ? signOut : signInWithGoogle}
							className="hidden sm:inline-flex"
						>
							{user ? "SIGN OUT" : "SIGN IN"}
						</Button>

						{user && <ProfileAvatar />}

						<button
							aria-label="Toggle theme"
							className="w-9 h-9 flex items-center justify-center border-2 border-border text-xs hover:bg-muted transition-colors"
							onClick={toggleTheme}
							title={theme === "dark" ? "Switch to light" : "Switch to dark"}
						>
							{theme === "dark" ? "☀️" : "🌙"}
						</button>

						<Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
							<SheetTrigger asChild>
								<Button variant="ghost" size="sm" className="lg:hidden touch-target">
									<Menu className="w-5 h-5" />
								</Button>
							</SheetTrigger>
							<SheetContent side="right" className="w-72 bg-card border-l-2 border-border p-0">
								<SheetHeader className="p-6 border-b-2 border-border">
									<SheetTitle
										className="font-display text-lg tracking-widest text-primary text-left"
										style={{ textShadow: "0 0 15px hsl(var(--primary) / 0.4)" }}
									>
										GYM DEATHMATCH
									</SheetTitle>
								</SheetHeader>

								<div className="py-2">
									{tabs.map((link) => {
										const Icon = link.icon;
										const active = isActive(link.href);
										return (
											<Link
												key={link.href}
												href={link.href}
												onClick={() => setMobileMenuOpen(false)}
												className={`flex items-center gap-3 px-6 py-4 font-display text-xs tracking-widest transition-colors border-l-2 touch-target ${
													active
														? "text-primary bg-primary/10 border-primary"
														: "text-muted-foreground hover:text-foreground hover:bg-muted/30 border-transparent"
												}`}
											>
												<Icon className="w-4 h-4" />
												{link.label}
											</Link>
										);
									})}
								</div>

								<div className="p-6 border-t-2 border-border space-y-3">
									<Button variant="outline" className="w-full h-12 touch-target-lg" size="sm" asChild>
										<Link href="/lobbies" onClick={() => setMobileMenuOpen(false)}>
											<History className="w-4 h-4 mr-2" />
											MY LOBBIES
										</Link>
									</Button>
									<Button variant="arenaPrimary" className="w-full h-12 touch-target-lg" size="sm" asChild>
										<Link href="/rules" onClick={() => setMobileMenuOpen(false)}>
											<BookOpen className="w-4 h-4 mr-2" />
											RULES
										</Link>
									</Button>
									<Button
										variant="outline"
										className="w-full h-12 touch-target-lg"
										size="sm"
										onClick={user ? signOut : signInWithGoogle}
									>
										{user ? "SIGN OUT" : "SIGN IN"}
									</Button>
								</div>
							</SheetContent>
						</Sheet>
					</div>
				</div>
			</div>
		</nav>
	);
}
