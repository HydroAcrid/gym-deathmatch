"use client";
import { useEffect, useState } from "react";

type Contribution = { week_start: string; amount: number; player_count: number };
type EventRow = { id: string; type: string; payload: any; created_at: string; target_player_id?: string | null };
type PlayerLite = { id: string; name: string; avatar_url?: string | null };

export default function SeasonSummaryPage({ params }: { params: Promise<{ lobbyId: string }> }) {
	const [lobbyId, setLobbyId] = useState<string>("");
	const [players, setPlayers] = useState<PlayerLite[]>([]);
	const [contribs, setContribs] = useState<Contribution[]>([]);
	const [events, setEvents] = useState<EventRow[]>([]);
	const [initialPot, setInitialPot] = useState<number>(0);
	const [seasonNumber, setSeasonNumber] = useState<number>(1);

	useEffect(() => {
		(async () => {
			const { lobbyId } = await params;
			setLobbyId(lobbyId);
			const supabase = (await import("@/lib/supabaseBrowser")).getBrowserSupabase();
			if (!supabase) return;
			const [{ data: p }, { data: c }, { data: e }, { data: l }] = await Promise.all([
				supabase.from("player").select("id,name,avatar_url").eq("lobby_id", lobbyId),
				supabase.from("weekly_pot_contributions").select("week_start,amount,player_count").eq("lobby_id", lobbyId).order("week_start"),
				supabase.from("history_events").select("*").eq("lobby_id", lobbyId).order("created_at", { ascending: false }).limit(100),
				supabase.from("lobby").select("initial_pot,season_number").eq("id", lobbyId).maybeSingle()
			]);
			setPlayers((p ?? []) as any);
			setContribs((c ?? []) as any);
			setEvents((e ?? []) as any);
			setInitialPot((l as any)?.initial_pot ?? 0);
			setSeasonNumber((l as any)?.season_number ?? 1);
		})();
	}, [params]);

	const totalContribs = contribs.reduce((s, x) => s + (x.amount || 0), 0);
	const finalPot = (initialPot || 0) + totalContribs;
	const ko = events.find(ev => ev.type === "SEASON_KO");
	const loserName = ko ? (players.find(p => p.id === (ko.payload?.loserPlayerId || ""))?.name || "Player") : "";

	return (
		<div className="mx-auto max-w-5xl">
			<div className="paper-card paper-grain ink-edge p-5 mb-6 border-b-4" style={{ borderColor: "#E1542A" }}>
				<div className="poster-headline text-lg">SEASON {seasonNumber} SUMMARY</div>
				<div className="text-sm text-deepBrown/80">Lobby: {lobbyId}</div>
			</div>
			<div className="grid md:grid-cols-3 gap-4">
				<div className="paper-card paper-grain ink-edge p-5">
					<div className="poster-headline text-base mb-2">Final Pot</div>
					<div className="poster-headline text-3xl">${finalPot}</div>
					<div className="text-xs text-deepBrown/70 mt-1">Initial: ${initialPot} · Contributions: ${totalContribs}</div>
				</div>
				<div className="paper-card paper-grain ink-edge p-5 md:col-span-2">
					<div className="poster-headline text-base mb-2">Weekly Contributions</div>
					<div className="space-y-1 text-sm">
						{contribs.map(c => (
							<div key={c.week_start} className="flex justify-between bg-cream/80 border border-deepBrown/20 rounded-md px-3 py-2">
								<div>{new Date(c.week_start).toLocaleDateString()}</div>
								<div>${c.amount} · {c.player_count} players</div>
							</div>
						))}
						{contribs.length === 0 && <div className="text-deepBrown/70 text-sm">No contributions logged yet.</div>}
					</div>
				</div>
			</div>

			<div className="paper-card paper-grain ink-edge p-5 mt-6">
				<div className="poster-headline text-base mb-2">KO</div>
				{ko ? (
					<div className="flex items-center gap-3">
						<div className="h-12 w-12 rounded-md overflow-hidden bg-tan border border-deepBrown/30">
							{players.find(p => p.id === ko.target_player_id)?.avatar_url
								? <img src={players.find(p => p.id === ko.target_player_id)?.avatar_url as string} alt="" className="h-full w-full object-cover" />
								: <div className="h-full w-full flex items-center justify-center text-2xl">💀</div>}
						</div>
						<div className="text-sm">
							<span className="font-semibold">{loserName}</span> was KO’d · Pot at KO: ${ko.payload?.currentPot ?? finalPot}
						</div>
						<div className="text-xs text-deepBrown/70 ml-auto">{new Date(ko.created_at).toLocaleString()}</div>
					</div>
				) : (
					<div className="text-deepBrown/70 text-sm">No KO recorded yet.</div>
				)}
			</div>

			<div className="mt-6">
				<a href={`/lobby/${encodeURIComponent(lobbyId)}`} className="btn-vintage px-4 py-2 rounded-md text-xs">Back to Lobby</a>
			</div>
		</div>
	);
}


