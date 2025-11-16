"use client";

type StatusBadgeProps = {
	status: "online" | "offline" | "ready" | "not-ready" | "connected";
	className?: string;
};

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
	const statusConfig = {
		online: {
			label: "ONLINE",
			classes: "inline-flex items-center px-2 py-[2px] text-xs font-semibold rounded-md bg-green-500/15 dark:bg-green-500/20 text-green-700 dark:text-green-300 border border-green-500/20 dark:border-green-500/30"
		},
		offline: {
			label: "OFFLINE",
			classes: "inline-flex items-center px-2 py-[2px] text-xs font-semibold rounded-md bg-red-500/15 dark:bg-red-500/20 text-red-700 dark:text-red-300 border border-red-500/20 dark:border-red-500/30"
		},
		ready: {
			label: "READY",
			classes: "inline-flex items-center px-2 py-[2px] text-xs font-semibold rounded-md bg-green-500/15 dark:bg-green-500/20 text-green-700 dark:text-green-300 border border-green-500/20 dark:border-green-500/30"
		},
		"not-ready": {
			label: "NOT READY",
			classes: "inline-flex items-center px-2 py-[2px] text-xs font-semibold rounded-md bg-gray-500/15 dark:bg-gray-500/20 text-gray-700 dark:text-gray-300 border border-gray-500/20 dark:border-gray-500/30"
		},
		connected: {
			label: "CONNECTED",
			classes: "inline-flex items-center px-2 py-[2px] text-xs font-semibold rounded-md bg-green-500/15 dark:bg-green-500/20 text-green-700 dark:text-green-300 border border-green-500/20 dark:border-green-500/30"
		}
	};

	const config = statusConfig[status];
	if (!config) return null;

	return (
		<span className={`${config.classes} ${className}`}>
			{config.label}
		</span>
	);
}

