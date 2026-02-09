"use client";

type StatusBadgeProps = {
	status: "online" | "offline" | "ready" | "not-ready" | "connected";
	className?: string;
};

const statusConfig: Record<string, { label: string; dotClass: string; textClass: string }> = {
	online: { label: "ONLINE", dotClass: "status-dot status-dot-online", textClass: "text-[hsl(var(--status-online))]" },
	connected: { label: "ONLINE", dotClass: "status-dot status-dot-online", textClass: "text-[hsl(var(--status-online))]" },
	ready: { label: "READY", dotClass: "status-dot status-dot-active", textClass: "text-[hsl(var(--status-active))]" },
	"not-ready": { label: "NOT READY", dotClass: "status-dot status-dot-offline", textClass: "text-muted-foreground" },
	offline: { label: "OFFLINE", dotClass: "status-dot status-dot-offline", textClass: "text-muted-foreground" },
};

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
	const config = statusConfig[status] ?? statusConfig.offline;
	return (
		<span className={`arena-badge inline-flex items-center gap-1.5 ${className}`}>
			<span className={config.dotClass} />
			<span className={`font-display text-[0.6rem] tracking-widest ${config.textClass}`}>{config.label}</span>
		</span>
	);
}
