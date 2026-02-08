"use client";

import { useEffect, useState } from "react";

export function DebugFooter() {
	const [enabled, setEnabled] = useState(false);
	const [ready, setReady] = useState<string>("");

	useEffect(() => {
		const check = () => {
			if (typeof window === "undefined") return;
			const search = new URLSearchParams(window.location.search);
			setEnabled(search.get("debug") === "1");
			setReady((window as any).__gymdm_ready || "");
		};
		check();
		const id = setInterval(check, 2000);
		return () => clearInterval(id);
	}, []);

	if (!enabled) return null;
	return (
		<div className="fixed bottom-1 left-1 right-1 z-[120] pointer-events-none">
			<div className="mx-auto max-w-6xl bg-black/60 text-foreground text-[11px] rounded px-2 py-1 pointer-events-auto">
				<span className="mr-3">Debug on</span>
				<span className="mr-3">Ready: {ready}</span>
				<span>LOG_LEVEL: {process.env.LOG_LEVEL || "info"}</span>
			</div>
		</div>
	);
}

