"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { IntroGuide } from "./IntroGuide";
import { JoinLobby } from "./JoinLobby";

const tabs = [
	{ href: "/lobby/kevin-nelly", label: "Home" },
	{ href: "/stats", label: "Stats" },
	{ href: "/history", label: "History" },
	{ href: "/rules", label: "Rules" }
];

export function Navbar() {
	const pathname = usePathname();
	return (
		<div className="sticky top-0 z-50" style={{ backgroundColor: "#2B211D" }}>
			<div className="mx-auto max-w-6xl">
				<div className="flex items-baseline justify-between py-3 px-3 border-b-4" style={{ borderColor: "#E1542A" }}>
					<div className="poster-headline text-2xl text-deepBrown">GYM DEATHMATCH</div>
					<span className="font-playfair text-s text-deepBrown/70">Put your money where your mouth is!</span>
				</div>
				<nav className="flex items-center gap-4 py-2 px-3">
					{tabs.map((t) => {
						const active = pathname === t.href || (t.href.startsWith("/lobby") && pathname.startsWith("/lobby"));
						return (
							<Link key={t.href} href={t.href} className="relative">
								<motion.span className="poster-headline text-sm tracking-wide relative block"
									whileHover={{ y: -1 }}
								>
									<span className="px-1">{t.label.toUpperCase()}</span>
									<motion.span
										layoutId={`nav-underline`}
										className="absolute left-0 -bottom-1 h-1 rounded-sm"
										style={{ backgroundColor: "#E1542A" }}
										initial={false}
										animate={{
											width: active ? "100%" : "0%"
										}}
										transition={{ duration: 0.3, ease: "easeInOut" }}
									/>
									{active && (
										<motion.span
											className="absolute left-0 -bottom-1 h-1 rounded-sm"
											style={{ backgroundColor: "transparent" }}
											animate={{ opacity: [0.6, 1, 0.6] }}
											transition={{ repeat: Infinity, duration: 2 }}
										/>
									)}
								</motion.span>
							</Link>
						);
					})}
					<div className="ml-auto flex items-center gap-2">
						<JoinLobby lobbyId="kevin-nelly" />
						<IntroGuide />
					</div>
				</nav>
			</div>
		</div>
	);
}


