export default function HistoryPage() {
	const entries = [
		{ day: 1, note: "Both survived" },
		{ day: 4, note: "Kevin skipped leg day… barely." },
		{ day: 7, note: "Nelly braved the cold for a run!" }
	];
	return (
		<div className="mx-auto max-w-6xl">
			<div className="paper-card paper-grain ink-edge p-5 mb-6 border-b-4" style={{ borderColor: "#E1542A" }}>
				<div className="poster-headline text-lg">SEASON TIMELINE</div>
				<div className="text-deepBrown/70 text-xs">A log of triumphs and oofs</div>
			</div>
			<div className="space-y-4">
				{entries.map((e) => (
					<div key={e.day} className="relative paper-card paper-grain ink-edge p-4">
						<div className="text-xs text-deepBrown/70">DAY {e.day}</div>
						<div className="poster-headline text-2xl">{e.note.toUpperCase()}</div>
					</div>
				))}
			</div>
		</div>
	);
}


