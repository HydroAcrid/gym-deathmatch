 "use client";
import { useEffect, useState } from "react";

type Player = {
	name: string;
	totalWorkouts: number;
	currentStreak: number;
	averageWorkoutsPerWeek: number;
};

export default function StatsPage() {
	const [seasonNumber, setSeasonNumber] = useState<number>(1);
	const [totalWorkouts, setTotalWorkouts] = useState<number>(0);
	const [combinedStreaks, setCombinedStreaks] = useState<number>(0);
	const [mostConsistent, setMostConsistent] = useState<Player | null>(null);

	useEffect(() => {
		let ignore = false;
		async function load() {
			try {
				const res = await fetch("/api/lobby/kevin-nelly/live", { cache: "no-store" });
				const data = await res.json();
				if (ignore || !data?.lobby) return;
				const players: Player[] = data.lobby.players ?? [];
				setSeasonNumber(data.lobby.seasonNumber ?? 1);
				setTotalWorkouts(players.reduce((s, p) => s + (p.totalWorkouts ?? 0), 0));
				setCombinedStreaks(players.reduce((s, p) => s + (p.currentStreak ?? 0), 0));
				setMostConsistent(
					players.reduce((a: Player | null, b: Player) => (!a || b.averageWorkoutsPerWeek > a.averageWorkoutsPerWeek ? b : a), null)
				);
			} catch {
				// ignore for now
			}
		}
		load();
		return () => {
			ignore = true;
		};
	}, []);

	return (
		<div className="mx-auto max-w-6xl">
			<div className="paper-card paper-grain ink-edge p-5 mb-6 border-b-4" style={{ borderColor: "#E1542A" }}>
				<div className="poster-headline text-lg mb-1">LOBBY STATS</div>
				<div className="text-deepBrown/70 text-xs">SEASON {seasonNumber}</div>
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
					<div className="poster-headline text-sm">{mostConsistent?.name?.toUpperCase() ?? "-"}</div>
					<div className="text-deepBrown/80 text-2xl font-semibold">
						{mostConsistent ? `${mostConsistent.averageWorkoutsPerWeek.toFixed(1)} AVG/WK` : "--"}
					</div>
				</div>
			</div>
		</div>
	);
}


