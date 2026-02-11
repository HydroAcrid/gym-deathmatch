"use client";
import { useEffect, useMemo, useState } from "react";
import { summarizeTypesThisWeek } from "@/lib/messages";
import { authFetch } from "@/lib/clientAuth";

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
				const res = await authFetch(`/api/lobby/${encodeURIComponent(lobbyId)}/live`, { cache: "no-store" });
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
		<div className="min-h-screen">
			<div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
				<div className="scoreboard-panel p-5 sm:p-6 text-center relative overflow-hidden">
					<div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />
					<div className="relative z-10 space-y-1">
						<div className="font-display text-xl tracking-widest text-primary">LOBBY STATS</div>
						<div className="text-xs text-muted-foreground">SEASON {seasonNumber}</div>
					</div>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
					<div className="scoreboard-panel p-4 text-center">
						<div className="text-xs text-muted-foreground">TOTAL WORKOUTS</div>
						<div className="font-display text-4xl text-primary">{totals.totalWorkouts}</div>
					</div>
					<div className="scoreboard-panel p-4 text-center">
						<div className="text-xs text-muted-foreground">COMBINED STREAK DAYS</div>
						<div className="font-display text-4xl text-primary">{totals.combinedStreaks}</div>
					</div>
					<div className="scoreboard-panel p-4 text-center">
						<div className="text-xs text-muted-foreground">MOST CONSISTENT</div>
						<div className="font-display text-sm text-foreground">
							{totals.mostConsistent?.name?.toUpperCase() ?? "-"}
						</div>
						<div className="text-2xl font-display text-primary">
							{totals.mostConsistent ? `${totals.mostConsistent.averageWorkoutsPerWeek.toFixed(1)} AVG/WK` : "--"}
						</div>
					</div>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					{players.map((p) => {
						const s = perPlayerStats(p);
						return (
							<div key={p.name} className="scoreboard-panel p-4 space-y-3">
								<div className="font-display text-base tracking-widest text-primary">{p.name.toUpperCase()}</div>
								<div className="grid grid-cols-2 gap-3 text-sm">
									<div>
										<div className="text-xs text-muted-foreground">TOTAL TIME</div>
										<div className="font-display">{s.totalMinutes} min</div>
									</div>
									<div>
										<div className="text-xs text-muted-foreground">TOTAL DISTANCE</div>
										<div className="font-display">{s.totalDistance.toFixed(1)} km</div>
									</div>
									<div>
										<div className="text-xs text-muted-foreground">AVG DURATION</div>
										<div className="font-display">{s.avgDuration} min</div>
									</div>
									<div>
										<div className="text-xs text-muted-foreground">MOST FREQUENT</div>
										<div className="font-display">{titleCase(s.mostFrequentType)}</div>
									</div>
									<div>
										<div className="text-xs text-muted-foreground">LONGEST WORKOUT</div>
										<div className="font-display">{s.longest ? `${s.longest.durationMinutes} min` : "-"}</div>
									</div>
									<div>
										<div className="text-xs text-muted-foreground">EARLIEST / LATEST</div>
										<div className="font-display">
											{(s.earliest ?? "-")}h / {(s.latest ?? "-")}h
										</div>
									</div>
								</div>
								{(p as any).activityCounts ? (
									<div className="text-xs text-muted-foreground">
										<div className="text-[11px] mb-1">ACTIVITY SOURCES</div>
										<div className="flex flex-wrap gap-3">
											<span>All: {(p as any).activityCounts.total}</span>
											<span>📡 Strava: {(p as any).activityCounts.strava}</span>
											<span>✍️ Manual: {(p as any).activityCounts.manual}</span>
										</div>
									</div>
								) : null}
								<div className="text-xs text-muted-foreground">{p.name} {s.variety}</div>
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}

function toHour(iso: string) { return new Date(iso).getHours(); }
function titleCase(s: string) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

