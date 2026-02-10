"use client";

import { useEffect } from "react";

/**
 * PWA Meta Tags Component
 * 
 * Adds iOS-specific meta tags that aren't fully supported by Next.js metadata API.
 * This component injects the tags client-side after mount.
 */
export function PWAMeta() {
	useEffect(() => {
		// Only run in browser
		if (typeof document === "undefined") return;

		// Check if tags already exist
		const existingManifest = document.querySelector('link[rel="manifest"]');
		if (existingManifest) return; // Metadata API already added it

		// Add manifest link if not present
		if (!document.querySelector('link[rel="manifest"]')) {
			const manifestLink = document.createElement("link");
			manifestLink.rel = "manifest";
			manifestLink.href = "/manifest.webmanifest";
			document.head.appendChild(manifestLink);
		}

		// Add iOS-specific meta tags
		const metaTags = [
			{ name: "apple-mobile-web-app-capable", content: "yes" },
			{ name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
			{ name: "apple-mobile-web-app-title", content: "Gym Deathmatch" },
			{ name: "theme-color", content: "#140b07" },
		];

		metaTags.forEach(({ name, content }) => {
			if (!document.querySelector(`meta[name="${name}"]`)) {
				const meta = document.createElement("meta");
				meta.name = name;
				meta.content = content;
				document.head.appendChild(meta);
			}
		});

		// Add apple-touch-icon if not present
		if (!document.querySelector('link[rel="apple-touch-icon"]')) {
			const appleIcon = document.createElement("link");
			appleIcon.rel = "apple-touch-icon";
			appleIcon.href = "/icons/icon-192-v3.png";
			document.head.appendChild(appleIcon);
		}
	}, []);

	return null; // This component doesn't render anything
}
