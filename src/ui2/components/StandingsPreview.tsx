import type { ArenaStandingsPreviewEntry } from "@/src/ui2/adapters/arenaCommandCenter";

interface StandingsPreviewProps {
	entries: ArenaStandingsPreviewEntry[];
	myRank: ArenaStandingsPreviewEntry | null;
	totalAthletes: number;
}

function renderRankColor(rank: number): string {
	if (rank === 1) return "text-arena-gold";
	if (rank === 2) return "text-foreground";
	if (rank === 3) return "text-primary";
	return "text-muted-foreground";
}

export function StandingsPreview({ entries, myRank, totalAthletes }: StandingsPreviewProps) {
	return (
		<div className="border-2 border-border bg-card/50">
			<div className="flex items-center justify-between gap-2 border-b-2 border-border px-3 py-2">
				<div className="font-display text-xs tracking-widest text-muted-foreground">STANDINGS PREVIEW</div>
				<div className="font-display text-[10px] tracking-widest text-muted-foreground">{totalAthletes} ATHLETES</div>
			</div>

			{entries.length === 0 ? (
				<div className="px-3 py-4 text-xs text-muted-foreground">Standings are not available yet.</div>
			) : (
				<div className="divide-y divide-border/60">
					{entries.map((entry) => (
						<div
							key={`${entry.athleteId ?? entry.athleteName}-${entry.rank}`}
							className={`flex items-center justify-between gap-2 px-3 py-2 ${
								entry.isCurrentUser ? "bg-primary/10" : ""
							}`}
						>
							<div className="min-w-0 flex items-center gap-2">
								<div className={`font-display text-sm ${renderRankColor(entry.rank)}`}>#{entry.rank}</div>
								<div className="truncate font-display text-xs tracking-wider text-foreground">
									{entry.athleteName}
									{entry.isCurrentUser ? " (YOU)" : ""}
								</div>
							</div>
							<div className="shrink-0 font-display text-xs tracking-wider text-primary">{entry.points} PTS</div>
						</div>
					))}
				</div>
			)}

			{myRank && !entries.some((entry) => entry.isCurrentUser) ? (
				<div className="border-t-2 border-border bg-muted/20 px-3 py-2">
					<div className="font-display text-[10px] tracking-widest text-muted-foreground">YOUR POSITION</div>
					<div className="mt-1 flex items-center justify-between gap-2">
						<div className="min-w-0 truncate font-display text-xs tracking-wider text-foreground">
							#{myRank.rank} {myRank.athleteName}
						</div>
						<div className="shrink-0 font-display text-xs tracking-wider text-primary">{myRank.points} PTS</div>
					</div>
				</div>
			) : null}
		</div>
	);
}
