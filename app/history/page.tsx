import Link from "next/link";

export default function HistoryLandingPage() {
	return (
		<div className="min-h-screen">
			<div className="container mx-auto max-w-3xl py-12 px-4 text-center">
				<div className="scoreboard-panel p-6 sm:p-8 space-y-3">
					<h1 className="font-display text-2xl tracking-widest text-primary">CHOOSE A LOBBY</h1>
					<p className="text-sm text-muted-foreground">
						History is scoped per lobby. Open a lobby and tap History to review workouts, votes, and events.
					</p>
					<div>
						<Link href="/lobbies" className="arena-badge arena-badge-primary px-4 py-2">
							GO TO LOBBIES
						</Link>
					</div>
				</div>
			</div>
		</div>
	);
}
