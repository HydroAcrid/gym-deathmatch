"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/src/ui2/ui/button";
import { authFetch } from "@/lib/clientAuth";

type Contribution = { week_start: string; amount: number; player_count: number };
type EventRow = { id: string; type: string; payload: any; created_at: string; target_player_id?: string | null };
type PlayerLite = { id: string; name: string; avatar_url?: string | null; user_id?: string | null };
type UserPun = { id: string; user_id: string; lobby_id: string; week: number; text: string; resolved: boolean };

export default function SeasonSummaryPage({ params }: { params: Promise<{ lobbyId: string }> }) {
	const [lobbyId, setLobbyId] = useState<string>("");
	const [players, setPlayers] = useState<PlayerLite[]>([]);
	const [contribs, setContribs] = useState<Contribution[]>([]);
	const [events, setEvents] = useState<EventRow[]>([]);
	const [initialPot, setInitialPot] = useState<number>(0);
	const [seasonNumber, setSeasonNumber] = useState<number>(1);
	const [userPuns, setUserPuns] = useState<UserPun[]>([]);

	useEffect(() => {
		(async () => {
			const { lobbyId } = await params;
			setLobbyId(lobbyId);
			const supabase = (await import("@/lib/supabaseBrowser")).getBrowserSupabase();
			if (!supabase) return;
			const [{ data: p }, { data: c }, { data: e }, { data: l }, { data: up }] = await Promise.all([
				supabase.from("player").select("id,name,avatar_url,user_id").eq("lobby_id", lobbyId),
				supabase.from("weekly_pot_contributions").select("week_start,amount,player_count").eq("lobby_id", lobbyId).order("week_start"),
				supabase.from("history_events").select("*").eq("lobby_id", lobbyId).order("created_at", { ascending: false }).limit(100),
				supabase.from("lobby").select("initial_pot,season_number").eq("id", lobbyId).maybeSingle(),
				supabase.from("user_punishments").select("*").eq("lobby_id", lobbyId).order("created_at")
			]);
			setPlayers((p ?? []) as any);
			setContribs((c ?? []) as any);
			setEvents((e ?? []) as any);
			setInitialPot((l as any)?.initial_pot ?? 0);
			setSeasonNumber((l as any)?.season_number ?? 1);
			setUserPuns((up ?? []) as any);
		})();
	}, [params]);

	const totalContribs = contribs.reduce((s, x) => s + (x.amount || 0), 0);
	const finalPot = (initialPot || 0) + totalContribs;
	const ko = events.find(ev => ev.type === "SEASON_KO");
	const loserName = ko ? (players.find(p => p.id === (ko.payload?.loserPlayerId || ""))?.name || "Player") : "";

	return (
		<div className="min-h-screen">
			<div className="container mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
				<div className="scoreboard-panel p-5 text-center relative overflow-hidden">
					<div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />
					<div className="relative z-10 space-y-1">
						<div className="font-display text-lg tracking-widest text-primary">SEASON {seasonNumber} SUMMARY</div>
						<div className="text-sm text-muted-foreground">Lobby: {lobbyId}</div>
					</div>
				</div>

				<div className="grid md:grid-cols-3 gap-4">
					<div className="scoreboard-panel p-5 text-center">
						<div className="text-xs text-muted-foreground">FINAL POT</div>
						<div className="font-display text-3xl text-arena-gold">${finalPot}</div>
						<div className="text-xs text-muted-foreground mt-1">Initial: ${initialPot} · Contributions: ${totalContribs}</div>
					</div>
					<div className="scoreboard-panel p-5 md:col-span-2">
						<div className="font-display text-base tracking-widest text-primary mb-2">WEEKLY CONTRIBUTIONS</div>
						<div className="space-y-2 text-sm">
							{contribs.map(c => (
								<div key={c.week_start} className="flex justify-between bg-muted/30 border border-border px-3 py-2">
									<div>{new Date(c.week_start).toLocaleDateString()}</div>
									<div>${c.amount} · {c.player_count} players</div>
								</div>
							))}
							{contribs.length === 0 && <div className="text-muted-foreground text-sm">No contributions logged yet.</div>}
						</div>
					</div>
				</div>

				<div className="scoreboard-panel p-5">
					<div className="font-display text-base tracking-widest text-primary mb-2">KO</div>
					{ko ? (
						<div className="flex items-center gap-3">
							<div className="h-12 w-12 overflow-hidden bg-muted border border-border flex items-center justify-center">
								{players.find(p => p.id === ko.target_player_id)?.avatar_url
									? <img src={players.find(p => p.id === ko.target_player_id)?.avatar_url as string} alt="" className="h-full w-full object-cover" />
									: <div className="h-full w-full flex items-center justify-center text-2xl">💀</div>}
							</div>
							<div className="text-sm">
								<span className="font-display text-primary">{loserName}</span> was KO’d · Pot at KO: ${ko.payload?.currentPot ?? finalPot}
							</div>
							<div className="text-xs text-muted-foreground ml-auto">{new Date(ko.created_at).toLocaleString()}</div>
						</div>
					) : (
						<div className="text-muted-foreground text-sm">No KO recorded yet.</div>
					)}
				</div>

				<div className="scoreboard-panel p-5">
					<div className="font-display text-base tracking-widest text-primary mb-2">CUMULATIVE PUNISHMENTS</div>
					{userPuns.length ? (
						<div className="space-y-2">
							{players.map(pl => {
								const list = userPuns.filter(u => u.user_id === (pl.user_id || "")) || [];
								if (!list.length) return null;
								const unresolved = list.filter(u => !u.resolved);
								return (
									<div key={pl.id}>
										<div className="font-display text-foreground mb-1">{pl.name}</div>
										<ul className="list-disc pl-5 text-sm text-muted-foreground">
											{list.map(u => <li key={u.id}>Week {u.week}: “{u.text}” {u.resolved ? "✅" : "⚠️"}</li>)}
										</ul>
										{unresolved.length > 0 && (
											<div className="mt-2">
												<Button
													variant="outline"
													size="sm"
														onClick={async () => {
															await authFetch(`/api/lobby/${encodeURIComponent(lobbyId)}/punishments/resolve-all`, {
																method: "POST",
																headers: { "Content-Type": "application/json" },
																body: JSON.stringify({ userId: pl.user_id })
														});
														window.location.reload();
													}}
												>
													Resolve all ({unresolved.length})
												</Button>
											</div>
										)}
									</div>
								);
							})}
						</div>
					) : (
						<div className="text-muted-foreground text-sm">No punishments recorded.</div>
					)}
				</div>

				<div>
					<Link href={`/lobby/${encodeURIComponent(lobbyId)}`}>
						<Button variant="arenaPrimary" size="sm">Back to Lobby</Button>
					</Link>
				</div>
			</div>
		</div>
	);
}

