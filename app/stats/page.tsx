import { getDefaultLobby } from "@/lib/lobbies";

export default function StatsPage() {
	const lobby = getDefaultLobby();
	const totalWorkouts = lobby.players.reduce((sum, p) => sum + p.totalWorkouts, 0);
	const combinedStreaks = lobby.players.reduce((sum, p) => sum + p.currentStreak, 0);
	const mostConsistent = lobby.players.reduce((a, b) =>
		a.averageWorkoutsPerWeek > b.averageWorkoutsPerWeek ? a : b
	);

	return (
		<div className="mx-auto max-w-6xl">
			<div className="paper-card paper-grain ink-edge p-5 mb-6 border-b-4" style={{ borderColor: "#E1542A" }}>
				<div className="poster-headline text-lg mb-1">LOBBY STATS</div>
				<div className="text-deepBrown/70 text-xs">SEASON {lobby.seasonNumber}</div>
			</div>
			<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
				<div className="paper-card paper-grain ink-edge p-4">
					<div className="text-xs text-deepBrown/70">TOTAL WORKOUTS</div>
					<div className="poster-headline text-4xl">{totalWorkouts}</div>
				</div>
				<div className="paper-card paper-grain ink-edge p-4">
					<div className="text-xs text-deepBrown/70">COMBINED STREAK DAYS</div>
					<div className="poster-headline text-4xl">{combinedStreaks}</div>
				</div>
				<div className="paper-card paper-grain ink-edge p-4">
					<div className="text-xs text-deepBrown/70">MOST CONSISTENT</div>
					<div className="poster-headline text-sm">{mostConsistent.name.toUpperCase()}</div>
					<div className="text-deepBrown/80 text-2xl font-semibold">{mostConsistent.averageWorkoutsPerWeek.toFixed(1)} AVG/WK</div>
				</div>
			</div>
		</div>
	);
}


