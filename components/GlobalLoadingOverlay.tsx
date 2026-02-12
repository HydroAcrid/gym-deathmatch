"use client";

import { useEffect, useRef, useState } from "react";
import { subscribeLoading } from "@/lib/loadingBus";

const SHOW_DELAY_MS = 180;
const MIN_VISIBLE_MS = 260;

export function GlobalLoadingOverlay() {
	const [count, setCount] = useState(0);
	const [visible, setVisible] = useState(false);
	const showTimerRef = useRef<number | null>(null);
	const shownAtRef = useRef<number>(0);

	useEffect(() => subscribeLoading(setCount), []);

	useEffect(() => {
		if (count > 0) {
			if (showTimerRef.current) window.clearTimeout(showTimerRef.current);
			if (!visible) {
				showTimerRef.current = window.setTimeout(() => {
					shownAtRef.current = Date.now();
					setVisible(true);
				}, SHOW_DELAY_MS);
			}
			return;
		}

		if (showTimerRef.current) {
			window.clearTimeout(showTimerRef.current);
			showTimerRef.current = null;
		}
		if (!visible) return;

		const elapsed = Date.now() - shownAtRef.current;
		const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed);
		const hideTimer = window.setTimeout(() => setVisible(false), remaining);
		return () => window.clearTimeout(hideTimer);
	}, [count, visible]);

	if (!visible) return null;

	return (
		<div className="global-loading-overlay" aria-live="polite" aria-busy="true" role="status">
			<div className="arena-square-loader" aria-hidden="true">
				<div className="arena-square-frame" />
				<div className="arena-square-runner" />
				<div className="arena-square-core" />
				<div className="arena-square-scan" />
			</div>
			<div className="arena-loading-label">LOCKING IN...</div>
		</div>
	);
}
