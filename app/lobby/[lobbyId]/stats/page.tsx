"use client";
import { useEffect, useMemo, useState } from "react";
import { summarizeTypesThisWeek } from "@/lib/messages";

type Player = {
	name: string;
	totalWorkouts: number;
	currentStreak: number;
	averageWorkoutsPerWeek: number;
	recentActivities?: Array<{
		type: string;
		startDate: string;
		durationMinutes: number;
		distanceKm: number;
	}>;
};

export default function LobbyStatsPage({ params }: { params: Promise<{ lobbyId: string }> }) {
	const [seasonNumber, setSeasonNumber] = useState<number>(1);
	const [players, setPlayers] = useState<Player[]>([]);
	const [lobbyId, setLobbyId] = useState<string>("");

	useEffect(() => {
		let ignore = false;
		(async () => {
			const { lobbyId } = await params;
			if (ignore) return;
			setLobbyId(lobbyId);
			try {
				const res = await fetch(`/api/lobby/${encodeURIComponent(lobbyId)}/live`, { cache: "no-store" });
				const data = await res.json();
				if (ignore || !data?.lobby) return;
				setSeasonNumber(data.lobby.seasonNumber ?? 1);
				setPlayers(data.lobby.players ?? []);
			} catch {
				// ignore
			}
		})();
		return () => { ignore = true; };
	}, [params]);

	const totals = useMemo(() => {
		const totalWorkouts = players.reduce((s, p) => s + (p.totalWorkouts ?? 0), 0);
		const combinedStreaks = players.reduce((s, p) => s + (p.currentStreak ?? 0), 0);
		const mostConsistent = players.reduce((a: Player | null, b: Player) => (!a || b.averageWorkoutsPerWeek > a.averageWorkoutsPerWeek ? b : a), null as any);
		return { totalWorkouts, combinedStreaks, mostConsistent };
	}, [players]);

	function perPlayerStats(p: Player) {
		const acts = p.recentActivities ?? [];
		const totalMinutes = acts.reduce((s, a) => s + (a.durationMinutes ?? 0), 0);
		const totalDistance = acts.reduce((s, a) => s + (a.distanceKm ?? 0), 0);
		const avgDuration = acts.length ? Math.round((totalMinutes / acts.length) * 10) / 10 : 0;
		const longest = acts.reduce((m, a) => (a.durationMinutes > (m?.durationMinutes ?? 0) ? a : m), null as any);
		const typesCount = acts.reduce((map: Record<string, number>, a) => {
			const k = (a.type || "Other").toLowerCase();
			map[k] = (map[k] ?? 0) + 1;
			return map;
		}, {});
		const mostFrequentType = Object.entries(typesCount).sort((a,b) => b[1]-a[1])[0]?.[0] ?? "-";
		const earliest = acts.reduce((m, a) => (toHour(a.startDate) < (m ?? 24) ? toHour(a.startDate) : m), null as any);
		const latest = acts.reduce((m, a) => (toHour(a.startDate) > (m ?? -1) ? toHour(a.startDate) : m), null as any);
		return { totalMinutes, totalDistance, avgDuration, longest, mostFrequentType, earliest, latest, variety: summarizeTypesThisWeek(acts as any) };
	}

	return (
		<div className="mx-auto max-w-6xl">
			<div className="paper-card paper-grain ink-edge p-5 mb-6 border-b-4" style={{ borderColor: "#E1542A" }}>
				<div className="poster-headline text-lg mb-1">LOBBY STATS</div>
				<div className="text-deepBrown/70 text-xs">SEASON {seasonNumber}</div>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
				<div className="paper-card paper-grain ink-edge p-4">
					<div className="text-xs text-deepBrown/70">TOTAL WORKOUTS</div>
					<div className="poster-headline text-4xl">{totals.totalWorkouts}</div>
				</div>
				<div className="paper-card paper-grain ink-edge p-4">
					<div className="text-xs text-deepBrown/70">COMBINED STREAK DAYS</div>
					<div className="poster-headline text-4xl">{totals.combinedStreaks}</div>
				</div>
				<div className="paper-card paper-grain ink-edge p-4">
					<div className="text-xs text-deepBrown/70">MOST CONSISTENT</div>
					<div className="poster-headline text-sm">{totals.mostConsistent?.name?.toUpperCase() ?? "-"}</div>
					<div className="text-deepBrown/80 text-2xl font-semibold">
						{totals.mostConsistent ? `${totals.mostConsistent.averageWorkoutsPerWeek.toFixed(1)} AVG/WK` : "--"}
					</div>
				</div>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				{players.map((p) => {
					const s = perPlayerStats(p);
					return (
						<div key={p.name} className="paper-card paper-grain ink-edge p-4">
							<div className="poster-headline text-base mb-1">{p.name.toUpperCase()}</div>
							<div className="grid grid-cols-2 gap-3 text-sm">
								<div>
									<div className="text-xs text-deepBrown/70">TOTAL TIME</div>
									<div className="font-semibold text-deepBrown">{s.totalMinutes} min</div>
								</div>
								<div>
									<div className="text-xs text-deepBrown/70">TOTAL DISTANCE</div>
									<div className="font-semibold text-deepBrown">{s.totalDistance.toFixed(1)} km</div>
								</div>
								<div>
									<div className="text-xs text-deepBrown/70">AVG DURATION</div>
									<div className="font-semibold text-deepBrown">{s.avgDuration} min</div>
								</div>
								<div>
									<div className="text-xs text-deepBrown/70">MOST FREQUENT</div>
									<div className="font-semibold text-deepBrown">{titleCase(s.mostFrequentType)}</div>
								</div>
								<div>
									<div className="text-xs text-deepBrown/70">LONGEST WORKOUT</div>
									<div className="font-semibold text-deepBrown">{s.longest ? `${s.longest.durationMinutes} min` : "-"}</div>
								</div>
								<div>
									<div className="text-xs text-deepBrown/70">EARLIEST / LATEST</div>
									<div className="font-semibold text-deepBrown">
										{(s.earliest ?? "-")}h / {(s.latest ?? "-")}h
									</div>
								</div>
							</div>
							<div className="mt-2 text-xs text-deepBrown/80">{p.name} {s.variety}</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}

function toHour(iso: string) { return new Date(iso).getHours(); }
function titleCase(s: string) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }


