import { MapPin } from "lucide-react";

interface AthleteCardProps {
	name: string;
	location?: string;
	avatarUrl?: string;
	status: "online" | "offline" | "active";
	streak: number;
	quip?: string;
	actionLabel?: string;
	actionHref?: string;
}

export function AthleteCard({
	name,
	location,
	avatarUrl,
	status,
	streak,
	quip,
	actionLabel,
	actionHref,
}: AthleteCardProps) {
	const statusDotClass = {
		online: "status-dot-online",
		offline: "status-dot-offline",
		active: "status-dot-active",
	}[status];

	const statusLabel = {
		online: "ONLINE",
		offline: "OFFLINE",
		active: "ACTIVE",
	}[status];

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
					<div className={`status-dot ${statusDotClass}`} />
					<span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-widest font-display">
						{statusLabel}
					</span>
				</div>
			</div>

			<div className="arena-divider-solid mb-3 sm:mb-4" />

			<div className="grid grid-cols-2 gap-2">
				<div className="stat-block">
					<div className="stat-value">{streak}</div>
					<div className="stat-label">STREAK</div>
				</div>
				<div className="stat-block">
					<div className="stat-value">{streak > 0 ? "🔥" : "—"}</div>
					<div className="stat-label">STATUS</div>
				</div>
			</div>

			{quip ? (
				<div className="mt-3 text-xs text-muted-foreground italic truncate">“{quip}”</div>
			) : null}

			{actionLabel && actionHref ? (
				<a href={actionHref} className="mt-3 inline-flex text-xs text-primary underline">
					{actionLabel}
				</a>
			) : null}
		</div>
	);
}
