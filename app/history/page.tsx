import Link from "next/link";

export default function HistoryLandingPage() {
	return (
		<div className="mx-auto max-w-3xl py-10 px-4 text-center">
			<div className="paper-card paper-grain ink-edge p-6 border-b-4" style={{ borderColor: "#E1542A" }}>
				<h1 className="poster-headline text-2xl mb-2">Choose a lobby</h1>
				<p className="text-sm text-deepBrown/70">
					History is scoped per lobby. Open a lobby and tap the History tab to review recent workouts, votes, and events.
				</p>
				<div className="mt-4">
					<Link href="/lobbies" className="btn-vintage px-4 py-2 rounded-md text-xs">
						Go to lobbies
					</Link>
				</div>
			</div>
		</div>
	);
}
