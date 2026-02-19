import Link from "next/link";

export function LegalFooter() {
	return (
		<footer className="relative z-20 hidden sm:block border-t border-border/70 bg-background/80">
			<div className="container mx-auto px-3 sm:px-5 py-3">
				<nav
					aria-label="Legal links"
					className="flex items-center justify-center gap-4 sm:gap-6 text-[11px] sm:text-xs font-display tracking-wider text-muted-foreground"
				>
					<Link
						href="/privacy"
						className="px-1 py-0.5 hover:text-foreground hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
					>
						Privacy Policy
					</Link>
					<Link
						href="/terms"
						className="px-1 py-0.5 hover:text-foreground hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
					>
						Terms of Service
					</Link>
				</nav>
			</div>
		</footer>
	);
}
