"use client";

import { useEffect, useRef } from "react";

/**
 * Hook for auto-refreshing data on an interval.
 * Only runs when the tab/app is visible (helps battery on mobile/PWA).
 * 
 * @param callback - Function to call on each refresh
 * @param intervalMs - Interval in milliseconds (0 or negative to disable)
 * @param deps - Dependencies array (similar to useEffect)
 */
export function useAutoRefresh(
	callback: () => void | Promise<void>,
	intervalMs: number,
	deps: any[] = []
) {
	const savedCallback = useRef(callback);

	// Update the saved callback whenever it or deps change
	useEffect(() => {
		savedCallback.current = callback;
	}, [callback, ...deps]);

	useEffect(() => {
		if (!intervalMs || intervalMs <= 0) return;

		const handle = () => {
			// Only run if tab is visible (helps battery on mobile/PWA)
			if (typeof document !== "undefined" && document.visibilityState !== "visible") {
				return;
			}
			savedCallback.current?.();
		};

		// Initial run
		handle();

		const id = setInterval(handle, intervalMs);
		return () => clearInterval(id);
	}, [intervalMs, ...deps]);
}

