"use client";

import { useEffect, useState } from "react";
import { Calendar, Clock, RefreshCw } from "lucide-react";

interface WeeklyCycleIndicatorProps {
  currentWeek: number;
  totalWeeks: number;
  weekEndDate: Date;
  resetDay: string;
}

function formatTimeRemaining(targetDate: Date): string {
  const now = new Date();
  const diff = targetDate.getTime() - now.getTime();
  
  if (diff <= 0) return "RESETTING...";
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / 1000 / 60) % 60);
  
  if (days > 0) return `${days}D ${hours}H`;
  if (hours > 0) return `${hours}H ${minutes}M`;
  return `${minutes}M`;
}

export function WeeklyCycleIndicator({
  currentWeek,
  totalWeeks,
  weekEndDate,
  resetDay
}: WeeklyCycleIndicatorProps) {
  const [timeRemaining, setTimeRemaining] = useState(formatTimeRemaining(weekEndDate));

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining(formatTimeRemaining(weekEndDate));
    }, 60000);
    return () => clearInterval(timer);
  }, [weekEndDate]);

  const weekProgress = (currentWeek / totalWeeks) * 100;

  return (
    <div className="scoreboard-panel p-4">
      <div className="flex flex-wrap items-center gap-3 sm:gap-4">
        {/* Week Number */}
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" />
          <span className="font-display font-bold text-primary tracking-wider">
            WEEK {currentWeek}
          </span>
          <span className="text-xs text-muted-foreground font-display tracking-wider">
            OF {totalWeeks}
          </span>
        </div>

        {/* Progress Bar - Industrial style */}
        <div className="flex-1 min-w-[100px] h-3 bg-muted border-2 border-border overflow-hidden">
          <div 
            className="h-full bg-primary transition-all"
            style={{ 
              width: `${weekProgress}%`,
              boxShadow: '0 0 8px hsl(var(--primary) / 0.5)'
            }}
          />
        </div>

        {/* Time Remaining */}
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <span className="font-display font-bold text-foreground tracking-wider text-sm sm:text-base"
                style={{ textShadow: '0 0 10px hsl(var(--primary) / 0.3)' }}>
            {timeRemaining}
          </span>
        </div>

        {/* Reset Day */}
        <div className="hidden sm:flex items-center gap-1.5 arena-badge text-[10px]">
          <RefreshCw className="w-3 h-3" />
          <span>RESETS {resetDay}</span>
        </div>
      </div>
    </div>
  );
}
