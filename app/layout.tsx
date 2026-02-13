import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ArenaNav } from "@/src/ui2/components/ArenaNav";
import { MobileBottomNav } from "@/src/ui2/components/MobileBottomNav";
import { PageMotion } from "@/components/PageMotion";
import { ToastProvider } from "@/components/ToastProvider";
import { AuthProvider } from "@/components/AuthProvider";
import { Analytics } from "@vercel/analytics/react";
import { DebugFooter } from "@/components/DebugFooter";
import { PWARegister } from "@/components/PWARegister";
import { PWAMeta } from "@/components/PWAMeta";
import { GlobalLoadingOverlay } from "@/components/GlobalLoadingOverlay";

export const metadata: Metadata = {
	title: "Gym Deathmatch",
	description: "A whimsical scrapbook gym challenge",
	manifest: "/manifest.webmanifest",
	appleWebApp: {
		capable: true,
		statusBarStyle: "black-translucent",
		title: "Gym Deathmatch",
	},
	icons: {
		icon: "/icons/icon-512-v3.png",
		apple: "/icons/icon-192-v3.png",
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
			<body className="antialiased min-h-screen overflow-x-hidden touch-manipulation">
				<AuthProvider>
					<ToastProvider>
						<ArenaNav />
						<GlobalLoadingOverlay />
						{/* Main content with bottom padding to reserve space for fixed mobile nav */}
						<main className="relative z-20 px-3 sm:px-6 lg:px-8 pt-2 sm:pt-3 pb-24 sm:pb-6">
							<PageMotion>{children}</PageMotion>
						</main>
						{/* Mobile bottom nav - fixed to viewport, doesn't affect layout */}
						<MobileBottomNav />
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
