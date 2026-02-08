"use client";

type StatusType = "approved" | "pending" | "rejected" | "online" | "offline" | "ready" | "not-ready";

interface StatusPillProps {
	status: StatusType;
	className?: string;
}

export function StatusPill({ status, className = "" }: StatusPillProps) {
	const baseStyles = "inline-flex items-center justify-center px-2.5 py-1 rounded-full text-[10px] font-display tracking-widest uppercase border";
	
	const statusStyles: Record<StatusType, string> = {
		approved: "bg-[hsl(var(--status-online))]/20 text-[hsl(var(--status-online))] border-[hsl(var(--status-online))]/40",
		pending: "bg-primary/20 text-primary border-primary/40",
		rejected: "bg-destructive/20 text-destructive border-destructive/40",
		online: "bg-[hsl(var(--status-online))]/20 text-[hsl(var(--status-online))] border-[hsl(var(--status-online))]/40",
		offline: "bg-destructive/20 text-destructive border-destructive/40",
		ready: "bg-[hsl(var(--status-online))]/20 text-[hsl(var(--status-online))] border-[hsl(var(--status-online))]/40",
		"not-ready": "bg-muted/30 text-muted-foreground border-border"
	};
	
	const labels: Record<StatusType, string> = {
		approved: "Approved",
		pending: "Pending vote",
		rejected: "Rejected",
		online: "Online",
		offline: "Offline",
		ready: "Ready",
		"not-ready": "Not ready"
	};
	
	const combinedClassName = `${baseStyles} ${statusStyles[status]} ${className}`.trim();
	
	return (
		<span className={combinedClassName}>
			{labels[status]}
		</span>
	);
}

