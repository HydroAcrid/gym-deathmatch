export default function RulesPage() {
	const rules = [
		"Minimum 3 workouts per week.",
		"Lose a life when you miss your weekly target.",
		"When livesRemaining hits 0, you owe the pot.",
		"Ante increases by $10 each week.",
		"Have fun and don’t skip leg day."
	];
	return (
		<div className="mx-auto max-w-6xl">
			<div className="grid md:grid-cols-2 gap-4">
				<div className="paper-card paper-grain ink-edge p-5">
					<div className="poster-headline text-lg mb-2">RULES OF THE DEATHMATCH</div>
					<ul className="space-y-2">
						{rules.map((r, i) => (
							<li key={i} className="bg-cream border border-deepBrown/20 rounded-md px-3 py-2">
								{r}
							</li>
						))}
					</ul>
				</div>
				<div className="paper-card paper-grain ink-edge p-5">
					<div className="poster-headline text-lg mb-2">HOW LIVES WORK</div>
					<p className="text-deepBrown/80 mb-2">
						We check your Strava activities inside the season window. Each week you need to meet the lobby’s weekly target. Miss it and you lose a life.
					</p>
					<div className="text-sm text-deepBrown/80">
						<span className="font-semibold">Weekly Target:</span> 3 workouts (default)<br />
						<span className="font-semibold">Starting Lives:</span> 3 (default)
					</div>
				</div>
			</div>
		</div>
	);
}


