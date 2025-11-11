 "use client";
import { useEffect, useState } from "react";
import { OwnerSettingsModal } from "@/components/OwnerSettingsModal";

export default function RulesPage() {
	const [lobbyId, setLobbyId] = useState<string>("");
	const [info, setInfo] = useState<any>(null);
	useEffect(() => {
		const id = typeof window !== "undefined" ? localStorage.getItem("gymdm_lastLobbyId") || "" : "";
		setLobbyId(id);
		(async () => {
			if (!id) return;
			const res = await fetch(`/api/lobby/${encodeURIComponent(id)}/live`, { cache: "no-store" });
			const data = await res.json();
			setInfo(data?.lobby ?? null);
		})();
	}, []);

	const rules = [
		"Hit your weekly target to keep hearts.",
		"Lose a heart when you miss a week.",
		"First KO ends the season.",
		"Pot grows each week from antes.",
		"Have fun and don’t skip leg day."
	];
	return (
		<div className="mx-auto max-w-6xl">
			<div className="grid md:grid-cols-2 gap-4">
				<div className="paper-card paper-grain ink-edge p-5">
					<div className="poster-headline text-lg mb-2">RULES OF THE DEATHMATCH</div>
					<ul className="space-y-2">
						{rules.map((r, i) => (
							<li key={i} className="bg-cream border border-deepBrown/20 rounded-md px-3 py-2">
								{r}
							</li>
						))}
					</ul>
				</div>
				<div className="paper-card paper-grain ink-edge p-5">
					<div className="poster-headline text-lg mb-2">POT & LIVES</div>
					<div className="text-sm text-deepBrown/80 space-y-1">
						<div><span className="font-semibold">Starting pot:</span> ${info?.initialPot ?? 0}</div>
						<div><span className="font-semibold">Weekly ante per player:</span> ${info?.weeklyAnte ?? 10}</div>
						{info?.scalingEnabled ? (
							<div><span className="font-semibold">Scaling:</span> +${info?.perPlayerBoost ?? 0} per additional player</div>
						) : (
							<div><span className="font-semibold">Scaling:</span> off</div>
						)}
						<div><span className="font-semibold">Weekly Target:</span> {info?.weeklyTarget ?? 3} workouts</div>
						<div><span className="font-semibold">Starting Lives:</span> {info?.initialLives ?? 3}</div>
						<div className="mt-2"><span className="font-semibold">Current mode:</span> First person KO ends the season.</div>
					</div>
					{info?.ownerId && (typeof window !== "undefined") && (localStorage.getItem("gymdm_playerId") === info.ownerId) ? (
						<div className="mt-3">
							<OwnerSettingsModal
								lobbyId={lobbyId}
								defaultWeekly={info?.weeklyTarget ?? 3}
								defaultLives={info?.initialLives ?? 3}
								defaultSeasonEnd={info?.seasonEnd}
								defaultInitialPot={info?.initialPot ?? 0}
								defaultWeeklyAnte={info?.weeklyAnte ?? 10}
								defaultScalingEnabled={info?.scalingEnabled ?? false}
								defaultPerPlayerBoost={info?.perPlayerBoost ?? 0}
								onSaved={() => window.location.reload()}
								hideTrigger={false}
							/>
						</div>
					) : null}
				</div>
			</div>
		</div>
	);
}


