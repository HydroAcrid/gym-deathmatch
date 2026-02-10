"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/components/AuthProvider";
import Link from "next/link";
import Image from "next/image";
import { authFetch } from "@/lib/clientAuth";
import {
  Trophy,
  Crown,
  Calendar,
  TrendingUp,
  Medal,
  ChevronRight,
  Flame,
  Dumbbell,
} from "lucide-react";
import { calculatePoints } from "@/lib/points";
import { formatLocalDate } from "@/lib/datetime";

/* ---------- Types ---------- */

type LobbyRow = {
  id: string;
  name: string;
  season_number: number;
  stage: string | null;
  status: string | null;
  season_start: string | null;
  season_end: string | null;
  cash_pool: number;
  season_summary?: any;
};

type EnrichedPlayer = {
  id: string;
  name: string;
  avatarUrl?: string;
  userId?: string;
  totalWorkouts: number;
  currentStreak: number;
  longestStreak: number;
  livesRemaining: number;
  averageWorkoutsPerWeek: number;
};

type LiveLobby = {
  lobby: {
    id: string;
    name: string;
    seasonNumber: number;
    stage: string;
    cashPool: number;
    initialLives: number;
    players: EnrichedPlayer[];
    seasonSummary?: {
      seasonNumber?: number;
      winners?: Array<{ id: string; name: string; avatarUrl?: string; totalWorkouts: number; hearts: number; currentStreak?: number; points?: number }>;
      losers?: Array<{ id: string; name: string; totalWorkouts: number; hearts?: number; currentStreak?: number; points?: number }>;
      finalPot?: number;
      highlights?: {
        longestStreak?: { playerName: string; streak: number };
        mostWorkouts?: { playerName: string; count: number };
        mostConsistent?: { playerName: string; avgPerWeek: number };
      };
    } | null;
  };
};

type Champion = { name: string; titles: number; seasons: string[]; avatarUrl?: string | null };
type AllTimeRecord = { record: string; holder: string; value: string; lobby: string };
type PastSeason = {
  lobbyId: string;
  lobbyName: string;
  season: number;
  champion: string;
  startDate: string;
  endDate: string;
  participants: number;
  totalWorkouts: number;
  finalPot: number;
  highlights: string;
};
type ActiveSeason = {
  lobbyId: string;
  lobbyName: string;
  seasonNumber: number;
  athleteCount: number;
  totalWorkouts: number;
  currentLeader: string;
  currentLeaderPoints: number;
};

/* ---------- Helpers ---------- */

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return formatLocalDate(iso, { month: "short", day: "numeric", year: "numeric" }).toUpperCase();
}

/* ---------- Component ---------- */

export default function RecordsPage() {
  const { user } = useAuth();
  const [lobbies, setLobbies] = useState<LobbyRow[]>([]);
  const [liveData, setLiveData] = useState<Map<string, LiveLobby>>(new Map());
  const [loading, setLoading] = useState(true);
  const [expandedSeason, setExpandedSeason] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);

    authFetch(`/api/lobbies`)
      .then((r) => (r.ok ? r.json() : { lobbies: [] }))
      .then(({ lobbies: lobbyList }) => {
        setLobbies(lobbyList ?? []);
        const recent = (lobbyList ?? []).slice(0, 15);
        return Promise.all(
          recent.map((l: LobbyRow) =>
            authFetch(`/api/lobby/${l.id}/live`)
              .then((r) => (r.ok ? r.json() : null))
              .catch(() => null)
          )
        ).then((results) => {
          const map = new Map<string, LiveLobby>();
          results.forEach((data, i) => {
            if (data?.lobby) map.set(recent[i].id, data);
          });
          setLiveData(map);
        });
      })
      .finally(() => setLoading(false));
  }, [user?.id]);

  // Compute champions, records, past seasons, active seasons
  const { champions, records, pastSeasons, activeSeasons } = useMemo(() => {
    const champMap = new Map<string, { titles: number; seasons: string[]; avatarUrl?: string | null }>();
    const pastList: PastSeason[] = [];
    const activeList: ActiveSeason[] = [];
    const recordCandidates = {
      longestStreak: { holder: "", value: 0, lobby: "" },
      mostWorkouts: { holder: "", value: 0, lobby: "" },
      mostChampionships: { holder: "", value: 0 },
      mostPoints: { holder: "", value: 0, lobby: "" },
      mostConsistent: { holder: "", value: 0, lobby: "" },
    };

    for (const lobby of lobbies) {
      const live = liveData.get(lobby.id);
      if (!live?.lobby) continue;

      const players = live.lobby.players ?? [];
      const summary = live.lobby.seasonSummary;

      // Active seasons
      if (live.lobby.stage === "ACTIVE" && players.length > 0) {
        const sorted = [...players].sort((a, b) =>
          calculatePoints({ workouts: b.totalWorkouts, streak: b.currentStreak }) -
          calculatePoints({ workouts: a.totalWorkouts, streak: a.currentStreak })
        );
        const totalW = players.reduce((s, p) => s + p.totalWorkouts, 0);
        const leader = sorted[0];
        const leaderPoints = leader
          ? calculatePoints({ workouts: leader.totalWorkouts, streak: leader.currentStreak })
          : 0;
        activeList.push({
          lobbyId: lobby.id,
          lobbyName: lobby.name,
          seasonNumber: live.lobby.seasonNumber,
          athleteCount: players.length,
          totalWorkouts: totalW,
          currentLeader: leader?.name ?? "—",
          currentLeaderPoints: leaderPoints,
        });
      }

      // Completed seasons with summary
      if (live.lobby.stage === "COMPLETED" && summary) {
        const winners = summary.winners ?? [];
        const champion = winners[0]?.name ?? "UNKNOWN";
        const totalW =
          [...(summary.winners ?? []), ...(summary.losers ?? [])].reduce(
            (s: number, p: { totalWorkouts?: number }) => s + (p.totalWorkouts ?? 0),
            0
          );
        const seasonPlayers = [...(summary.winners ?? []), ...(summary.losers ?? [])];
        const seasonTop = seasonPlayers.reduce(
          (best, player) => {
            const points = player.points ?? calculatePoints({
              workouts: player.totalWorkouts ?? 0,
              streak: player.currentStreak ?? 0
            });
            return points > best.points ? { name: player.name, points } : best;
          },
          { name: "", points: 0 }
        );
        if (seasonTop.points > recordCandidates.mostPoints.value) {
          recordCandidates.mostPoints = { holder: seasonTop.name, value: seasonTop.points, lobby: lobby.name };
        }

        pastList.push({
          lobbyId: lobby.id,
          lobbyName: lobby.name,
          season: summary.seasonNumber ?? live.lobby.seasonNumber,
          champion,
          startDate: formatDate(lobby.season_start),
          endDate: formatDate(lobby.season_end),
          participants: players.length,
          totalWorkouts: totalW,
          finalPot: summary.finalPot ?? lobby.cash_pool,
          highlights: summary.highlights?.longestStreak
            ? `${summary.highlights.longestStreak.playerName} achieved a ${summary.highlights.longestStreak.streak}-day streak`
            : summary.highlights?.mostWorkouts
              ? `${summary.highlights.mostWorkouts.playerName} logged ${summary.highlights.mostWorkouts.count} workouts`
              : "",
        });

        // Track champions
        for (const w of winners) {
          const fallbackAvatar = players.find((p) => p.name === w.name && p.avatarUrl)?.avatarUrl ?? null;
          const existing = champMap.get(w.name) ?? { titles: 0, seasons: [], avatarUrl: w.avatarUrl ?? fallbackAvatar };
          existing.titles++;
          existing.seasons.push(`${lobby.name} S${summary.seasonNumber ?? live.lobby.seasonNumber}`);
          if (!existing.avatarUrl) {
            existing.avatarUrl = w.avatarUrl ?? fallbackAvatar;
          }
          champMap.set(w.name, existing);
        }

        // Records from highlights
        if (summary.highlights?.longestStreak) {
          const s = summary.highlights.longestStreak;
          if (s.streak > recordCandidates.longestStreak.value) {
            recordCandidates.longestStreak = { holder: s.playerName, value: s.streak, lobby: lobby.name };
          }
        }
        if (summary.highlights?.mostWorkouts) {
          const m = summary.highlights.mostWorkouts;
          if (m.count > recordCandidates.mostWorkouts.value) {
            recordCandidates.mostWorkouts = { holder: m.playerName, value: m.count, lobby: lobby.name };
          }
        }
        if (summary.highlights?.mostConsistent) {
          const c = summary.highlights.mostConsistent;
          if (c.avgPerWeek > recordCandidates.mostConsistent.value) {
            recordCandidates.mostConsistent = { holder: c.playerName, value: c.avgPerWeek, lobby: lobby.name };
          }
        }
      }

      // Aggregate player records from live data
      for (const p of players) {
        const points = calculatePoints({ workouts: p.totalWorkouts, streak: p.currentStreak });
        if (p.longestStreak > recordCandidates.longestStreak.value) {
          recordCandidates.longestStreak = { holder: p.name, value: p.longestStreak, lobby: lobby.name };
        }
        if (p.totalWorkouts > recordCandidates.mostWorkouts.value) {
          recordCandidates.mostWorkouts = { holder: p.name, value: p.totalWorkouts, lobby: lobby.name };
        }
        if (points > recordCandidates.mostPoints.value) {
          recordCandidates.mostPoints = { holder: p.name, value: points, lobby: lobby.name };
        }
      }
    }

    // Track most championships
    for (const [name, data] of champMap) {
      if (data.titles > recordCandidates.mostChampionships.value) {
        recordCandidates.mostChampionships = { holder: name, value: data.titles };
      }
    }

    // Build records list
    const recordsList: AllTimeRecord[] = [];
    if (recordCandidates.longestStreak.value > 0) {
      recordsList.push({
        record: "LONGEST STREAK",
        holder: recordCandidates.longestStreak.holder,
        value: `${recordCandidates.longestStreak.value} DAYS`,
        lobby: recordCandidates.longestStreak.lobby,
      });
    }
    if (recordCandidates.mostWorkouts.value > 0) {
      recordsList.push({
        record: "MOST WORKOUTS",
        holder: recordCandidates.mostWorkouts.holder,
        value: `${recordCandidates.mostWorkouts.value}`,
        lobby: recordCandidates.mostWorkouts.lobby,
      });
    }
    if (recordCandidates.mostPoints.value > 0) {
      recordsList.push({
        record: "MOST POINTS",
        holder: recordCandidates.mostPoints.holder,
        value: `${recordCandidates.mostPoints.value}`,
        lobby: recordCandidates.mostPoints.lobby,
      });
    }
    if (recordCandidates.mostChampionships.value > 0) {
      recordsList.push({
        record: "MOST CHAMPIONSHIPS",
        holder: recordCandidates.mostChampionships.holder,
        value: `${recordCandidates.mostChampionships.value}`,
        lobby: "ALL TIME",
      });
    }
    if (recordCandidates.mostConsistent.value > 0) {
      recordsList.push({
        record: "MOST CONSISTENT",
        holder: recordCandidates.mostConsistent.holder,
        value: `${recordCandidates.mostConsistent.value.toFixed(1)}/WK`,
        lobby: recordCandidates.mostConsistent.lobby,
      });
    }

    // Build champions list sorted by titles
    const championsList: Champion[] = Array.from(champMap.entries())
      .map(([name, data]) => ({ name, titles: data.titles, seasons: data.seasons, avatarUrl: data.avatarUrl ?? null }))
      .sort((a, b) => b.titles - a.titles);

    // Sort past seasons newest first
    pastList.sort((a, b) => b.season - a.season);

    return { champions: championsList, records: recordsList, pastSeasons: pastList, activeSeasons: activeList };
  }, [lobbies, liveData]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="scoreboard-panel p-8 text-center">
          <Trophy className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="font-display text-lg tracking-wider mb-4">SIGN IN TO VIEW RECORDS</p>
          <Link href="/onboard" className="arena-badge arena-badge-primary px-6 py-2">SIGN IN</Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="font-display text-sm tracking-widest text-muted-foreground">LOADING RECORDS...</p>
        </div>
      </div>
    );
  }

  const hasData = champions.length > 0 || records.length > 0 || pastSeasons.length > 0 || activeSeasons.length > 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Page Header */}
      <header className="border-b border-border bg-card/30">
        <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-12">
          <div className="flex items-center gap-3 sm:gap-4 mb-2 sm:mb-4">
            <Trophy className="w-6 sm:w-8 h-6 sm:h-8 text-arena-gold" />
            <h1 className="text-2xl sm:text-4xl md:text-5xl font-display font-bold tracking-wider">
              HALL OF RECORDS
            </h1>
          </div>
          <p className="text-sm sm:text-base text-muted-foreground max-w-2xl">
            PERMANENT ARCHIVE OF ALL SEASONS, CHAMPIONS, AND RECORDS.
          </p>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {!hasData ? (
          <div className="scoreboard-panel p-12 text-center">
            <Trophy className="w-16 h-16 mx-auto text-muted-foreground/30 mb-6" />
            <h2 className="font-display text-xl tracking-wider mb-2">NO RECORDS YET</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Complete a season to start building your hall of records.
            </p>
            <Link href="/lobbies" className="arena-badge arena-badge-primary px-6 py-2">
              VIEW LOBBIES
            </Link>
          </div>
        ) : (
          <>
            {/* Hall of Champions */}
            {champions.length > 0 && (
              <section className="mb-8 sm:mb-12">
                <div className="flex items-center gap-3 mb-4 sm:mb-6">
                  <Crown className="w-5 sm:w-6 h-5 sm:h-6 text-arena-gold" />
                  <h2 className="font-display text-lg sm:text-2xl font-bold tracking-wider">HALL OF CHAMPIONS</h2>
                </div>
                <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-3 sm:overflow-visible">
                  {champions.map((champ, index) => (
                    <div
                      key={champ.name}
                      className={`scoreboard-panel p-4 sm:p-6 text-center flex-shrink-0 w-[200px] sm:w-auto ${
                        index === 0 ? "border-arena-gold/50 stadium-glow" : ""
                      }`}
                    >
                      <div className="w-14 sm:w-20 h-14 sm:h-20 mx-auto mb-3 sm:mb-4 bg-muted border-2 border-arena-gold/30 flex items-center justify-center">
                        {champ.avatarUrl ? (
                          <Image
                            src={champ.avatarUrl}
                            alt={`${champ.name} avatar`}
                            width={80}
                            height={80}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="text-xl sm:text-3xl font-display font-bold text-arena-gold">
                            {champ.name.charAt(0)}
                          </span>
                        )}
                      </div>
                      <h3 className="font-display text-sm sm:text-xl font-bold text-foreground tracking-wide mb-2">
                        {champ.name}
                      </h3>
                      <div className="flex items-center justify-center gap-1 sm:gap-2 mb-3 sm:mb-4">
                        {Array.from({ length: champ.titles }).map((_, i) => (
                          <Trophy key={i} className="w-4 sm:w-5 h-4 sm:h-5 text-arena-gold" />
                        ))}
                      </div>
                      <div className="arena-badge arena-badge-gold text-[10px] sm:text-xs">
                        {champ.titles}× CHAMPION
                      </div>
                      <div className="mt-3 sm:mt-4 text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">
                        {champ.seasons.join(", ")}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* All-Time Records */}
            {records.length > 0 && (
              <section className="mb-8 sm:mb-12">
                <div className="flex items-center gap-3 mb-4 sm:mb-6">
                  <Medal className="w-5 sm:w-6 h-5 sm:h-6 text-primary" />
                  <h2 className="font-display text-lg sm:text-2xl font-bold tracking-wider">ALL-TIME RECORDS</h2>
                </div>
                <div className="scoreboard-panel overflow-hidden">
                  {/* Desktop header */}
                  <div className="hidden sm:grid grid-cols-12 gap-2 px-4 py-3 bg-muted/50 border-b border-border text-xs uppercase tracking-wider text-muted-foreground font-display">
                    <div className="col-span-4">RECORD</div>
                    <div className="col-span-4">HOLDER</div>
                    <div className="col-span-2 text-center">VALUE</div>
                    <div className="col-span-2 text-right">SOURCE</div>
                  </div>
                  <div className="divide-y divide-border/50">
                    {records.map((rec) => (
                      <div key={rec.record} className="p-4 hover:bg-muted/30 transition-colors">
                        {/* Mobile */}
                        <div className="sm:hidden">
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <span className="font-display font-bold text-foreground text-sm flex-1">{rec.record}</span>
                            <span className="font-display font-bold text-arena-gold text-lg">{rec.value}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="font-display text-primary text-sm">{rec.holder}</span>
                            <span className="arena-badge text-[10px]">{rec.lobby}</span>
                          </div>
                        </div>
                        {/* Desktop */}
                        <div className="hidden sm:grid grid-cols-12 gap-2 items-center">
                          <div className="col-span-4 font-display font-bold text-foreground text-sm">{rec.record}</div>
                          <div className="col-span-4 font-display text-primary">{rec.holder}</div>
                          <div className="col-span-2 text-center font-display font-bold text-arena-gold text-lg">{rec.value}</div>
                          <div className="col-span-2 text-right"><span className="arena-badge">{rec.lobby}</span></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {/* Past Seasons */}
            {pastSeasons.length > 0 && (
              <section className="mb-8 sm:mb-12">
                <div className="flex items-center gap-3 mb-4 sm:mb-6">
                  <Calendar className="w-5 sm:w-6 h-5 sm:h-6 text-primary" />
                  <h2 className="font-display text-lg sm:text-2xl font-bold tracking-wider">SEASON ARCHIVE</h2>
                </div>
                <div className="space-y-4">
                  {pastSeasons.map((season) => {
                    const key = `${season.lobbyId}-${season.season}`;
                    return (
                      <div key={key} className="scoreboard-panel overflow-hidden">
                        {/* Mobile: Tap to expand */}
                        <div
                          className="sm:hidden p-4 cursor-pointer active:bg-muted/30"
                          onClick={() => setExpandedSeason(expandedSeason === key ? null : key)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 bg-muted border border-border flex flex-col items-center justify-center flex-shrink-0">
                                <span className="text-[10px] text-muted-foreground uppercase">S</span>
                                <span className="text-lg font-display font-bold text-primary">{season.season}</span>
                              </div>
                              <div>
                                <h3 className="font-display text-sm font-bold text-foreground tracking-wide">
                                  {season.lobbyName.toUpperCase()}
                                </h3>
                                <div className="flex items-center gap-2">
                                  <Trophy className="w-3 h-3 text-arena-gold" />
                                  <span className="text-xs text-arena-gold font-display">{season.champion}</span>
                                </div>
                              </div>
                            </div>
                            <ChevronRight
                              className={`w-5 h-5 text-muted-foreground transition-transform ${
                                expandedSeason === key ? "rotate-90" : ""
                              }`}
                            />
                          </div>
                          {expandedSeason === key && (
                            <div className="mt-4 pt-4 border-t border-border space-y-3">
                              <div className="text-xs text-muted-foreground uppercase tracking-wider">
                                {season.startDate} — {season.endDate}
                              </div>
                              {season.highlights && (
                                <p className="text-sm text-muted-foreground italic">&ldquo;{season.highlights}&rdquo;</p>
                              )}
                              <div className="flex gap-6">
                                <div className="text-center">
                                  <div className="text-xl font-display font-bold text-foreground">{season.participants}</div>
                                  <div className="text-[10px] text-muted-foreground uppercase">ATHLETES</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-xl font-display font-bold text-primary">{season.totalWorkouts}</div>
                                  <div className="text-[10px] text-muted-foreground uppercase">WORKOUTS</div>
                                </div>
                                {season.finalPot > 0 && (
                                  <div className="text-center">
                                    <div className="text-xl font-display font-bold text-arena-gold">${season.finalPot}</div>
                                    <div className="text-[10px] text-muted-foreground uppercase">FINAL POT</div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Desktop */}
                        <div className="hidden sm:block p-6">
                          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                            <div className="flex items-center gap-6">
                              <div className="w-20 h-20 bg-muted border-2 border-border flex flex-col items-center justify-center flex-shrink-0">
                                <span className="text-xs text-muted-foreground uppercase tracking-wider">SEASON</span>
                                <span className="text-3xl font-display font-bold text-primary">{season.season}</span>
                              </div>
                              <div>
                                <h3 className="font-display text-xl font-bold text-foreground tracking-wide mb-1">
                                  {season.lobbyName.toUpperCase()}
                                </h3>
                                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                                  {season.startDate} — {season.endDate}
                                </div>
                                {season.highlights && (
                                  <p className="text-sm text-muted-foreground italic">&ldquo;{season.highlights}&rdquo;</p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-4 lg:border-l lg:border-border lg:pl-6">
                              <Trophy className="w-8 h-8 text-arena-gold" />
                              <div>
                                <div className="text-xs text-muted-foreground uppercase tracking-wider">CHAMPION</div>
                                <div className="font-display text-xl font-bold text-arena-gold tracking-wide">
                                  {season.champion}
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-6 lg:border-l lg:border-border lg:pl-6">
                              <div className="text-center">
                                <div className="text-2xl font-display font-bold text-foreground">{season.participants}</div>
                                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">ATHLETES</div>
                              </div>
                              <div className="text-center">
                                <div className="text-2xl font-display font-bold text-primary">{season.totalWorkouts}</div>
                                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">WORKOUTS</div>
                              </div>
                              {season.finalPot > 0 && (
                                <div className="text-center">
                                  <div className="text-2xl font-display font-bold text-arena-gold">${season.finalPot}</div>
                                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">FINAL POT</div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Active Seasons Teaser */}
            {activeSeasons.map((active) => (
              <section key={active.lobbyId} className="mb-8">
                <Link
                  href={`/lobby/${active.lobbyId}`}
                  className="scoreboard-panel p-6 sm:p-8 text-center border-primary/30 stadium-glow block hover:bg-muted/20 transition-colors"
                >
                  <div className="flex items-center justify-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                    <TrendingUp className="w-5 sm:w-6 h-5 sm:h-6 text-primary" />
                    <span className="arena-badge arena-badge-primary text-[10px] sm:text-xs">IN PROGRESS</span>
                  </div>
                  <h3 className="font-display text-xl sm:text-3xl font-bold text-foreground tracking-wider mb-2">
                    {active.lobbyName.toUpperCase()} — SEASON {active.seasonNumber}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4 sm:mb-6">
                    THE BATTLE CONTINUES. LEGENDS WILL BE MADE.
                  </p>
                  <div className="flex items-center justify-center gap-4 sm:gap-8 flex-wrap">
                    <div className="text-center">
                      <div className="text-2xl sm:text-3xl font-display font-bold text-foreground">{active.athleteCount}</div>
                      <div className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">ATHLETES</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl sm:text-3xl font-display font-bold text-primary">{active.totalWorkouts}</div>
                      <div className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">WORKOUTS</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg sm:text-3xl font-display font-bold text-arena-gold">{active.currentLeader}</div>
                      <div className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">
                        POINTS LEADER ({active.currentLeaderPoints})
                      </div>
                    </div>
                  </div>
                </Link>
              </section>
            ))}
          </>
        )}
      </main>
    </div>
  );
}
