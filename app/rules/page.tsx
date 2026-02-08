"use client";
import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { OwnerSettingsModal } from "@/components/OwnerSettingsModal";
import { useAuth } from "@/components/AuthProvider";

export default function RulesPage() {
	const searchParams = useSearchParams();
	const lobbyId = searchParams?.get("lobbyId") ?? "";
	const [info, setInfo] = useState<any>(null);
	const { user } = useAuth();

	const loadLobby = useCallback(async () => {
		if (!lobbyId) {
			setInfo(null);
			return;
		}
		try {
			const res = await fetch(`/api/lobby/${encodeURIComponent(lobbyId)}/live`, { cache: "no-store" });
			const data = await res.json();
			setInfo(data?.lobby ?? null);
		} catch {
			setInfo(null);
		}
	}, [lobbyId]);

	useEffect(() => {
		loadLobby();
	}, [loadLobby]);

	const isOwner = Boolean(
		lobbyId &&
		info?.ownerId &&
		user?.id &&
		Array.isArray(info?.players) &&
		info.players.some((p: any) => p.id === info.ownerId && p.userId === user.id)
	);

	const rules = [
		"Hit your weekly target to keep hearts.",
		"Lose a heart when you miss a week.",
		"First KO ends the season.",
		"Pot grows each week from antes.",
		"Have fun and don’t skip leg day."
	];
	return (
		<div className="min-h-screen">
			<div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">
				<div className="grid md:grid-cols-2 gap-4">
					<div className="scoreboard-panel p-5 space-y-3">
						<div className="font-display text-lg tracking-widest text-primary">RULES OF THE DEATHMATCH</div>
						<ul className="space-y-2 text-sm">
							{rules.map((r, i) => (
								<li key={i} className="bg-muted/30 border border-border px-3 py-2">
									{r}
								</li>
							))}
						</ul>
					</div>
					<div className="scoreboard-panel p-5 space-y-3">
						<div className="font-display text-lg tracking-widest text-primary">POT & LIVES</div>
						<div className="text-sm text-muted-foreground space-y-1">
							<div><span className="font-display text-foreground">Starting pot:</span> ${info?.initialPot ?? 0}</div>
							<div><span className="font-display text-foreground">Weekly ante per player:</span> ${info?.weeklyAnte ?? 10}</div>
							{info?.scalingEnabled ? (
								<div><span className="font-display text-foreground">Scaling:</span> +${info?.perPlayerBoost ?? 0} per additional player</div>
							) : (
								<div><span className="font-display text-foreground">Scaling:</span> off</div>
							)}
							<div><span className="font-display text-foreground">Weekly Target:</span> {info?.weeklyTarget ?? 3} workouts</div>
							<div><span className="font-display text-foreground">Starting Lives:</span> {info?.initialLives ?? 3}</div>
							<div className="mt-2"><span className="font-display text-foreground">Current mode:</span> First person KO ends the season.</div>
						</div>
						{isOwner ? (
							<div className="pt-2">
								<OwnerSettingsModal
									lobbyId={lobbyId}
									ownerPlayerId={info?.ownerId ?? null}
									defaultWeekly={info?.weeklyTarget ?? 3}
									defaultLives={info?.initialLives ?? 3}
									defaultSeasonEnd={info?.seasonEnd}
									defaultInitialPot={info?.initialPot ?? 0}
									defaultWeeklyAnte={info?.weeklyAnte ?? 10}
									defaultScalingEnabled={info?.scalingEnabled ?? false}
									defaultPerPlayerBoost={info?.perPlayerBoost ?? 0}
									onSaved={loadLobby}
									hideTrigger={false}
								/>
							</div>
						) : null}
					</div>
				</div>
			</div>
		</div>
	);
}
