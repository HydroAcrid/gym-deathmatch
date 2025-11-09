"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

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
				<nav className="flex gap-4 py-2 px-3">
					{tabs.map((t) => {
						const active = pathname === t.href || (t.href.startsWith("/lobby") && pathname.startsWith("/lobby"));
						return (
							<Link key={t.href} href={t.href} className="relative">
								<motion.span
									className="poster-headline text-sm tracking-wide"
									whileHover={{ y: -1 }}
								>
									<span className="px-1">{t.label.toUpperCase()}</span>
									{active && <span className="block h-1 mt-1 rounded-sm" style={{ backgroundColor: "#E1542A" }} />}
								</motion.span>
							</Link>
						);
					})}
				</nav>
			</div>
		</div>
	);
}


