"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { IntroGuide } from "@/components/IntroGuide";
import { useLastLobbySnapshot } from "@/hooks/useLastLobby";

function HomepageCompliancePanel() {
	return (
		<div className="scoreboard-panel p-4 sm:p-5 space-y-2">
			<div className="font-display text-sm tracking-widest text-primary">ABOUT THIS APP</div>
			<p className="text-xs sm:text-sm text-muted-foreground">
				Gym Deathmatch tracks workouts, season standings, and challenge outcomes across your lobbies.
			</p>
			<p className="text-xs sm:text-sm text-muted-foreground">
				When you sign in with Google, we use your account identity (name/email/profile) to create your player profile and manage lobby membership.
			</p>
			<div className="pt-1">
				<Link href="/privacy" className="arena-badge px-4 py-2 text-xs">
					PRIVACY POLICY
				</Link>
			</div>
		</div>
	);
}

export default function HomePage() {
	const router = useRouter();
	const { user, isHydrated, signInWithGoogle } = useAuth();
	const lastLobby = useLastLobbySnapshot();
	const [isSigningIn, setIsSigningIn] = useState(false);

	useEffect(() => {
		if (!isHydrated || !user || !lastLobby?.id) return;
		router.replace(`/lobby/${encodeURIComponent(lastLobby.id)}`);
	}, [isHydrated, user, lastLobby?.id, router]);

	async function handleGoogleSignIn() {
		if (isSigningIn) return;
		setIsSigningIn(true);
		try {
			await signInWithGoogle();
		} finally {
			setIsSigningIn(false);
		}
	}

	if (!isHydrated) {
		return (
			<div className="min-h-screen">
				<div className="container mx-auto max-w-3xl py-10 px-4 space-y-6">
					<div className="scoreboard-panel p-6 text-sm text-muted-foreground">Loading your arena...</div>
					<HomepageCompliancePanel />
				</div>
			</div>
		);
	}

	if (user && lastLobby?.id) {
		return (
			<div className="min-h-screen">
				<div className="container mx-auto max-w-3xl py-10 px-4 space-y-6">
					<div className="scoreboard-panel p-6 space-y-3">
						<div className="arena-badge arena-badge-primary text-[10px]">RESUMING LOBBY</div>
						<h1 className="font-display text-2xl tracking-widest text-primary">{lastLobby.name}</h1>
						<p className="text-sm text-muted-foreground">
							Taking you back to your most recent lobby.
						</p>
						<div className="flex gap-3 flex-wrap">
							<Link href={`/lobby/${encodeURIComponent(lastLobby.id)}`} className="arena-badge arena-badge-primary px-4 py-2">
								OPEN NOW
							</Link>
							<Link href="/lobbies" className="arena-badge px-4 py-2">
								CHOOSE ANOTHER
							</Link>
						</div>
					</div>
					<HomepageCompliancePanel />
				</div>
			</div>
		);
	}

	if (!user) {
		return (
			<div className="min-h-screen">
				<div className="container mx-auto max-w-3xl py-6 px-4 sm:py-10 space-y-6">
					<div className="scoreboard-panel p-5 sm:p-6 space-y-4">
						<div className="font-display text-2xl sm:text-3xl tracking-widest text-primary">WELCOME TO THE ARENA</div>
						<p className="text-sm text-muted-foreground">
							Start here on mobile: sign in, run the quick tutorial, then jump into your lobbies.
						</p>
						<div className="grid gap-3 sm:grid-cols-2">
							<button
								type="button"
								onClick={handleGoogleSignIn}
								disabled={isSigningIn}
								className="arena-badge arena-badge-primary px-4 py-3 text-center text-sm min-h-[48px] disabled:opacity-70"
							>
								{isSigningIn ? "CONNECTING..." : "CONTINUE WITH GOOGLE"}
							</button>
							<IntroGuide>
								<button
									type="button"
									className="arena-badge px-4 py-3 text-center text-sm min-h-[48px] w-full"
								>
									VIEW TUTORIAL
								</button>
							</IntroGuide>
						</div>
						<div className="flex gap-3 flex-wrap pt-1">
							<Link href="/rules" className="arena-badge px-4 py-2">
								READ RULES
							</Link>
							<Link href="/privacy" className="arena-badge px-4 py-2">
								PRIVACY POLICY
							</Link>
						</div>
					</div>
					<HomepageCompliancePanel />
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen">
			<div className="container mx-auto max-w-3xl py-10 px-4 space-y-6">
				<div className="scoreboard-panel p-6 space-y-3">
					<h2 className="font-display text-2xl tracking-widest text-primary">WELCOME BACK</h2>
					<p className="text-sm text-muted-foreground">
						Pick a lobby to see live stats, history, and season progress. Once you join a lobby it will show up in your list automatically.
					</p>
					<div className="flex gap-3 flex-wrap">
						<Link href="/lobbies" className="arena-badge arena-badge-primary px-4 py-2">
							VIEW LOBBIES
						</Link>
						<Link href="/rules" className="arena-badge px-4 py-2">
							READ THE RULES
						</Link>
					</div>
				</div>
				<HomepageCompliancePanel />
			</div>
		</div>
	);
}
