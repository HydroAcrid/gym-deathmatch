"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/components/AuthProvider";
import Link from "next/link";
import { authFetch } from "@/lib/clientAuth";
import {
  User,
  Trophy,
  Heart,
  Dumbbell,
  Flame,
  Calendar,
  TrendingUp,
  Crown,
  MapPin,
  ChevronDown,
  ExternalLink,
} from "lucide-react";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { calculatePoints } from "@/lib/points";

/* ---------- Types ---------- */

type ProfileData = {
  displayName: string | null;
  avatarUrl: string | null;
  location: string | null;
  quip: string | null;
};

type LobbyRow = {
  id: string;
  name: string;
  season_number: number;
  stage: string | null;
  status: string | null;
  season_start: string | null;
  season_end: string | null;
  cash_pool: number;
  created_at: string;
};

type EnrichedPlayer = {
  id: string;
  name: string;
  userId?: string;
  totalWorkouts: number;
  currentStreak: number;
  longestStreak: number;
  livesRemaining: number;
  weeklyTarget: number;
  heartsTimeline?: Array<{ weekStart: string; workouts: number }>;
  recentActivities: Array<{
    id?: string;
    name?: string;
    caption?: string | null;
    type?: string;
    startDate?: string;
    date?: string;
    durationMinutes?: number;
    duration_minutes?: number;
    distanceKm?: number | null;
    distance_km?: number | null;
    source?: string;
  }>;
};

type LiveLobby = {
  lobby: {
    id: string;
    name: string;
    seasonNumber: number;
    stage: string;
    initialLives: number;
    players: EnrichedPlayer[];
    seasonSummary?: {
      winners?: Array<{ id: string; name: string; totalWorkouts: number }>;
      losers?: Array<{ id: string; name: string }>;
      highlights?: {
        longestStreak?: { playerName: string; streak: number };
        mostWorkouts?: { playerName: string; count: number };
      };
    } | null;
  };
};

type AggregatedStats = {
  totalWorkouts: number;
  currentStreak: number;
  longestStreak: number;
  seasonsPlayed: number;
  seasonsWon: number;
  currentHearts: number;
  maxHearts: number;
  lobbies: Array<{
    id: string;
    name: string;
    seasonNumber: number;
    stage: string;
    rank: number;
    workouts: number;
    result: string;
    points: number;
    currentStreak: number;
    longestStreak: number;
    hearts: number;
    weeklyProgress: number;
    weeklyTarget: number;
    seasonStart: string | null;
    seasonEnd: string | null;
  }>;
  recentWorkouts: Array<{
    id: string;
    title: string;
    type: string;
    duration: number;
    distance?: number | null;
    date: Date;
    source: string;
    lobbyName: string;
  }>;
};

/* ---------- Helpers ---------- */

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}min`;
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
}

function formatTimeAgo(date: Date): string {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "recently";
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffHours < 1) return "just now";
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatDateShort(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/* ---------- Component ---------- */

export default function ProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [lobbies, setLobbies] = useState<LobbyRow[]>([]);
  const [liveData, setLiveData] = useState<Map<string, LiveLobby>>(new Map());
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "history" | "seasons">("overview");

  // Fetch profile + lobbies
  useEffect(() => {
    if (!user?.id) return;

    Promise.all([
      authFetch(`/api/profile`).then((r) => (r.ok ? r.json() : null)),
      authFetch(`/api/lobbies`).then((r) => (r.ok ? r.json() : { lobbies: [] })),
    ])
      .then(([profileRes, lobbiesRes]) => {
        if (profileRes) setProfile(profileRes);
        const lobbyList = lobbiesRes?.lobbies ?? [];
        setLobbies(lobbyList);

        // Fetch live data for all joined/owned lobbies to keep profile stats accurate.
        // Lobby count is capped server-side, so this remains bounded.
        const recent = lobbyList;
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

  // Aggregate stats across all lobbies
  const stats = useMemo((): AggregatedStats => {
    const userId = user?.id;
    if (!userId)
      return {
        totalWorkouts: 0, currentStreak: 0, longestStreak: 0,
        seasonsPlayed: 0, seasonsWon: 0, currentHearts: 0, maxHearts: 3,
        lobbies: [], recentWorkouts: [],
      };

    let totalWorkouts = 0;
    let bestStreak = 0;
    let currentStreak = 0;
    let seasonsWon = 0;
    let currentHearts = 3;
    let maxHearts = 3;
    const lobbyEntries: AggregatedStats["lobbies"] = [];
    const allWorkouts: AggregatedStats["recentWorkouts"] = [];

    for (const lobby of lobbies) {
      const live = liveData.get(lobby.id);
      if (!live?.lobby?.players) continue;

      const me = live.lobby.players.find((p: EnrichedPlayer) => p.userId === userId);
      if (!me) continue;

      totalWorkouts += me.totalWorkouts;
      if (me.longestStreak > bestStreak) bestStreak = me.longestStreak;
      if (me.currentStreak > currentStreak) currentStreak = me.currentStreak;

      // Check if we won this season
      const summary = live.lobby.seasonSummary;
      const isWinner = summary?.winners?.some((w) => w.id === me.id) ?? false;
      if (isWinner) seasonsWon++;

      // Rank by workouts in this lobby
      const sorted = [...live.lobby.players].sort((a, b) => b.totalWorkouts - a.totalWorkouts);
      const rank = sorted.findIndex((p) => p.userId === userId) + 1;
      const weeklyProgress = (() => {
        const timeline = Array.isArray(me.heartsTimeline) ? me.heartsTimeline : [];
        if (!timeline.length) return 0;
        return timeline[timeline.length - 1]?.workouts ?? 0;
      })();

      let result = "IN PROGRESS";
      if (live.lobby.stage === "COMPLETED") {
        result = isWinner ? "CHAMPION" : "ELIMINATED";
      }

      if (live.lobby.stage === "ACTIVE") {
        currentHearts = me.livesRemaining;
        maxHearts = live.lobby.initialLives || 3;
      }

      lobbyEntries.push({
        id: lobby.id,
        name: lobby.name,
        seasonNumber: live.lobby.seasonNumber,
        stage: live.lobby.stage,
        rank,
        workouts: me.totalWorkouts,
        result,
        points: calculatePoints({ workouts: me.totalWorkouts, streak: me.currentStreak ?? 0 }),
        currentStreak: me.currentStreak ?? 0,
        longestStreak: me.longestStreak ?? 0,
        hearts: me.livesRemaining ?? 0,
        weeklyProgress,
        weeklyTarget: me.weeklyTarget ?? 3,
        seasonStart: lobby.season_start ?? null,
        seasonEnd: lobby.season_end ?? null,
      });

      // Collect recent activities
      if (me.recentActivities) {
        for (let idx = 0; idx < me.recentActivities.length; idx++) {
          const act = me.recentActivities[idx];
          const rawDate = act.startDate || act.date;
          if (!rawDate) continue;
          const parsedDate = new Date(rawDate);
          if (Number.isNaN(parsedDate.getTime())) continue;
          const duration = Number(act.durationMinutes ?? act.duration_minutes ?? 0);
          const distanceRaw = act.distanceKm ?? act.distance_km;
          const distance = typeof distanceRaw === "number" ? distanceRaw : null;
          const title = act.caption || act.name || `${act.type || "Workout"} workout`;
          const stableId = act.id || `${lobby.id}:${rawDate}:${act.type || "workout"}:${idx}`;
          allWorkouts.push({
            id: stableId,
            title,
            type: act.type || "workout",
            duration: Number.isFinite(duration) ? duration : 0,
            distance,
            date: parsedDate,
            source: act.source || "manual",
            lobbyName: lobby.name,
          });
        }
      }
    }

    // De-dup by id in case live payload includes repeated entries.
    const dedupedWorkouts = Array.from(
      new Map(allWorkouts.map((w) => [w.id, w])).values()
    );

    // Sort workouts by date descending
    dedupedWorkouts.sort((a, b) => b.date.getTime() - a.date.getTime());

    return {
      totalWorkouts,
      currentStreak,
      longestStreak: bestStreak,
      seasonsPlayed: lobbyEntries.length,
      seasonsWon,
      currentHearts,
      maxHearts,
      lobbies: lobbyEntries,
      recentWorkouts: dedupedWorkouts.slice(0, 20),
    };
  }, [user?.id, lobbies, liveData]);

  const displayName = profile?.displayName || user?.user_metadata?.full_name || "ATHLETE";
  const initials = getInitials(displayName);
  const location = profile?.location || "";
  const seasonRows = useMemo(() => {
    return [...stats.lobbies].sort((a, b) => {
      const activeRank = (s: string) => (s === "ACTIVE" ? 0 : s === "COMPLETED" ? 1 : 2);
      const byStage = activeRank(a.stage) - activeRank(b.stage);
      if (byStage !== 0) return byStage;
      return b.seasonNumber - a.seasonNumber;
    });
  }, [stats.lobbies]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="scoreboard-panel p-8 text-center">
          <User className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="font-display text-lg tracking-wider mb-4">SIGN IN TO VIEW YOUR PROFILE</p>
          <Link href="/onboard" className="arena-badge arena-badge-primary px-6 py-2">
            SIGN IN
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="font-display text-sm tracking-widest text-muted-foreground">LOADING PROFILE...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 sm:px-6 py-8 max-w-4xl">
        {/* Profile Header */}
        <div className="scoreboard-panel p-6 mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            {/* Avatar */}
            {profile?.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt={displayName}
                className="w-20 h-20 border-2 border-primary object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-20 h-20 bg-muted border-2 border-primary flex items-center justify-center flex-shrink-0">
                <span className="font-display text-2xl font-bold text-primary">{initials}</span>
              </div>
            )}

            {/* Info */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1 flex-wrap">
                <h1 className="font-display text-2xl font-bold tracking-wider">
                  {displayName.toUpperCase()}
                </h1>
                {stats.seasonsWon > 0 && (
                  <div className="flex items-center gap-1 px-2 py-0.5 bg-arena-gold/20 border border-arena-gold/30 text-arena-gold text-xs font-display">
                    <Crown className="w-3 h-3" />
                    {stats.seasonsWon}x CHAMPION
                  </div>
                )}
              </div>
              {location && (
                <p className="text-sm text-muted-foreground mb-3 flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> {location.toUpperCase()}
                </p>
              )}

              <div className="mb-3">
                <ProfileAvatar
                  variant="arena"
                  trigger="button"
                  buttonLabel="EDIT PROFILE"
                />
              </div>

              {/* Quick Stats */}
              <div className="flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-1.5">
                  <Dumbbell className="w-4 h-4 text-primary" />
                  <span className="font-display font-bold">{stats.totalWorkouts}</span>
                  <span className="text-muted-foreground">workouts</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-primary" />
                  <span className="font-display font-bold">{stats.currentStreak}</span>
                  <span className="text-muted-foreground">day streak</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Trophy className="w-4 h-4 text-arena-gold" />
                  <span className="font-display font-bold">{stats.seasonsWon}</span>
                  <span className="text-muted-foreground">titles</span>
                </div>
              </div>
            </div>

            {/* Hearts */}
            <div className="flex items-center gap-1">
              {Array.from({ length: stats.maxHearts }).map((_, i) => (
                <Heart
                  key={i}
                  className={`w-6 h-6 ${
                    i < stats.currentHearts
                      ? "text-destructive fill-destructive"
                      : "text-muted-foreground/30"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <div className="grid grid-cols-3 gap-2 rounded-md border border-border bg-card/30 p-1">
          {(["overview", "history", "seasons"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              aria-pressed={activeTab === tab}
              className={`relative py-3 font-display text-xs tracking-widest text-center transition-all duration-200 border ${
                activeTab === tab
                  ? "border-primary/70 text-primary bg-primary/10 shadow-[0_0_14px_hsl(var(--primary)/0.24)]"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border/70"
              }`}
            >
              {activeTab === tab ? (
                <span className="absolute left-1/2 top-1 block h-0.5 w-8 -translate-x-1/2 bg-primary" />
              ) : null}
              {tab.toUpperCase()}
            </button>
          ))}
          </div>
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="scoreboard-panel p-4 text-center">
                <Dumbbell className="w-5 h-5 mx-auto text-primary mb-2" />
                <div className="font-display text-2xl font-bold text-primary">{stats.totalWorkouts}</div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider">TOTAL WORKOUTS</div>
              </div>
              <div className="scoreboard-panel p-4 text-center">
                <Calendar className="w-5 h-5 mx-auto text-primary mb-2" />
                <div className="font-display text-2xl font-bold text-primary">{stats.seasonsPlayed}</div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider">SEASONS</div>
              </div>
              <div className="scoreboard-panel p-4 text-center">
                <Flame className="w-5 h-5 mx-auto text-arena-gold mb-2" />
                <div className="font-display text-2xl font-bold text-arena-gold">{stats.longestStreak}</div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider">BEST STREAK</div>
              </div>
              <div className="scoreboard-panel p-4 text-center">
                <Trophy className="w-5 h-5 mx-auto text-arena-gold mb-2" />
                <div className="font-display text-2xl font-bold text-arena-gold">{stats.seasonsWon}</div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider">CHAMPIONSHIPS</div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="scoreboard-panel">
              <div className="p-4 border-b border-border">
                <h3 className="font-display font-bold tracking-wider flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  RECENT ACTIVITY
                </h3>
              </div>
              {stats.recentWorkouts.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">No workouts recorded yet.</div>
              ) : (
                <div className="divide-y divide-border/50">
                  {stats.recentWorkouts.slice(0, 5).map((w) => (
                    <div key={w.id} className="p-4 flex items-center justify-between">
                      <div>
                        <p className="font-display font-bold text-foreground">{w.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDuration(w.duration)}
                          {w.distance ? ` • ${w.distance}km` : ""}
                          {" • "}
                          {formatTimeAgo(w.date)}
                          {" • "}
                          {w.lobbyName}
                        </p>
                      </div>
                      <div className="arena-badge arena-badge-primary text-[10px]">
                        {w.type.toUpperCase()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* History Tab */}
        {activeTab === "history" && (
          <div className="scoreboard-panel">
            <div className="p-4 border-b border-border">
              <h3 className="font-display font-bold tracking-wider">WORKOUT HISTORY</h3>
            </div>
            {stats.recentWorkouts.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">No workouts recorded yet.</div>
            ) : (
              <div className="divide-y divide-border/50">
                {stats.recentWorkouts.map((w) => (
                  <div key={w.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-muted border border-border flex items-center justify-center">
                        <Dumbbell className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-display font-bold text-foreground">{w.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDuration(w.duration)}
                          {w.distance ? ` • ${w.distance}km` : ""}
                          {" • "}
                          {w.lobbyName}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="arena-badge text-[10px] mb-1">{w.source.toUpperCase()}</div>
                      <p className="text-xs text-muted-foreground">{formatTimeAgo(w.date)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Seasons Tab */}
        {activeTab === "seasons" && (
          <div className="scoreboard-panel">
            <div className="p-4 border-b border-border">
              <h3 className="font-display font-bold tracking-wider flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                SEASON PARTICIPATION
              </h3>
            </div>
            {seasonRows.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">No seasons found.</div>
            ) : (
              <div className="divide-y divide-border/50">
                {seasonRows.map((s) => (
                  <details key={`${s.id}-${s.seasonNumber}`} className="group">
                    <summary className="list-none p-4 hover:bg-muted/30 transition-colors cursor-pointer">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-display font-bold">{s.name.toUpperCase()}</span>
                            {s.result === "CHAMPION" && <Crown className="w-4 h-4 text-arena-gold" />}
                          </div>
                          <p className="text-sm text-muted-foreground">Season {s.seasonNumber}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div
                              className={`arena-badge text-[10px] mb-1 ${
                                s.result === "CHAMPION"
                                  ? "arena-badge-gold"
                                  : s.stage === "ACTIVE"
                                    ? "arena-badge-primary"
                                    : ""
                              }`}
                            >
                              {s.result}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              #{s.rank} • {s.workouts} workouts
                            </p>
                          </div>
                          <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform group-open:rotate-180" />
                        </div>
                      </div>
                    </summary>
                    <div className="px-4 pb-4 pt-1 border-t border-border/40 bg-muted/10">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                        <div className="scoreboard-panel p-3">
                          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Points</div>
                          <div className="font-display text-lg text-primary">{s.points}</div>
                        </div>
                        <div className="scoreboard-panel p-3">
                          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Streak</div>
                          <div className="font-display text-lg text-primary">{s.currentStreak}</div>
                        </div>
                        <div className="scoreboard-panel p-3">
                          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Hearts</div>
                          <div className="font-display text-lg text-primary">{s.hearts}</div>
                        </div>
                        <div className="scoreboard-panel p-3">
                          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Goal</div>
                          <div className="font-display text-lg text-primary">{s.weeklyProgress}/{s.weeklyTarget}</div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <p className="text-xs text-muted-foreground">
                          {formatDateShort(s.seasonStart)} → {formatDateShort(s.seasonEnd)}
                        </p>
                        <Link href={`/lobby/${s.id}`} className="arena-badge px-3 py-2 text-[10px] inline-flex items-center gap-1">
                          OPEN LOBBY
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>
                  </details>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
