import { MapPin, CheckCircle2, Circle } from "lucide-react";

interface AthleteCardProps {
	name: string;
	location?: string;
	avatarUrl?: string;
	ready?: boolean;
	isMe?: boolean;
	onToggleReady?: () => void;
	readyBusy?: boolean;
	stravaConnected?: boolean;
	quip?: string;
	actionLabel?: string;
	actionHref?: string;
}

export function AthleteCard({
	name,
	location,
	avatarUrl,
	ready = false,
	isMe = false,
	onToggleReady,
	readyBusy = false,
	stravaConnected = false,
	quip,
	actionLabel,
	actionHref,
}: AthleteCardProps) {
	const readyTone = ready
		? "text-[hsl(var(--status-online))] border-[hsl(var(--status-online))/0.4] bg-[hsl(var(--status-online))/0.12]"
		: "text-muted-foreground border-border bg-muted/20";
	const readyLabel = ready ? "READY" : "NOT READY";
	const stravaLabel = stravaConnected ? "CONNECTED" : "OPTIONAL";

	return (
		<div className="athlete-card p-4 sm:p-5">
			<div className="flex items-start justify-between mb-3 sm:mb-4">
				<div className="flex items-center gap-3 min-w-0">
					<div className="relative">
						<div className="w-12 h-12 sm:w-14 sm:h-14 bg-muted border-2 border-border flex items-center justify-center overflow-hidden">
							{avatarUrl ? (
								<img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
							) : (
								<span className="text-xl sm:text-2xl font-display font-bold text-muted-foreground">
									{name.charAt(0)}
								</span>
							)}
						</div>
					</div>
					<div className="min-w-0">
						<h3 className="font-display text-base sm:text-lg font-bold text-foreground tracking-wider truncate">
							{name}
						</h3>
						<div className="flex items-center gap-1 text-[10px] sm:text-xs text-muted-foreground font-display tracking-wider">
							<MapPin className="w-3 h-3" />
							<span className="truncate">{location || "—"}</span>
						</div>
					</div>
				</div>

				<div className="flex items-center gap-2">
					<div className={`arena-badge text-[10px] ${readyTone}`}>
						{ready ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <Circle className="w-3 h-3 mr-1" />}
						{readyLabel}
					</div>
				</div>
			</div>

			<div className="arena-divider-solid mb-3 sm:mb-4" />

			<div className="grid grid-cols-2 gap-2">
				<div className="stat-block">
					<div className="stat-value text-base sm:text-lg">{readyLabel}</div>
					<div className="stat-label">STATUS</div>
				</div>
				<div className="stat-block">
					<div className="stat-value text-base sm:text-lg">{stravaLabel}</div>
					<div className="stat-label">STRAVA</div>
				</div>
			</div>

			{quip ? (
				<div className="mt-3 text-xs text-muted-foreground italic truncate">“{quip}”</div>
			) : null}

			<div className="mt-3 flex flex-wrap items-center gap-2">
				{actionLabel && actionHref ? (
					<a href={actionHref} className="inline-flex text-xs text-primary underline">
						{actionLabel}
					</a>
				) : null}
				{isMe && onToggleReady ? (
					<button
						type="button"
						onClick={onToggleReady}
						disabled={readyBusy}
						className="arena-badge arena-badge-primary px-2.5 py-1.5 text-[10px] disabled:opacity-60"
					>
						{readyBusy ? "Saving..." : ready ? "Mark not ready" : "I'm ready"}
					</button>
				) : null}
			</div>
		</div>
	);
}
