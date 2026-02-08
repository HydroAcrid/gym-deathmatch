import { 
  Radio, Trophy, AlertTriangle, Coins, Flag, CheckCircle2,
  XCircle, Swords, Calendar, Heart, Skull
} from "lucide-react";

type SystemEventType = 
  | "arena_open" | "season_start" | "season_end" | "week_end"
  | "ante_collected" | "workout_approved" | "workout_rejected"
  | "workout_invalidated" | "penalty" | "elimination"
  | "achievement" | "sudden_death" | "champion";

interface FeedSystemEventProps {
  id: string;
  type: SystemEventType;
  message: string;
  timestamp: Date;
  details?: string;
}

const eventConfig: Record<SystemEventType, { 
  icon: typeof Radio; 
  className: string;
  borderClass: string;
}> = {
  arena_open: { icon: Swords, className: "text-primary", borderClass: "border-primary/40" },
  season_start: { icon: Flag, className: "text-primary", borderClass: "border-primary/40" },
  season_end: { icon: Calendar, className: "text-muted-foreground", borderClass: "border-border" },
  week_end: { icon: Calendar, className: "text-muted-foreground", borderClass: "border-border" },
  ante_collected: { icon: Coins, className: "text-arena-gold", borderClass: "border-arena-gold/40" },
  workout_approved: { icon: CheckCircle2, className: "text-[hsl(var(--status-online))]", borderClass: "border-[hsl(var(--status-online))]/40" },
  workout_rejected: { icon: XCircle, className: "text-destructive", borderClass: "border-destructive/40" },
  workout_invalidated: { icon: AlertTriangle, className: "text-destructive", borderClass: "border-destructive/40" },
  penalty: { icon: AlertTriangle, className: "text-destructive", borderClass: "border-destructive/40" },
  elimination: { icon: Skull, className: "text-destructive", borderClass: "border-destructive/40" },
  achievement: { icon: Trophy, className: "text-arena-gold", borderClass: "border-arena-gold/40" },
  sudden_death: { icon: Heart, className: "text-destructive", borderClass: "border-destructive/40" },
  champion: { icon: Trophy, className: "text-arena-gold", borderClass: "border-arena-gold/40" }
};

function formatTimestamp(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function FeedSystemEvent({ type, message, timestamp, details }: FeedSystemEventProps) {
  const config = eventConfig[type];
  const Icon = config.icon;

  return (
    <div className={`p-4 border-l-4 bg-muted/20 ${config.borderClass}`}>
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 ${config.className}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-display tracking-wide">
            <span className={config.className}>{message}</span>
          </p>
          {details && <p className="text-xs text-muted-foreground mt-1">{details}</p>}
          <p className="text-xs text-muted-foreground mt-1">{formatTimestamp(timestamp)}</p>
        </div>
      </div>
    </div>
  );
}
