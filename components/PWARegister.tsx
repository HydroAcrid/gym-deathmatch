"use client";

import { useEffect } from "react";

/**
 * PWA Service Worker Registration Component
 * 
 * Registers the service worker for offline support and asset caching.
 * Only runs in the browser (client-side).
 */
export function PWARegister() {
	useEffect(() => {
		// Only run in browser
		if (typeof window === "undefined") return;
		
		// Check if service workers are supported
		if (!("serviceWorker" in navigator)) {
			console.log("[PWA] Service workers not supported");
			return;
		}

		// Register service worker after page load
		const registerSW = () => {
			navigator.serviceWorker
				.register("/sw.js")
				.then((registration) => {
					console.log("[PWA] Service worker registered:", registration.scope);
					
					// Check for updates periodically
					setInterval(() => {
						registration.update();
					}, 60 * 60 * 1000); // Check every hour
				})
				.catch((error) => {
					console.error("[PWA] Service worker registration failed:", error);
				});
		};

		// Register on load
		if (document.readyState === "complete") {
			registerSW();
		} else {
			window.addEventListener("load", registerSW);
		}
	}, []);

	return null; // This component doesn't render anything
}

