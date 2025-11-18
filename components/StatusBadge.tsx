"use client";

import { StatusPill } from "./ui/StatusPill";

type StatusBadgeProps = {
	status: "online" | "offline" | "ready" | "not-ready" | "connected";
	className?: string;
};

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
	// Map "connected" to "online" for StatusPill
	const pillStatus = status === "connected" ? "online" : status;
	return <StatusPill status={pillStatus as any} className={className} />;
}

