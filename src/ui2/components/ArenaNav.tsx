"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { History, BookOpen, Home, Trophy, User } from "lucide-react";
import { Button } from "../ui/button";
import { CreateLobby } from "@/components/CreateLobby";
import { IntroGuide } from "@/components/IntroGuide";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { useAuth } from "@/components/AuthProvider";
import { useLastLobbySnapshot } from "@/hooks/useLastLobby";

const baseTabs = [
	{ href: "/home", label: "HOME", icon: Home },
	{ href: "/lobbies", label: "LOBBIES", icon: Trophy },
	{ href: "/stats", label: "STATS", icon: History },
	{ href: "/records", label: "RECORDS", icon: Trophy },
	{ href: "/profile", label: "PROFILE", icon: User },
	{ href: "/history", label: "HISTORY", icon: History },
	{ href: "/rules", label: "RULES", icon: BookOpen },
];

export function ArenaNav() {
	const pathname = usePathname();
	const router = useRouter();
	const { user, signInWithGoogle, signOut } = useAuth();

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

	async function handleAuthClick() {
		try {
			if (user) {
				await signOut();
				return;
			}
			await signInWithGoogle();
		} catch (err) {
			console.error("[ArenaNav] auth click failed:", err);
			router.push("/onboard");
		}
	}

	return (
		<nav
			className="sticky top-0 z-[90] safe-area-pt border-b-2 border-border text-foreground shadow-[0_10px_24px_-16px_hsl(0_0%_0%/0.95)]"
			style={{ backgroundColor: "hsl(var(--background))" }}
		>
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
									className={`group relative font-display text-xs tracking-widest px-3 py-2 transition-all duration-200 border-b-2 ${
										isActive(link.href)
											? "text-primary border-primary"
											: "text-muted-foreground hover:text-[hsl(var(--arena-gold))] border-transparent hover:border-[hsl(var(--arena-gold)/0.65)] hover:shadow-[inset_0_-1px_0_hsl(var(--arena-gold)/0.55),0_0_14px_hsl(var(--arena-gold)/0.22)]"
									}`}
								>
									{link.label}
									<span className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100 bg-[radial-gradient(circle_at_50%_120%,hsl(var(--arena-gold)/0.18),transparent_62%)]" />
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
							type="button"
							variant="outline"
							size="sm"
							onClick={handleAuthClick}
							className="hidden sm:inline-flex"
						>
							{user ? "SIGN OUT" : "SIGN IN"}
						</Button>

						{user && <ProfileAvatar variant="arena" />}
					</div>
				</div>
			</div>
		</nav>
	);
}
