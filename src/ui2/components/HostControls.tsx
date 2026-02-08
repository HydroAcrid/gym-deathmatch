import { Shield, Play, Pause, Calendar, Settings, AlertTriangle, StopCircle, Flag } from "lucide-react";
import { Button } from "../ui/button";

interface HostControlsProps {
  isHost: boolean;
  matchStatus: "AWAITING_HOST" | "ARMED" | "ACTIVE" | "COMPLETED";
  onArm?: () => void;
  onStart?: () => void;
  onPause?: () => void;
  onEndSeason?: () => void;
  onSchedule?: () => void;
  onSettings?: () => void;
}

export function HostControls({ 
  isHost, 
  matchStatus, 
  onArm, 
  onStart, 
  onPause,
  onEndSeason,
  onSchedule,
  onSettings 
}: HostControlsProps) {
  if (!isHost) return null;

  const isActive = matchStatus === "ACTIVE";
  const isPreStage = matchStatus === "AWAITING_HOST" || matchStatus === "ARMED";

  return (
    <div className="scoreboard-panel">
      {/* Header - Restricted access styling */}
      <div className="flex items-center gap-3 p-4 border-b-2 border-destructive/30 bg-gradient-to-r from-destructive/10 via-destructive/5 to-transparent">
        <Shield className="w-5 h-5 text-destructive" />
        <h2 className="font-display text-base sm:text-lg font-bold tracking-widest">
          HOST CONTROLS
        </h2>
        <span className="arena-badge arena-badge-destructive ml-auto text-[10px]">
          RESTRICTED
        </span>
      </div>

      {/* Controls */}
      <div className="p-4 space-y-4">
        {/* Status indicator - Industrial readout */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground uppercase tracking-widest font-display text-[10px] sm:text-xs">
            MATCH STATUS
          </span>
          <span className={`font-display font-bold tracking-wider text-sm sm:text-base ${
            matchStatus === "ACTIVE" ? "text-primary" :
            matchStatus === "ARMED" ? "text-arena-gold" :
            matchStatus === "COMPLETED" ? "text-muted-foreground" :
            "text-muted-foreground"
          }`}>
            {matchStatus.replace("_", " ")}
          </span>
        </div>

        <div className="arena-divider-heavy" />

        {/* Action buttons - Pre-Stage */}
        {isPreStage && (
          <div className="flex flex-col gap-3">
            {matchStatus === "AWAITING_HOST" && (
              <Button 
                variant="arenaPrimary" 
                className="w-full h-12 touch-target-lg"
                onClick={onArm}
              >
                <AlertTriangle className="w-4 h-4 mr-2" />
                ARM DEATHMATCH
              </Button>
            )}

            {matchStatus === "ARMED" && (
              <Button 
                variant="arenaPrimary" 
                className="w-full h-12 touch-target-lg"
                onClick={onStart}
              >
                <Play className="w-4 h-4 mr-2" />
                COMMENCE DEATHMATCH
              </Button>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" onClick={onSchedule} className="h-11 touch-target">
                <Calendar className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">SCHEDULE</span>
              </Button>

              <Button variant="outline" onClick={onSettings} className="h-11 touch-target">
                <Settings className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">SETTINGS</span>
              </Button>
            </div>
          </div>
        )}

        {/* Action buttons - Active Season */}
        {isActive && (
          <div className="space-y-3">
            <Button 
              variant="outline" 
              className="w-full h-12 touch-target-lg"
              onClick={onPause}
            >
              <Pause className="w-4 h-4 mr-2" />
              SUSPEND MATCH
            </Button>

            <Button 
              variant="destructive" 
              className="w-full h-12 touch-target-lg"
              onClick={onEndSeason}
            >
              <StopCircle className="w-4 h-4 mr-2" />
              END SEASON EARLY
            </Button>

            <Button variant="outline" onClick={onSettings} className="w-full h-11 touch-target">
              <Settings className="w-4 h-4 mr-2" />
              SETTINGS
            </Button>
          </div>
        )}

        {/* Completed State */}
        {matchStatus === "COMPLETED" && (
          <div className="text-center py-6">
            <Flag className="w-10 h-10 mx-auto text-arena-gold mb-3" 
                  style={{ filter: 'drop-shadow(0 0 8px hsl(var(--arena-gold) / 0.5))' }} />
            <p className="font-display text-sm tracking-widest text-muted-foreground font-bold">
              SEASON COMPLETE
            </p>
          </div>
        )}

        {/* Warning - only in pre-stage */}
        {isPreStage && (
          <div className="arena-warning mt-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-destructive" />
              <p className="text-[10px] sm:text-xs text-destructive uppercase tracking-wider leading-relaxed font-display">
                HOST ACTIONS ARE FINAL. ONCE COMMENCED, THE DEATHMATCH CANNOT BE REVERSED.
              </p>
            </div>
          </div>
        )}

        {/* Active season warning */}
        {isActive && (
          <div className="arena-info mt-4">
            <div className="flex items-start gap-3">
              <Flag className="w-4 h-4 flex-shrink-0 mt-0.5 text-primary" />
              <p className="text-[10px] sm:text-xs text-primary uppercase tracking-wider leading-relaxed font-display">
                THE ARENA IS LIVE. ALL ACTIONS HAVE CONSEQUENCES.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
