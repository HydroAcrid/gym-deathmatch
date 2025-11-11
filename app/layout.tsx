import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { PageMotion } from "@/components/PageMotion";
import { ToastProvider } from "@/components/ToastProvider";
import { AuthProvider } from "@/components/AuthProvider";
import { Analytics } from "@vercel/analytics/react";

export const metadata: Metadata = {
	title: "Gym Deathmatch",
	description: "A whimsical scrapbook gym challenge",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<body className="antialiased bg-poster min-h-screen text-deepBrown">
				<div className="paper-overlay" />
				<AuthProvider>
					<ToastProvider>
						<Navbar />
						<main className="relative z-20 px-4 sm:px-6 lg:px-8 py-6">
							<PageMotion>{children}</PageMotion>
						</main>
					</ToastProvider>
				</AuthProvider>
				<Analytics />
			</body>
		</html>
	);
}
