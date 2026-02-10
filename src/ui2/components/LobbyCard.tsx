import Link from "next/link";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { DollarSign, Heart, Target, Users, Settings, LogOut, Play } from "lucide-react";
import { formatLocalDate } from "@/lib/datetime";

export interface LobbyCardData {
	id: string;
	name: string;
	seasonNumber: number;
	stage: "pre_stage" | "active" | "completed" | "transition_spin";
	mode: "MONEY_SURVIVAL" | "MONEY_LAST_MAN" | "CHALLENGE_ROULETTE" | "CHALLENGE_CUMULATIVE";
	cashPool: number;
	weeklyTarget?: number;
	initialLives?: number;
	playerCount?: number;
	isOwner: boolean;
	seasonStart?: string;
	seasonEnd?: string;
	createdAgo?: string | null;
}

export interface LobbyCardProps {
	lobby: LobbyCardData;
	onLeave?: (lobbyId: string) => void;
	onEdit?: (lobbyId: string) => void;
	showLeave?: boolean;
}

const stageLabels: Record<
	string,
	{ label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
	pre_stage: { label: "PRE-STAGE", variant: "secondary" },
	active: { label: "ACTIVE", variant: "default" },
	completed: { label: "COMPLETED", variant: "outline" },
	transition_spin: { label: "SPINNING", variant: "destructive" },
};

const modeLabels: Record<string, string> = {
	MONEY_SURVIVAL: "SURVIVAL",
	MONEY_LAST_MAN: "LAST MAN",
	CHALLENGE_ROULETTE: "ROULETTE",
	CHALLENGE_CUMULATIVE: "CUMULATIVE",
};

export function LobbyCard({ lobby, onLeave, onEdit, showLeave }: LobbyCardProps) {
	const stageInfo = stageLabels[lobby.stage] || stageLabels.active;
	const modeLabel = modeLabels[lobby.mode] || lobby.mode;
	const isMoney = lobby.mode.startsWith("MONEY_");

	return (
		<Card className="arena-panel hover:border-primary/50 transition-colors min-w-0">
			<CardContent className="p-4 space-y-4">
				<div className="flex items-start justify-between gap-2">
					<div className="min-w-0">
						<h3 className="font-display text-xl uppercase tracking-wide truncate">{lobby.name}</h3>
						<p className="font-mono text-xs text-muted-foreground">Season {lobby.seasonNumber}</p>
					</div>
					<div className="flex items-center gap-1 shrink-0 flex-wrap justify-end max-w-[55%]">
						<Badge variant={stageInfo.variant} className="font-display text-xs">
							{stageInfo.label}
						</Badge>
						{lobby.isOwner && (
							<Badge variant="outline" className="font-display text-xs text-primary border-primary">
								OWNER
							</Badge>
						)}
					</div>
				</div>

				<div className="grid grid-cols-2 gap-2 text-sm">
					{isMoney && (
						<div className="flex items-center gap-2 p-2 bg-muted/30 border border-border">
							<DollarSign className="w-4 h-4 text-arena-gold" />
							<span className="font-mono">${lobby.cashPool}</span>
						</div>
					)}
					<div className="flex items-center gap-2 p-2 bg-muted/30 border border-border">
						<Target className="w-4 h-4 text-primary" />
						<span className="font-mono">
							{typeof lobby.weeklyTarget === "number" ? `${lobby.weeklyTarget}/wk` : "—"}
						</span>
					</div>
					<div className="flex items-center gap-2 p-2 bg-muted/30 border border-border">
						<Heart className="w-4 h-4 text-destructive" />
						<span className="font-mono">
							{typeof lobby.initialLives === "number" ? `${lobby.initialLives} lives` : "—"}
						</span>
					</div>
					<div className="flex items-center gap-2 p-2 bg-muted/30 border border-border">
						<Users className="w-4 h-4 text-muted-foreground" />
						<span className="font-mono">
							{typeof lobby.playerCount === "number" ? `${lobby.playerCount} players` : "—"}
						</span>
					</div>
				</div>

				<div className="flex flex-wrap items-center gap-2">
					<Badge variant="outline" className="font-display text-xs">
						{modeLabel}
					</Badge>
					{lobby.seasonStart && lobby.seasonEnd && (
						<span className="text-xs text-muted-foreground break-anywhere">
							{formatLocalDate(lobby.seasonStart)} →{" "}
							{formatLocalDate(lobby.seasonEnd)}
						</span>
					)}
				</div>

				{lobby.createdAgo ? (
					<div className="text-[11px] text-muted-foreground">Created {lobby.createdAgo}</div>
				) : null}

				<div className="flex gap-2">
					<Button asChild variant="arenaPrimary" size="sm" className="flex-1">
						<Link href={`/lobby/${lobby.id}`}>
							<Play className="w-4 h-4 mr-1" />
							Open
						</Link>
					</Button>
					{lobby.isOwner && onEdit && (
						<Button variant="outline" size="sm" onClick={() => onEdit(lobby.id)}>
							<Settings className="w-4 h-4" />
						</Button>
					)}
					{showLeave && onLeave && !lobby.isOwner && (
						<Button
							variant="ghost"
							size="sm"
							onClick={() => {
								if (confirm("Are you sure you want to leave this lobby?")) {
									onLeave(lobby.id);
								}
							}}
						>
							<LogOut className="w-4 h-4" />
						</Button>
					)}
				</div>
			</CardContent>
		</Card>
	);
}
