import { useEffect, useState } from "react";
import Link from "next/link";
import { Activity, Zap, AlertTriangle, Trophy, Play, Clock, ChevronRight } from "lucide-react";
import { authFetch } from "@/lib/clientAuth";

type FeedItem = {
	id?: string;
	text?: string | null;
	createdAt?: string;
	player?: { name?: string | null; avatar_url?: string | null };
	type?: string;
};

interface LiveFeedProps {
	lobbyId: string;
}

const eventIcons = {
	workout: Activity,
	penalty: AlertTriangle,
	achievement: Trophy,
	match_start: Play,
	system: Clock,
};

const eventColors = {
	workout: "text-primary",
	penalty: "text-destructive",
	achievement: "text-arena-gold",
	match_start: "text-primary",
	system: "text-muted-foreground",
};

function formatTime(date: Date): string {
	return date.toLocaleTimeString("en-US", {
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	});
}

function formatDate(date: Date): string {
	const now = new Date();
	const isToday = date.toDateString() === now.toDateString();
	if (isToday) return "TODAY";
	const yesterday = new Date(now);
	yesterday.setDate(yesterday.getDate() - 1);
	if (date.toDateString() === yesterday.toDateString()) return "YESTERDAY";
	return date
		.toLocaleDateString("en-US", { month: "short", day: "numeric" })
		.toUpperCase();
}

export function LiveFeed({ lobbyId }: LiveFeedProps) {
	const [items, setItems] = useState<FeedItem[]>([]);

	useEffect(() => {
		let ignore = false;
		async function refresh() {
			try {
				const res = await authFetch(`/api/lobby/${encodeURIComponent(lobbyId)}/feed`, { cache: "no-store" });
				if (!res.ok || ignore) return;
				const data = await res.json();
				setItems(data.items ?? []);
			} catch {
				// ignore
			}
		}
		refresh();
		const id = setInterval(refresh, 30 * 1000);
		return () => {
			ignore = true;
			clearInterval(id);
		};
	}, [lobbyId]);

	return (
		<div className="scoreboard-panel">
			<Link
				href={`/lobby/${encodeURIComponent(lobbyId)}/history`}
				className="flex items-center justify-between p-4 border-b-2 border-border hover:bg-muted/20 transition-colors group touch-target"
			>
				<div className="flex items-center gap-3">
					<Zap className="w-5 h-5 text-primary" />
					<h2 className="font-display text-base sm:text-lg font-bold tracking-widest">
						LIVE ARENA FEED
					</h2>
				</div>
				<div className="flex items-center gap-2">
					<div className="status-dot status-dot-active" />
					<span className="text-[10px] sm:text-xs text-primary uppercase tracking-widest font-display font-bold hidden sm:inline">
						LIVE
					</span>
					<ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
				</div>
			</Link>

			<div className="max-h-[400px] overflow-y-auto">
				{items.length === 0 ? (
					<div className="p-8 text-center text-muted-foreground">
						<Clock className="w-8 h-8 mx-auto mb-3 opacity-50" />
						<p className="font-display uppercase tracking-widest text-sm">AWAITING ACTIVITY</p>
					</div>
				) : (
					<div className="divide-y-2 divide-border/30">
						{items.map((event, index) => {
							const hasPlayer = Boolean(event.player?.name);
							const typeKey = hasPlayer ? "workout" : "system";
							const Icon = eventIcons[typeKey];
							const colorClass = eventColors[typeKey];
							const stamp = event.createdAt ? new Date(event.createdAt) : new Date();
							return (
								<div
									key={event.id || `feed-${event.createdAt}-${(event.text ?? "").slice(0, 20)}`}
									className="feed-event animate-feed-slide p-4 active:bg-muted/30"
									style={{ animationDelay: `${index * 50}ms` }}
								>
									<div className="flex items-start gap-3">
										<Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${colorClass}`} />
										<div className="flex-1 min-w-0">
											<p className="text-sm text-foreground">
												{event.player?.name && (
													<span className="font-display font-bold text-primary tracking-wider">
														{event.player.name}
													</span>
												)}{" "}
												<span className="text-foreground/90">{event.text || "Activity logged"}</span>
											</p>
											<div className="flex items-center gap-2 mt-1.5 text-[10px] sm:text-xs text-muted-foreground font-display tracking-wider">
												<span>{formatTime(stamp)}</span>
												<span className="text-border">|</span>
												<span>{formatDate(stamp)}</span>
											</div>
										</div>
									</div>
								</div>
							);
						})}
					</div>
				)}
			</div>

			<Link
				href={`/lobby/${encodeURIComponent(lobbyId)}/history`}
				className="block p-4 text-center text-xs text-muted-foreground hover:text-primary hover:bg-muted/20 transition-colors border-t-2 border-border font-display tracking-widest font-bold touch-target"
			>
				VIEW FULL FEED →
			</Link>
		</div>
	);
}
