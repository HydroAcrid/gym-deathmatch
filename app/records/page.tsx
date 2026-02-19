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
} from "lucide-react";
import {
  type LobbyRow,
  type LiveLobby,
  type ArchivedSeasonRecord,
  buildRecordsViewModel,
} from "@/src/ui2/adapters/records";

/* ---------- Component ---------- */

export default function RecordsPage() {
  const { user } = useAuth();
  const [lobbies, setLobbies] = useState<LobbyRow[]>([]);
  const [liveData, setLiveData] = useState<Map<string, LiveLobby>>(new Map());
  const [archivedSeasons, setArchivedSeasons] = useState<ArchivedSeasonRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSeason, setExpandedSeason] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    setLoading(true);

    Promise.all([
      authFetch(`/api/lobbies`).then((r) => (r.ok ? r.json() : { lobbies: [] })),
      authFetch(`/api/records/seasons`).then((r) => (r.ok ? r.json() : { seasons: [] })),
    ])
      .then(async ([lobbyPayload, archivedPayload]) => {
        if (cancelled) return;
        const lobbyList = (lobbyPayload?.lobbies ?? []) as LobbyRow[];
        const archived = (archivedPayload?.seasons ?? []) as ArchivedSeasonRecord[];
        setLobbies(lobbyList);
        setArchivedSeasons(archived);

        const recent = lobbyList.slice(0, 15);
        const results = await Promise.all(
          recent.map((lobby) =>
            authFetch(`/api/lobby/${lobby.id}/live`)
              .then((r) => (r.ok ? r.json() : null))
              .catch(() => null)
          )
        );
        if (cancelled) return;
        const map = new Map<string, LiveLobby>();
        results.forEach((data, i) => {
          if (data?.lobby) map.set(recent[i].id, data);
        });
        setLiveData(map);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const { champions, records, pastSeasons, activeSeasons, hasData } = useMemo(
    () =>
      buildRecordsViewModel({
        lobbies,
        liveData,
        archivedSeasons,
      }),
    [lobbies, liveData, archivedSeasons]
  );

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
                    const isExpanded = expandedSeason === key;
                    return (
                      <div key={key} className="scoreboard-panel overflow-hidden">
                        {/* Mobile: Tap to expand */}
                        <div
                          className="sm:hidden p-4 cursor-pointer active:bg-muted/30"
                          onClick={() => setExpandedSeason(isExpanded ? null : key)}
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
                                isExpanded ? "rotate-90" : ""
                              }`}
                            />
                          </div>
                          {isExpanded && (
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
                              {season.standings.length > 0 && (
                                <div className="pt-2 border-t border-border">
                                  <div className="font-display text-[11px] tracking-wider text-muted-foreground uppercase mb-2">
                                    Final standings
                                  </div>
                                  <div className="space-y-2">
                                    {season.standings.map((row) => (
                                      <div
                                        key={`${key}-${row.playerId || row.athleteName}`}
                                        className="grid grid-cols-[28px_1fr_auto] items-center gap-2 text-xs"
                                      >
                                        <div className="font-display text-primary">#{row.rank}</div>
                                        <div className="truncate font-display">{row.athleteName}</div>
                                        <div className="text-muted-foreground">{row.points} pts • {row.workouts} wkt</div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
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
                            <button
                              onClick={() => setExpandedSeason(isExpanded ? null : key)}
                              className="arena-badge px-3 py-2 text-xs"
                            >
                              {isExpanded ? "Hide standings" : "Final standings"}
                            </button>
                          </div>
                        </div>
                        {isExpanded && season.standings.length > 0 && (
                          <div className="hidden sm:block border-t border-border px-6 py-4 bg-muted/10">
                            <div className="grid grid-cols-[70px_minmax(220px,1fr)_90px_90px_90px_90px_110px] gap-2 text-[10px] uppercase tracking-wider text-muted-foreground font-display mb-2">
                              <div>Rank</div>
                              <div>Athlete</div>
                              <div className="text-right">Points</div>
                              <div className="text-right">Workouts</div>
                              <div className="text-right">Streak</div>
                              <div className="text-right">Hearts</div>
                              <div className="text-right">Result</div>
                            </div>
                            <div className="space-y-2">
                              {season.standings.map((row) => (
                                <div
                                  key={`${key}-desktop-${row.playerId || row.athleteName}`}
                                  className="grid grid-cols-[70px_minmax(220px,1fr)_90px_90px_90px_90px_110px] gap-2 items-center text-sm"
                                >
                                  <div className="font-display text-primary">#{row.rank}</div>
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className="w-8 h-8 border border-border overflow-hidden bg-muted shrink-0">
                                      {row.avatarUrl ? (
                                        <img src={row.avatarUrl} alt={row.athleteName} className="h-full w-full object-cover" />
                                      ) : (
                                        <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">
                                          {row.athleteName.charAt(0)}
                                        </div>
                                      )}
                                    </div>
                                    <div className="truncate font-display">{row.athleteName}</div>
                                  </div>
                                  <div className="text-right font-display text-primary">{row.points}</div>
                                  <div className="text-right">{row.workouts}</div>
                                  <div className="text-right">{row.streak}</div>
                                  <div className="text-right">{row.hearts}</div>
                                  <div className="text-right">
                                    <span className={`arena-badge text-[10px] ${row.result === "CHAMPION" ? "arena-badge-gold" : ""}`}>
                                      {row.result}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
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
