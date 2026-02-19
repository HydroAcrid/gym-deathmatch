import { useState } from "react";
import { Trophy, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { POINTS_FORMULA_TEXT } from "@/lib/points";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/src/ui2/ui/dialog";

export interface Standing {
  athleteId?: string;
  rank: number;
  previousRank?: number;
  athleteName: string;
  avatarUrl?: string | null;
  workouts: number;
  streak: number;
  penalties: number;
  points: number;
}

interface StandingsProps {
  standings: Standing[];
}

function getRankChange(current: number, previous?: number) {
  if (previous === undefined) return null;
  if (current < previous) return "up";
  if (current > previous) return "down";
  return "same";
}

export function Standings({ standings }: StandingsProps) {
  const [helpOpen, setHelpOpen] = useState(false);
  return (
    <div className="scoreboard-panel">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 p-4 border-b-2 border-border">
        <div className="flex items-center gap-3">
          <Trophy className="w-5 h-5 text-arena-gold" 
                  style={{ filter: 'drop-shadow(0 0 4px hsl(var(--arena-gold) / 0.5))' }} />
          <h2 className="font-display text-base sm:text-lg font-bold tracking-widest">
            STANDINGS
          </h2>
        </div>
        <button
          type="button"
          onClick={() => setHelpOpen(true)}
          aria-label="How points are calculated"
          title="How points are calculated"
          className="arena-badge px-2 py-1 text-xs min-h-[32px] sm:min-h-[36px]"
        >
          <span className="flex items-center justify-center w-full h-full">?</span>
        </button>
      </div>

      {/* Table Header - Hidden on mobile */}
      <div className="hidden sm:grid grid-cols-12 gap-2 px-4 py-3 bg-muted/50 border-b-2 border-border text-[10px] sm:text-xs uppercase tracking-widest text-muted-foreground font-display font-bold">
        <div className="col-span-1">RNK</div>
        <div className="col-span-5">ATHLETE</div>
        <div className="col-span-2 text-center">WKT</div>
        <div className="col-span-2 text-center">STK</div>
        <div className="col-span-2 text-right">PTS</div>
      </div>

      {/* Rows */}
      <div className="divide-y-2 divide-border/30">
        {standings.map((standing) => {
          const rankChange = getRankChange(standing.rank, standing.previousRank);
          const isTop3 = standing.rank <= 3;
          
          return (
            <div 
              key={standing.athleteId ?? standing.athleteName}
              className={`p-4 transition-colors hover:bg-muted/20 active:bg-muted/30 ${
                isTop3 ? 'bg-muted/10' : ''
              }`}
            >
              {/* Mobile Layout */}
              <div className="flex items-center justify-between sm:hidden">
                <div className="flex items-center gap-3">
                  <span 
                    className={`font-display font-bold text-xl w-6 ${
                      standing.rank === 1 ? 'text-arena-gold' : 
                      standing.rank === 2 ? 'text-foreground' :
                      standing.rank === 3 ? 'text-primary' :
                      'text-muted-foreground'
                    }`}
                    style={standing.rank === 1 ? { textShadow: '0 0 10px hsl(var(--arena-gold) / 0.5)' } : {}}
                  >
                    {standing.rank}
                  </span>
                  <div className="w-9 h-9 bg-muted border-2 border-border flex items-center justify-center overflow-hidden">
                    {standing.avatarUrl ? (
                      <img
                        src={standing.avatarUrl}
                        alt={standing.athleteName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-xs font-display font-bold text-muted-foreground">
                        {standing.athleteName.charAt(0)}
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="font-display font-bold text-foreground text-sm block tracking-wider">
                      {standing.athleteName}
                    </span>
                    <div className="flex gap-3 text-[10px] text-muted-foreground font-display tracking-wider">
                      <span>{standing.workouts} WKT</span>
                      <span className="text-primary">{standing.streak} STK</span>
                    </div>
                  </div>
                </div>
                <span 
                  className={`font-display font-bold text-lg ${isTop3 ? 'text-arena-gold' : 'text-foreground'}`}
                  style={isTop3 ? { textShadow: '0 0 10px hsl(var(--arena-gold) / 0.4)' } : {}}
                >
                  {standing.points}
                </span>
              </div>
              
              {/* Desktop Layout */}
              <div className="hidden sm:grid grid-cols-12 gap-2 items-center">
                {/* Rank */}
                <div className="col-span-1 flex items-center gap-1">
                  <span 
                    className={`font-display font-bold text-lg ${
                      standing.rank === 1 ? 'text-arena-gold' : 
                      standing.rank === 2 ? 'text-foreground' :
                      standing.rank === 3 ? 'text-primary' :
                      'text-muted-foreground'
                    }`}
                    style={standing.rank === 1 ? { textShadow: '0 0 10px hsl(var(--arena-gold) / 0.5)' } : {}}
                  >
                    {standing.rank}
                  </span>
                </div>

                {/* Athlete */}
                <div className="col-span-5 flex items-center gap-2">
                  <div className="w-9 h-9 bg-muted border-2 border-border flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {standing.avatarUrl ? (
                      <img
                        src={standing.avatarUrl}
                        alt={standing.athleteName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-sm font-display font-bold text-muted-foreground">
                        {standing.athleteName.charAt(0)}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <span className="font-display font-bold text-foreground truncate block tracking-wider">
                      {standing.athleteName}
                    </span>
                    {standing.penalties > 0 && (
                      <span className="text-[10px] text-destructive uppercase font-display tracking-widest">
                        {standing.penalties} PENALTY
                      </span>
                    )}
                  </div>
                  {rankChange && (
                    <div className="flex-shrink-0">
                      {rankChange === "up" && (
                        <TrendingUp className="w-3.5 h-3.5 text-[hsl(var(--status-online))]" />
                      )}
                      {rankChange === "down" && (
                        <TrendingDown className="w-3.5 h-3.5 text-destructive" />
                      )}
                      {rankChange === "same" && (
                        <Minus className="w-3.5 h-3.5 text-muted-foreground" />
                      )}
                    </div>
                  )}
                </div>

                {/* Workouts */}
                <div className="col-span-2 text-center">
                  <span className="font-display font-bold text-foreground">
                    {standing.workouts}
                  </span>
                </div>

                {/* Streak */}
                <div className="col-span-2 text-center">
                  <span className="font-display font-bold text-primary"
                        style={{ textShadow: '0 0 8px hsl(var(--primary) / 0.3)' }}>
                    {standing.streak}
                  </span>
                </div>

                {/* Points */}
                <div className="col-span-2 text-right">
                  <span 
                    className={`font-display font-bold text-lg ${isTop3 ? 'text-arena-gold' : 'text-foreground'}`}
                    style={isTop3 ? { textShadow: '0 0 10px hsl(var(--arena-gold) / 0.4)' } : {}}
                  >
                    {standing.points}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="w-[95vw] max-w-md border-2 p-5">
          <DialogHeader>
            <DialogTitle className="font-display tracking-widest text-primary text-lg">
              STANDINGS POINTS
            </DialogTitle>
            <DialogDescription>
              {POINTS_FORMULA_TEXT}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              `WKT` = workouts this season.
            </p>
            <p>
              `STK` = current streak.
            </p>
            <p>
              Points bank the best streak reached this season, so a broken streak won&apos;t reduce total points.
            </p>
            <p>
              Penalties subtract from total when enabled.
            </p>
            <div className="pt-1">
              <p className="text-foreground font-display tracking-wider text-xs uppercase">Tie-break order</p>
              <ol className="list-decimal pl-5 space-y-1 mt-1">
                <li>Higher points</li>
                <li>More workouts</li>
                <li>Higher current streak</li>
                <li>Earlier approved workout timestamp this week (if needed)</li>
                <li>Athlete name alphabetical (final fallback)</li>
              </ol>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
