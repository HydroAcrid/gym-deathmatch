import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { PageMotion } from "@/components/PageMotion";
import { ToastProvider } from "@/components/ToastProvider";
import { AuthProvider } from "@/components/AuthProvider";
import { Analytics } from "@vercel/analytics/react";
import { DebugFooter } from "@/components/DebugFooter";
import { PWARegister } from "@/components/PWARegister";
import { PWAMeta } from "@/components/PWAMeta";

export const metadata: Metadata = {
	title: "Gym Deathmatch",
	description: "A whimsical scrapbook gym challenge",
	manifest: "/manifest.webmanifest",
	appleWebApp: {
		capable: true,
		statusBarStyle: "black-translucent",
		title: "Arena",
	},
	icons: {
		apple: "/icons/icon-192.png",
	},
};

export const viewport: Viewport = {
	themeColor: "#140b07",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" suppressHydrationWarning>
			<body className="antialiased min-h-screen overflow-x-hidden touch-manipulation bg-main text-main">
				{/* subtle paper/noise overlays still work for both themes */}
				<div className="paper-overlay" />
				<AuthProvider>
					<ToastProvider>
						<Navbar />
						<main className="relative z-20 px-3 sm:px-6 lg:px-8 pt-nav pb-4 sm:pb-6">
							<PageMotion>{children}</PageMotion>
						</main>
					</ToastProvider>
				</AuthProvider>
				<Analytics />
				<DebugFooter />
				<PWARegister />
				<PWAMeta />
			</body>
		</html>
	);
}
