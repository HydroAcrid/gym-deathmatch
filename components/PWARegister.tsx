"use client";

import { useEffect } from "react";

export function PWARegister() {
	useEffect(() => {
		if (typeof window === "undefined") return;
		if (!("serviceWorker" in navigator)) {
			console.log("[PWA] Service workers not supported");
			return;
		}

		const enableInDev = process.env.NEXT_PUBLIC_ENABLE_PWA_IN_DEV === "1";
		const shouldRegister = process.env.NODE_ENV === "production" || enableInDev;
		let intervalId: number | null = null;
		let cancelled = false;

		const unregisterForDev = async () => {
			try {
				const regs = await navigator.serviceWorker.getRegistrations();
				await Promise.all(regs.map((reg) => reg.unregister()));
				if ("caches" in window) {
					const names = await caches.keys();
					await Promise.all(
						names
							.filter((name) => name.startsWith("arena-"))
							.map((name) => caches.delete(name))
					);
				}
				console.log("[PWA] Disabled in dev: service workers unregistered");
			} catch (error) {
				console.warn("[PWA] Failed to unregister SW in dev", error);
			}
		};

		const registerSW = async () => {
			try {
				const regs = await navigator.serviceWorker.getRegistrations();
				for (const reg of regs) {
					const scriptURL =
						reg.active?.scriptURL ||
						reg.installing?.scriptURL ||
						reg.waiting?.scriptURL ||
						"";
					if (!scriptURL.endsWith("/sw-v2.js")) {
						console.log("[PWA] Unregistering old worker", scriptURL);
						await reg.unregister();
					}
				}

				if (cancelled) return;
				const reg = await navigator.serviceWorker.register("/sw-v2.js");
				console.log("[PWA] Registered sw-v2", reg);

				reg.update().catch(() => {});
				intervalId = window.setInterval(() => {
					reg.update().catch(() => {});
				}, 60 * 60 * 1000);
			} catch (error) {
				console.error("[PWA] Service worker registration failed", error);
			}
		};

		if (!shouldRegister) {
			void unregisterForDev();
			return;
		}

		if (document.readyState === "complete") {
			void registerSW();
		} else {
			window.addEventListener("load", registerSW, { once: true });
		}

		return () => {
			cancelled = true;
			if (intervalId !== null) window.clearInterval(intervalId);
		};
	}, []);

	return null;
}
