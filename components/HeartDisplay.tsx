"use client";

import { Heart } from "lucide-react";

export interface HeartDisplayProps {
  lives: number;
  maxLives?: number;
  size?: "sm" | "md" | "lg";
  showCount?: boolean;
}

export function HeartDisplay({
  lives,
  maxLives = 3,
  size = "md",
  showCount = false,
}: HeartDisplayProps) {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-6 h-6",
  };

  const hearts = Array.from({ length: maxLives }, (_, i) => i < lives);

  return (
    <div className="flex items-center gap-1">
      {hearts.map((filled, index) => (
        <Heart
          key={index}
          className={`${sizeClasses[size]} ${
            filled
              ? "fill-destructive text-destructive"
              : "fill-muted text-muted-foreground/30"
          } transition-colors`}
          style={filled ? { filter: 'drop-shadow(0 0 3px hsl(var(--destructive) / 0.5))' } : {}}
        />
      ))}
      {showCount && (
        <span className="font-mono text-xs text-muted-foreground ml-1">
          {lives}/{maxLives}
        </span>
      )}
      {lives === 1 && (
        <span className="text-[10px] text-destructive ml-1 font-display tracking-wider">ON THIN ICE</span>
      )}
    </div>
  );
}
