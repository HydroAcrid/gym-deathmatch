"use client";

import { useState } from "react";
import { 
  Dumbbell, Clock, CheckCircle2, XCircle, AlertTriangle,
  MessageSquare, ChevronDown, ChevronUp, Send, Trash2, Shield, Timer, Route, X
} from "lucide-react";
import { Button } from "../ui/button";

interface Comment {
  id: string;
  author: string;
  content: string;
  timestamp: Date;
}

export interface WorkoutFeedPostProps {
  id: string;
  athlete: { name: string; initials: string; };
  timestamp: Date;
  title: string;
  description?: string;
  duration?: number;
  distance?: number;
  activityType: string;
  imageUrl?: string;
  status: "approved" | "pending" | "rejected";
  susVotes: number;
  totalVoters: number;
  hasVoted?: boolean;
  isOwner?: boolean;
  isSelf?: boolean;
  comments: Comment[];
  onVoteSus?: () => void;
  onApprove?: () => void;
  onReject?: () => void;
  onAddComment?: (content: string) => void;
  onDeleteComment?: (commentId: string) => void;
}

const activityLabels: Record<string, string> = {
  gym: "STRENGTH", run: "RUN", cycle: "CYCLE", swim: "SWIM",
  yoga: "YOGA", hiit: "HIIT", other: "WORKOUT"
};

const statusConfig = {
  approved: { 
    label: "APPROVED", 
    className: "bg-[hsl(var(--status-online))]/20 text-[hsl(var(--status-online))] border-[hsl(var(--status-online))]/30",
    icon: CheckCircle2
  },
  pending: { 
    label: "PENDING", 
    className: "bg-primary/20 text-primary border-primary/30",
    icon: Clock
  },
  rejected: { 
    label: "REJECTED", 
    className: "bg-destructive/20 text-destructive border-destructive/30",
    icon: XCircle
  }
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

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}min`;
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
}

export function WorkoutFeedPost({
  athlete, timestamp, title, description, duration, distance,
  activityType, imageUrl, status, susVotes, totalVoters,
  hasVoted = false, isOwner = false, isSelf = false, comments,
  onVoteSus, onApprove, onReject, onAddComment, onDeleteComment
}: WorkoutFeedPostProps) {
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [expandedImage, setExpandedImage] = useState(false);

  const statusInfo = statusConfig[status];
  const StatusIcon = statusInfo.icon;
  const susPercentage = totalVoters > 0 ? Math.round((susVotes / totalVoters) * 100) : 0;
  const isFlagged = susVotes > totalVoters / 2 && totalVoters > 0;

  const handleSubmitComment = () => {
    if (newComment.trim() && onAddComment) {
      onAddComment(newComment.trim());
      setNewComment("");
    }
  };

  return (
    <div className={`scoreboard-panel overflow-hidden ${isFlagged && status === "pending" ? "border-destructive/50" : ""}`}>
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-muted border border-border flex items-center justify-center flex-shrink-0">
              <span className="font-display text-sm sm:text-base font-bold text-primary">
                {athlete.initials}
              </span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-display font-bold text-primary text-sm sm:text-base truncate">
                  {athlete.name}
                </span>
                <span className="arena-badge text-[10px]">
                  {activityLabels[activityType] || "WORKOUT"}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">{formatTimestamp(timestamp)}</span>
            </div>
          </div>
          <div className={`flex items-center gap-1 px-2 py-1 text-[10px] sm:text-xs font-display tracking-wider border flex-shrink-0 ${statusInfo.className}`}>
            <StatusIcon className="w-3 h-3" />
            <span className="hidden sm:inline">{statusInfo.label}</span>
          </div>
        </div>
      </div>

      {/* Media */}
      {imageUrl && (
        <>
          <div className="relative cursor-pointer bg-muted/50 active:opacity-90" onClick={() => setExpandedImage(true)}>
            <img src={imageUrl} alt="Workout evidence" className="w-full object-cover max-h-64 sm:max-h-80" />
            <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-card to-transparent flex items-end justify-center pb-2">
              <span className="text-xs text-muted-foreground font-display tracking-wider">TAP TO EXPAND</span>
            </div>
          </div>
          {expandedImage && (
            <div className="fixed inset-0 z-50 bg-background/95 flex items-center justify-center p-4" onClick={() => setExpandedImage(false)}>
              <button className="absolute top-4 right-4 p-2 bg-muted rounded-full touch-target-lg" onClick={() => setExpandedImage(false)}>
                <X className="w-6 h-6" />
              </button>
              <img src={imageUrl} alt="Workout evidence" className="max-w-full max-h-full object-contain" />
            </div>
          )}
        </>
      )}

      {/* Content */}
      <div className="p-4 border-b border-border">
        <h3 className="font-display text-base sm:text-lg font-bold tracking-wide mb-1">{title}</h3>
        {description && <p className="text-sm text-muted-foreground mb-3">{description}</p>}
        <div className="flex flex-wrap gap-4 text-sm">
          {duration && (
            <div className="flex items-center gap-1.5 text-foreground">
              <Timer className="w-4 h-4 text-muted-foreground" />
              <span className="font-display">{formatDuration(duration)}</span>
            </div>
          )}
          {distance && (
            <div className="flex items-center gap-1.5 text-foreground">
              <Route className="w-4 h-4 text-muted-foreground" />
              <span className="font-display">{distance}km</span>
            </div>
          )}
        </div>
      </div>

      {/* Voting Section */}
      <div className="p-4 bg-muted/30 border-b border-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {!isSelf && status === "pending" && (
              <Button variant="ghost" size="sm" onClick={onVoteSus} disabled={hasVoted}
                className={`font-display tracking-wider text-xs h-10 touch-target ${
                  hasVoted ? "text-destructive border-destructive/30" : "text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                }`}>
                <AlertTriangle className="w-4 h-4 mr-2" />FEELS SUS
              </Button>
            )}
            {susVotes > 0 && (
              <div className={`flex items-center gap-2 text-xs ${susPercentage >= 50 ? "text-destructive" : "text-muted-foreground"}`}>
                <span className="font-display">{susPercentage}% SUS</span>
                <span className="text-muted-foreground">({susVotes}/{totalVoters})</span>
              </div>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={() => setShowComments(!showComments)}
            className="font-display tracking-wider text-xs h-10 touch-target text-muted-foreground hover:text-foreground w-full sm:w-auto justify-center">
            <MessageSquare className="w-4 h-4 mr-2" />
            {comments.length > 0 ? `${comments.length} COMMENTS` : "COMMENT"}
            {showComments ? <ChevronUp className="w-4 h-4 ml-2" /> : <ChevronDown className="w-4 h-4 ml-2" />}
          </Button>
        </div>
        {isFlagged && status === "pending" && (
          <div className="mt-3 p-3 bg-destructive/10 border border-destructive/30 text-destructive text-xs font-display tracking-wider">
            FLAGGED — MAJORITY VOTE REACHED. AWAITING OWNER DECISION.
          </div>
        )}
      </div>

      {/* Owner Controls */}
      {isOwner && status === "pending" && (
        <div className="p-4 bg-secondary/50 border-b border-border">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-primary" />
            <span className="font-display text-xs tracking-wider text-primary">OWNER OVERRIDE</span>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button size="lg" onClick={onApprove}
              className="flex-1 font-display tracking-wider text-xs h-12 touch-target-lg bg-[hsl(var(--status-online))] hover:bg-[hsl(var(--status-online))]/80 text-foreground">
              <CheckCircle2 className="w-4 h-4 mr-2" />APPROVE
            </Button>
            <Button size="lg" variant="destructive" onClick={onReject}
              className="flex-1 font-display tracking-wider text-xs h-12 touch-target-lg">
              <XCircle className="w-4 h-4 mr-2" />REJECT
            </Button>
          </div>
        </div>
      )}

      {/* Comments Section */}
      {showComments && (
        <div className="p-4">
          <div className="text-xs font-display tracking-wider text-muted-foreground mb-3">DISCUSSION THREAD</div>
          {comments.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">No comments yet — be the first.</div>
          ) : (
            <div className="space-y-3 mb-4">
              {comments.map((comment) => (
                <div key={comment.id} className="bg-muted/30 p-3 border-l-2 border-border">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-display text-sm text-primary">{comment.author}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{formatTimestamp(comment.timestamp)}</span>
                      {onDeleteComment && (
                        <button onClick={() => onDeleteComment(comment.id)} className="text-muted-foreground hover:text-destructive transition-colors p-1 touch-target">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-foreground">{comment.content}</p>
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-2">
            <textarea value={newComment} onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add to discussion..." className="min-h-[80px] sm:min-h-[60px] text-sm bg-muted border border-border resize-none flex-1 p-2" />
            <Button size="lg" onClick={handleSubmitComment} disabled={!newComment.trim()}
              className="font-display tracking-wider h-12 sm:h-auto sm:self-end touch-target-lg">
              <Send className="w-4 h-4 sm:mr-0 mr-2" /><span className="sm:hidden">SEND</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
