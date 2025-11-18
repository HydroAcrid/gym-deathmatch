"use client";

type StatusType = "approved" | "pending" | "rejected" | "online" | "offline" | "ready" | "not-ready";

interface StatusPillProps {
	status: StatusType;
	className?: string;
}

export function StatusPill({ status, className = "" }: StatusPillProps) {
	const baseStyles = "inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-medium";
	
	const statusStyles: Record<StatusType, string> = {
		approved: "bg-green-500/20 text-green-700 dark:text-green-400 border border-green-500/30",
		pending: "bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30",
		rejected: "bg-red-500/20 text-red-700 dark:text-red-400 border border-red-500/30",
		online: "bg-green-500/20 text-green-700 dark:text-green-400 border border-green-500/30",
		offline: "bg-red-500/20 text-red-700 dark:text-red-400 border border-red-500/30",
		ready: "bg-green-500/20 text-green-700 dark:text-green-400 border border-green-500/30",
		"not-ready": "bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30"
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

