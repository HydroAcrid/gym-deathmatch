"use client";

import { useEffect } from "react";
import type {
	ChallengeSettings,
	GameMode,
	PunishmentSelection,
	SpinFrequency,
	PunishmentVisibility
} from "@/types/game";

export function resetChallengeDefaults(mode: GameMode): ChallengeSettings {
	const base: ChallengeSettings = {
		selection: "ROULETTE",
		spinFrequency: "WEEKLY",
		visibility: "PUBLIC",
		stackPunishments: mode === "CHALLENGE_CUMULATIVE",
		allowSuggestions: true,
		requireLockBeforeSpin: true,
		autoSpinAtWeekStart: false,
		showLeaderboard: true,
		profanityFilter: true,
		suggestionCharLimit: 50
	};
	return base;
}

export function ChallengeSettingsCard({
	mode,
	value,
	onChange
}: {
	mode: GameMode;
	value: ChallengeSettings;
	onChange: (v: ChallengeSettings) => void;
}) {
	const isChallenge = String(mode).startsWith("CHALLENGE_");
	const isCumulative = mode === "CHALLENGE_CUMULATIVE";
	useEffect(() => {
		if (!isChallenge) return;
		// Ensure char limit stays in [1,140]
		if (value.suggestionCharLimit < 1 || value.suggestionCharLimit > 140) {
			onChange({ ...value, suggestionCharLimit: Math.min(140, Math.max(1, value.suggestionCharLimit)) });
		}
	}, [isChallenge, value, onChange]);

	const selection = value.selection;
	const disableSuggestions = selection === "HOST_DECIDES";
	const hideRequireLock = selection !== "ROULETTE"; // irrelevant when voting/host decides

	if (!isChallenge) return null;
	return (
		<div className="mt-4">
			<div className="poster-headline text-sm mb-2">CHALLENGE SETTINGS</div>
			{/* Punishment selection */}
			<div className="text-xs mb-1 flex items-center gap-2">
				<span>Punishment selection</span>
				<button type="button" title="How each week’s punishment is chosen." className="text-deepBrown/70" aria-label="Help">
					<svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
						<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 15h-2v-1c0-1.657 2-1.5 2-3 0-.552-.448-1-1-1s-1 .448-1 1H9c0-1.657 1.343-3 3-3s3 1.343 3 3c0 1.858-2 1.917-2 3v1Zm-2-8h2v2h-2V9Z"/>
					</svg>
				</button>
			</div>
			<div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
				{(["ROULETTE","VOTING","HOST_DECIDES"] as PunishmentSelection[]).map(opt => (
					<label key={opt} className={`text-xs flex items-center gap-2 px-2 py-2 rounded-md border ${selection===opt?"border-deepBrown":"border-deepBrown/30"}`}>
						<input type="radio" name="selection" checked={selection===opt} onChange={() => onChange({ ...value, selection: opt })} />
						<span>{opt === "ROULETTE" ? "Roulette" : opt === "VOTING" ? "Voting" : "Host decides"}</span>
					</label>
				))}
			</div>

			{/* Spin frequency */}
			<div className="text-xs mb-1 flex items-center gap-2">
				<span>Spin frequency</span>
				<button type="button" title="How often the roulette/vote runs." className="text-deepBrown/70" aria-label="Help">
					<svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
						<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 15h-2v-1c0-1.657 2-1.5 2-3 0-.552-.448-1-1-1s-1 .448-1 1H9c0-1.657 1.343-3 3-3s3 1.343 3 3c0 1.858-2 1.917-2 3v1Zm-2-8h2v2h-2V9Z"/>
					</svg>
				</button>
			</div>
			<div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
				{(["WEEKLY","BIWEEKLY","SEASON_ONLY"] as SpinFrequency[]).map(opt => (
					<label key={opt} className={`text-xs flex items-center gap-2 px-2 py-2 rounded-md border ${value.spinFrequency===opt?"border-deepBrown":"border-deepBrown/30"}`}>
						<input type="radio" name="spinFrequency" checked={value.spinFrequency===opt} onChange={() => onChange({ ...value, spinFrequency: opt })} />
						<span>{opt === "WEEKLY" ? "Weekly" : opt === "BIWEEKLY" ? "Biweekly" : "Once per season"}</span>
					</label>
				))}
			</div>

			{/* Visibility */}
			<div className="text-xs mb-1 flex items-center gap-2">
				<span>Visibility</span>
				<button type="button" title="Whether punishments are visible to all or revealed only to the player who failed." className="text-deepBrown/70" aria-label="Help">
					<svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
						<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 15h-2v-1c0-1.657 2-1.5 2-3 0-.552-.448-1-1-1s-1 .448-1 1H9c0-1.657 1.343-3 3-3s3 1.343 3 3c0 1.858-2 1.917-2 3v1Zm-2-8h2v2h-2V9Z"/>
					</svg>
				</button>
			</div>
			<div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
				{(["PUBLIC","HIDDEN_ON_FAIL"] as PunishmentVisibility[]).map(opt => (
					<label key={opt} className={`text-xs flex items-center gap-2 px-2 py-2 rounded-md border ${value.visibility===opt?"border-deepBrown":"border-deepBrown/30"}`}>
						<input type="radio" name="visibility" checked={value.visibility===opt} onChange={() => onChange({ ...value, visibility: opt })} />
						<span>{opt === "PUBLIC" ? "Public" : "Hidden on fail"}</span>
					</label>
				))}
			</div>

			{/* Stack punishments (CUMULATIVE only) */}
			<label className={`text-xs flex items-center gap-2 mb-1 ${!isCumulative ? "opacity-60 pointer-events-none" : ""}`}>
				<input
					type="checkbox"
					checked={!!value.stackPunishments}
					disabled={!isCumulative}
					onChange={e => onChange({ ...value, stackPunishments: e.target.checked })}
				/>
				<span title="Cumulative only: each failed week adds another punishment for that player.">Stack punishments each week</span>
			</label>
			{!isCumulative && (
				<div className="text-[11px] text-deepBrown/70 mb-2">Cumulative only. In Roulette, punishments are weekly and don’t stack.</div>
			)}

			{/* Other toggles */}
			<div className="grid sm:grid-cols-2 gap-2 mb-2">
				<label className={`text-xs flex items-center gap-2 ${disableSuggestions?"opacity-60": ""}`}>
					<input type="checkbox" disabled={disableSuggestions} checked={value.allowSuggestions && !disableSuggestions} onChange={e => onChange({ ...value, allowSuggestions: e.target.checked })} />
					<span>Allow player suggestions</span>
				</label>
				{!hideRequireLock && (
					<label className={`text-xs flex items-center gap-2 ${selection!=="ROULETTE"?"opacity-60": ""}`}>
						<input type="checkbox" disabled={selection!=="ROULETTE"} checked={value.requireLockBeforeSpin && selection==="ROULETTE"} onChange={e => onChange({ ...value, requireLockBeforeSpin: e.target.checked })} />
						<span>Require list lock before spin</span>
					</label>
				)}
				<label className="text-xs flex items-center gap-2">
					<input type="checkbox" checked={value.autoSpinAtWeekStart} onChange={e => onChange({ ...value, autoSpinAtWeekStart: e.target.checked })} />
					<span>Auto‑spin at week start</span>
				</label>
				<label className="text-xs flex items-center gap-2">
					<input type="checkbox" checked={value.showLeaderboard} onChange={e => onChange({ ...value, showLeaderboard: e.target.checked })} />
					<span>Show public punishment leaderboard</span>
				</label>
				<label className="text-xs flex items-center gap-2">
					<input type="checkbox" checked={value.profanityFilter} onChange={e => onChange({ ...value, profanityFilter: e.target.checked })} />
					<span>Profanity filter</span>
				</label>
				<label className="text-xs">
					<span className="block mb-1">Punishment input limit (chars)</span>
					<input
						type="number"
						min={1}
						max={140}
						step={1}
						className="w-full px-3 py-2 rounded-md border border-deepBrown/40 bg-cream text-deepBrown"
						value={value.suggestionCharLimit}
						onChange={e => onChange({ ...value, suggestionCharLimit: Math.min(140, Math.max(1, Number(e.target.value || 50))) })}
					/>
				</label>
			</div>

			{/* Dynamic copy */}
			<div className="text-[11px] text-deepBrown/70 mt-2">
				{mode === "CHALLENGE_ROULETTE" && <div>Punishments are chosen by wheel unless host selects "Voting" or "Host decides."</div>}
				{mode === "CHALLENGE_CUMULATIVE" && <div>Players who fail multiple weeks accumulate punishments.</div>}
			</div>
		</div>
	);
}


