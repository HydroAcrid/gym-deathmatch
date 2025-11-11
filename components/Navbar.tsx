"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { IntroGuide } from "./IntroGuide";
import { JoinLobby } from "./JoinLobby";
import { CreateLobby } from "./CreateLobby";
import { AuthButtons } from "./AuthButtons";
import { ProfileAvatar } from "./ProfileAvatar";
import { useAuth } from "./AuthProvider";

const tabs = [
	{ href: "/lobby/kevin-nelly", label: "Home" },
	{ href: "/lobbies", label: "Lobbies" },
	{ href: "/stats", label: "Stats" },
	{ href: "/history", label: "History" },
	{ href: "/rules", label: "Rules" }
];

export function Navbar() {
	const pathname = usePathname();
	const { user } = useAuth();
	return (
		<div className="sticky top-0 z-50" style={{ backgroundColor: "#2B211D" }}>
			<div className="mx-auto max-w-6xl">
				<div className="flex items-baseline justify-between py-3 px-3 border-b-4" style={{ borderColor: "#E1542A" }}>
					<div className="poster-headline text-2xl text-deepBrown">GYM DEATHMATCH</div>
					<div className="flex items-center gap-2">
						<AuthButtons />
						{user && <ProfileAvatar />}
					</div>
				</div>
				<nav className="flex items-center gap-4 py-2 px-3">
					{tabs.map((t) => {
						const active = pathname === t.href || (t.href.startsWith("/lobby") && pathname.startsWith("/lobby"));
						return (
							<Link key={t.href} href={t.href} className="relative">
								<motion.span className="poster-headline text-sm tracking-wide relative block"
									whileHover={{ y: -1, filter: "brightness(1.1)" }}
								>
									<span className="px-1">{t.label.toUpperCase()}</span>
									{active && (
										<motion.span
											layoutId={`nav-underline`}
											className="absolute left-0 -bottom-1 h-1 rounded-sm"
											style={{ backgroundColor: "#E1542A", width: "100%" }}
											transition={{ type: "spring", stiffness: 500, damping: 35 }}
										/>
									)}
								</motion.span>
							</Link>
						);
					})}
					<div className="ml-auto flex items-center gap-2">
						<CreateLobby />
						{user && <Link href="/lobbies" className="btn-secondary px-3 py-2 rounded-md text-xs">My Lobbies</Link>}
						<IntroGuide />
					</div>
				</nav>
			</div>
		</div>
	);
}


