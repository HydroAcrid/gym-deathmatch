import { Heart, Target, CheckCircle2, AlertTriangle, Skull, Flame, Trophy } from "lucide-react";

type AthleteStatus = "safe" | "at_risk" | "eliminated";

export interface AthleteHeartStatus {
  id: string;
  name: string;
  initials: string;
  avatarUrl?: string | null;
  hearts: number;
  maxHearts: number;
  weeklyTarget: number;
  weeklyProgress: number;
  status: AthleteStatus;
  totalWorkouts: number;
  currentStreak: number;
  averageWorkoutsPerWeek: number;
  longestStreak: number;
  quip?: string | null;
}

interface HeartsStatusBoardProps {
  athletes: AthleteHeartStatus[];
  onAthleteSelect?: (athleteId: string) => void;
}

const statusConfig: Record<AthleteStatus, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  safe: { 
    label: "SAFE", 
    className: "text-[hsl(var(--status-online))] bg-[hsl(var(--status-online))]/10 border-2 border-[hsl(var(--status-online))]/40",
    icon: CheckCircle2
  },
  at_risk: { 
    label: "AT RISK", 
    className: "text-destructive bg-destructive/10 border-2 border-destructive/40",
    icon: AlertTriangle
  },
  eliminated: { 
    label: "ELIMINATED", 
    className: "text-muted-foreground bg-muted border-2 border-border",
    icon: Skull
  }
};

export function HeartsStatusBoard({ athletes, onAthleteSelect }: HeartsStatusBoardProps) {
  return (
    <div className="scoreboard-panel">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 p-4 border-b-2 border-border">
        <div className="flex items-center gap-3">
        <Heart className="w-5 h-5 text-destructive" />
        <h2 className="font-display text-base sm:text-lg font-bold tracking-widest">
          HEARTS & STATUS
        </h2>
        </div>
        {onAthleteSelect && (
          <span className="text-[10px] sm:text-xs text-muted-foreground font-display tracking-widest">
            TAP ATHLETE FOR DETAILS
          </span>
        )}
      </div>

      {/* Athletes Grid */}
      <div className="divide-y-2 divide-border/30">
        {athletes.map((athlete) => {
          const config = statusConfig[athlete.status];
          const StatusIcon = config.icon;
          const safeTarget = Math.max(1, athlete.weeklyTarget || 1);
          const progressPercent = Math.min((athlete.weeklyProgress / safeTarget) * 100, 100);
          const isEliminated = athlete.status === "eliminated";

          const content = (
              <div className={`p-4 transition-colors ${onAthleteSelect ? "hover:bg-muted/20 active:bg-muted/30" : ""} ${isEliminated ? "opacity-50" : ""}`}>
              <div className="flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-center">
                {/* Avatar - Industrial badge */}
                <div className={`w-10 h-10 sm:w-12 sm:h-12 border-2 flex items-center justify-center flex-shrink-0 ${
                  isEliminated ? "bg-muted border-border" : "bg-muted border-primary/40"
                }`}>
                  {athlete.avatarUrl ? (
                    <img
                      src={athlete.avatarUrl}
                      alt={`${athlete.name} avatar`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className={`font-display text-sm sm:text-base font-bold tracking-wider ${
                      isEliminated ? "text-muted-foreground" : "text-primary"
                    }`}>
                      {athlete.initials}
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <span className={`font-display font-bold tracking-wider text-sm sm:text-base truncate ${
                      isEliminated ? "text-muted-foreground line-through" : "text-foreground"
                    }`}>
                      {athlete.name}
                    </span>
                    
                    {/* Status Badge */}
                    <div className={`flex items-center gap-1 px-2 py-0.5 text-[10px] font-display tracking-widest ${config.className}`}>
                      <StatusIcon className="w-3 h-3" />
                      {config.label}
                    </div>
                  </div>

                  {/* Hearts & Progress */}
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1">
                      {Array.from({ length: athlete.maxHearts }).map((_, i) => (
                        <Heart 
                          key={i}
                          className={`w-4 h-4 sm:w-5 sm:h-5 ${
                            i < athlete.hearts 
                              ? "text-destructive fill-destructive" 
                              : "text-muted-foreground/40"
                          }`}
                          style={i < athlete.hearts ? { filter: 'drop-shadow(0 0 3px hsl(var(--destructive) / 0.5))' } : {}}
                        />
                      ))}
                    </div>
                    <span className="text-[11px] sm:text-xs font-display tracking-wider text-foreground/90">
                      {athlete.hearts}/{athlete.maxHearts}
                    </span>
                    
                    <div className="w-px h-4 bg-border hidden sm:block" />
                    
                    {/* Weekly Progress */}
                    <div className="flex items-center gap-2 text-xs">
                      <Target className="w-3.5 h-3.5 text-primary" />
                      <span className="text-muted-foreground font-display tracking-wider">
                        {athlete.weeklyProgress}/{athlete.weeklyTarget}
                      </span>
                      <div className="relative w-16 sm:w-24 h-2.5 sm:h-3 bg-muted/90 border border-border/80 overflow-hidden">
                        <div className="absolute inset-0 bg-[linear-gradient(90deg,hsl(var(--muted))/0.95,hsl(var(--card))/0.95)]" />
                        <div
                          className="relative h-full transition-[width] duration-300 ease-out"
                          style={{
                            width: progressPercent > 0 ? `${Math.max(progressPercent, 8)}%` : "0%",
                            background:
                              progressPercent >= 100
                                ? "linear-gradient(90deg, hsl(var(--status-online) / 0.45), hsl(var(--status-online) / 0.9))"
                                : "linear-gradient(90deg, hsl(var(--primary) / 0.35), hsl(var(--primary) / 0.9))",
                            boxShadow:
                              progressPercent >= 100
                                ? "0 0 10px hsl(var(--status-online) / 0.65)"
                                : "0 0 10px hsl(var(--primary) / 0.65)",
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 text-xs text-muted-foreground truncate font-display tracking-wider">
                    {athlete.quip?.trim() ? athlete.quip : "No quip yet."}
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 sm:min-w-[280px]">
                  <div className="stat-block">
                    <div className="stat-value text-base sm:text-lg">{athlete.totalWorkouts}</div>
                    <div className="stat-label text-[8px] sm:text-[10px]">WORKOUTS</div>
                  </div>
                  <div className="stat-block">
                    <div className="stat-value text-base sm:text-lg flex items-center justify-center gap-1">
                      {athlete.currentStreak}
                      <Flame className="w-3 h-3 text-primary" />
                    </div>
                    <div className="stat-label text-[8px] sm:text-[10px]">STREAK</div>
                  </div>
                  <div className="stat-block">
                    <div className="stat-value text-base sm:text-lg">
                      {athlete.averageWorkoutsPerWeek.toFixed(1)}
                    </div>
                    <div className="stat-label text-[8px] sm:text-[10px]">AVG/WK</div>
                  </div>
                  <div className="stat-block">
                    <div className="stat-value text-base sm:text-lg flex items-center justify-center gap-1">
                      {athlete.longestStreak}
                      <Trophy className="w-3 h-3 text-arena-gold" />
                    </div>
                    <div className="stat-label text-[8px] sm:text-[10px]">BEST</div>
                  </div>
                </div>
              </div>
            </div>
          );

          if (onAthleteSelect) {
            return (
              <button
                key={athlete.id}
                type="button"
                onClick={() => onAthleteSelect(athlete.id)}
                className="w-full text-left"
              >
                {content}
              </button>
            );
          }

          return (
            <div key={athlete.id}>
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}
