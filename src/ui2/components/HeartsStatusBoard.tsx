import { Heart, Target, CheckCircle2, AlertTriangle, Skull } from "lucide-react";

type AthleteStatus = "safe" | "at_risk" | "eliminated";

export interface AthleteHeartStatus {
  name: string;
  initials: string;
  avatarUrl?: string | null;
  hearts: number;
  maxHearts: number;
  weeklyTarget: number;
  weeklyProgress: number;
  status: AthleteStatus;
}

interface HeartsStatusBoardProps {
  athletes: AthleteHeartStatus[];
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

export function HeartsStatusBoard({ athletes }: HeartsStatusBoardProps) {
  return (
    <div className="scoreboard-panel">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b-2 border-border">
        <Heart className="w-5 h-5 text-destructive" />
        <h2 className="font-display text-base sm:text-lg font-bold tracking-widest">
          HEARTS & STATUS
        </h2>
      </div>

      {/* Athletes Grid */}
      <div className="divide-y-2 divide-border/30">
        {athletes.map((athlete) => {
          const config = statusConfig[athlete.status];
          const StatusIcon = config.icon;
          const progressPercent = Math.min((athlete.weeklyProgress / athlete.weeklyTarget) * 100, 100);
          const isEliminated = athlete.status === "eliminated";

          return (
            <div 
              key={athlete.name}
              className={`p-4 transition-colors hover:bg-muted/20 ${isEliminated ? "opacity-50" : ""}`}
            >
              <div className="flex items-center gap-3 sm:gap-4">
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
                      <Target className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-muted-foreground font-display tracking-wider">
                        {athlete.weeklyProgress}/{athlete.weeklyTarget}
                      </span>
                      <div className="w-14 sm:w-20 h-2 bg-muted border border-border overflow-hidden">
                        <div 
                          className={`h-full transition-all ${
                            progressPercent >= 100 
                              ? "bg-[hsl(var(--status-online))]" 
                              : progressPercent >= 50 
                                ? "bg-primary" 
                                : "bg-destructive"
                          }`}
                          style={{ 
                            width: `${progressPercent}%`,
                            boxShadow: progressPercent >= 100 
                              ? '0 0 6px hsl(var(--status-online) / 0.6)' 
                              : progressPercent >= 50 
                                ? '0 0 6px hsl(var(--primary) / 0.4)' 
                                : '0 0 6px hsl(var(--destructive) / 0.4)'
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
