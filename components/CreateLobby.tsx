"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "./ToastProvider";
import { useAuth } from "./AuthProvider";
import { ChallengeSettingsCard, resetChallengeDefaults } from "./ChallengeSettingsCard";
import type { ChallengeSettings } from "@/types/game";
import { CreateLobbyInfo } from "./CreateLobbyInfo";

export function CreateLobby() {
	const [open, setOpen] = useState(false);
	const [lobbyName, setLobbyName] = useState("");
	const [seasonStart, setSeasonStart] = useState<string>(new Date().toISOString().slice(0, 16));
	const [seasonEnd, setSeasonEnd] = useState<string>(new Date(new Date().getFullYear(), 11, 31).toISOString().slice(0, 16));
	const [weekly, setWeekly] = useState<number>(3);
	const [lives, setLives] = useState<number>(3);
	const [mode, setMode] = useState<"MONEY_SURVIVAL"|"MONEY_LAST_MAN"|"CHALLENGE_ROULETTE"|"CHALLENGE_CUMULATIVE">("MONEY_SURVIVAL");
	const [suddenDeath, setSuddenDeath] = useState<boolean>(false);
	// Pot settings to match OwnerSettingsModal
	const [initialPot, setInitialPot] = useState<string>("0");
	const [weeklyAnte, setWeeklyAnte] = useState<string>("10");
	const [scalingEnabled, setScalingEnabled] = useState<boolean>(false);
	const [perPlayerBoost, setPerPlayerBoost] = useState<string>("0");
	// Challenge settings
	const [challengeAllowSuggestions, setChallengeAllowSuggestions] = useState<boolean>(true);
	const [challengeRequireLock, setChallengeRequireLock] = useState<boolean>(false);
	const [challengeAutoSpin, setChallengeAutoSpin] = useState<boolean>(false);
	const [challengeSettings, setChallengeSettings] = useState<ChallengeSettings>(() => resetChallengeDefaults("CHALLENGE_ROULETTE"));
	const [ownerName, setOwnerName] = useState("");
	const toast = useToast();
	const { user } = useAuth();
	const [profileAvatar, setProfileAvatar] = useState<string | null>(null);
	const [infoOpen, setInfoOpen] = useState(false);

	// Prefill owner name/avatar from profile
	useEffect(() => {
		(async () => {
			try {
				if (!user?.id) return;
				const res = await fetch(`/api/user/profile?userId=${encodeURIComponent(user.id)}`, { cache: "no-store" });
				if (res.ok) {
					const j = await res.json();
					if (!ownerName && j?.name) setOwnerName(j.name);
					if (j?.avatarUrl) setProfileAvatar(j.avatarUrl);
				}
			} catch { /* ignore */ }
		})();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [user?.id]);

	function slugify(name: string) {
		return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
	}

	async function submit() {
		if (!lobbyName.trim()) return;
		const lobbyId = slugify(lobbyName);
		let ownerId = localStorage.getItem("gymdm_playerId") || "";
		if (!ownerId) {
			if (!ownerName.trim()) {
				toast.push("Enter your name to create your player");
				return;
			}
			ownerId = slugify(ownerName) + "-" + Math.floor(Math.random() * 10000).toString(16);
			localStorage.setItem("gymdm_playerId", ownerId);
		}
		if (!seasonStart || !seasonEnd) {
			toast.push("Enter start and end dates");
			return;
		}
		const res = await fetch("/api/lobby/create", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				lobbyId,
				name: lobbyName.trim(),
				seasonStart: new Date(seasonStart).toISOString(),
				seasonEnd: new Date(seasonEnd).toISOString(),
				weeklyTarget: Number(weekly),
				initialLives: Number(lives),
				ownerId,
				ownerName: ownerName || undefined,
				userId: user?.id || null,
				status: "pending",
				ownerAvatarUrl: profileAvatar,
				mode,
				suddenDeathEnabled: suddenDeath,
				initialPot: Number(initialPot || 0),
				weeklyAnte: Number(weeklyAnte || 0),
				scalingEnabled: Boolean(scalingEnabled),
				perPlayerBoost: Number(perPlayerBoost || 0)
				,
				challengeAllowSuggestions,
				challengeRequireLock,
				challengeAutoSpin,
				challengeSettings: String(mode).startsWith("CHALLENGE_") ? challengeSettings : null
			})
		});
		if (res.ok) {
			toast.push("Lobby created");
			window.location.href = `/lobby/${lobbyId}?joined=1&playerId=${ownerId}`;
		} else {
			toast.push("Failed to create lobby");
		}
	}

	return (
		<>
			<button className="btn-secondary px-3 py-2 rounded-md text-xs" onClick={() => setOpen(true)}>
				＋ Create Lobby
			</button>
			<AnimatePresence>
				{open && (
					<motion.div
						className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-6 bg-black/70"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
					>
						<motion.div
							role="dialog"
							aria-modal="true"
							className="ui-panel relative w-full sm:max-w-5xl h-[100svh] sm:h-[85vh] rounded-2xl shadow-2xl border flex flex-col box-border max-w-full overflow-hidden"
							initial={{ scale: 0.96, opacity: 0 }}
							animate={{ scale: 1, opacity: 1 }}
							exit={{ scale: 0.96, opacity: 0 }}
						>
							<header className="sticky top-0 z-10 ui-panel px-4 sm:px-6 py-3 border-b flex items-center justify-between gap-3">
								<div className="min-w-0">
									<h2 className="poster-headline text-lg sm:text-xl tracking-wide truncate">Create Lobby</h2>
									<p className="ui-panel-muted text-xs sm:text-sm truncate">Configure dates, mode, targets, and challenge options</p>
								</div>
								<div className="shrink-0 flex items-center gap-2">
									<button
										className="h-9 w-9 rounded-md border border-deepBrown/30 flex items-center justify-center"
										aria-label="Help"
										onClick={() => setInfoOpen(true)}
										title="Lobby Info"
									>
										<span className="text-base leading-none">?</span>
									</button>
									<button className="px-3 py-2 rounded-md border border-deepBrown/30 text-xs" onClick={() => setOpen(false)}>Cancel</button>
									<button className="btn-vintage px-3 py-2 rounded-md text-xs" onClick={submit}>Create</button>
								</div>
							</header>
							<div className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-6 py-4 max-w-full [overflow-wrap:anywhere] break-words hyphens-auto">
								<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pr-2 sm:pr-0">
									<section className="space-y-4">
										<div className="ui-panel rounded-xl p-4 space-y-3 border">
											<h3 className="text-sm font-bold tracking-wide">Basics</h3>
											<label className="text-xs">
												<span className="block mb-1">Lobby name</span>
												<input className="w-full h-10 px-3 rounded-md border border-deepBrown/40 bg-cream text-deepBrown" placeholder="e.g., Winter Grind 2025"
													value={lobbyName} maxLength={48} onChange={e => setLobbyName(e.target.value)} />
											</label>
											<div className="grid grid-cols-2 gap-2">
												<label className="text-xs">
													<span className="block mb-1">Start date (local)</span>
													<input className="w-full h-10 px-3 rounded-md border border-deepBrown/40 bg-cream text-deepBrown" type="datetime-local"
														value={seasonStart} onChange={e => setSeasonStart(e.target.value)} />
												</label>
												<label className="text-xs">
													<span className="block mb-1">End date (local)</span>
													<input className="w-full h-10 px-3 rounded-md border border-deepBrown/40 bg-cream text-deepBrown" type="datetime-local"
														value={seasonEnd} onChange={e => setSeasonEnd(e.target.value)} />
												</label>
											</div>
										</div>
										<div className="ui-panel rounded-xl p-4 space-y-3 border">
											<h3 className="text-sm font-bold tracking-wide">Hearts & Target</h3>
											<div className="grid grid-cols-2 gap-2">
												<label className="text-xs">
													<span className="block mb-1">Weekly target</span>
													<input className="w-full h-10 px-3 rounded-md border border-deepBrown/40 bg-cream text-deepBrown" type="number" min={1}
														value={weekly} onChange={e => setWeekly(Number(e.target.value))} placeholder="3" />
													<div className="text-[10px] mt-1 text-deepBrown/70">Workouts required per week</div>
												</label>
												<label className="text-xs">
													<span className="block mb-1">Initial lives</span>
													<input className="w-full h-10 px-3 rounded-md border border-deepBrown/40 bg-cream text-deepBrown" type="number" min={1}
														value={lives} onChange={e => setLives(Number(e.target.value))} placeholder="3" />
													<div className="text-[10px] mt-1 text-deepBrown/70">Lives each player starts with</div>
												</label>
											</div>
											<label className="text-xs flex items-center gap-2">
												<input type="checkbox" className="h-4 w-4 border border-deepBrown/40 rounded-sm bg-cream text-deepBrown"
													checked={suddenDeath} onChange={e => setSuddenDeath(e.target.checked)} />
												<span>Allow Sudden Death revive (1 heart, no pot share)</span>
											</label>
										</div>
										<div className="ui-panel rounded-xl p-4 space-y-3 border">
											<h3 className="text-sm font-bold tracking-wide">Pot & Ante</h3>
											{String(mode).startsWith("CHALLENGE_") && (
												<div className="text-[11px] text-deepBrown/60 mb-1 flex items-center gap-1">
													<span>🔒</span>
													<span>Disabled in Challenge modes</span>
												</div>
											)}
											<div className={`${String(mode).startsWith("CHALLENGE_") ? "opacity-40 pointer-events-none select-none" : ""} grid gap-3`}>
												<label className="text-xs">
													<span className="block mb-1">Initial pot ($)</span>
													<input inputMode="numeric" pattern="[0-9]*" className="w-full h-10 px-3 rounded-md border border-deepBrown/40 bg-cream text-deepBrown"
														disabled={String(mode).startsWith("CHALLENGE_")}
														value={initialPot} onChange={e => setInitialPot(e.target.value)} />
												</label>
												<label className="text-xs">
													<span className="block mb-1">Weekly ante ($)</span>
													<input inputMode="numeric" pattern="[0-9]*" className="w-full h-10 px-3 rounded-md border border-deepBrown/40 bg-cream text-deepBrown"
														disabled={String(mode).startsWith("CHALLENGE_")}
														value={weeklyAnte} onChange={e => setWeeklyAnte(e.target.value)} />
												</label>
												<label className="text-xs flex items-center gap-2">
													<input type="checkbox" className="h-4 w-4 border border-deepBrown/40 rounded-sm bg-cream text-deepBrown"
														disabled={String(mode).startsWith("CHALLENGE_")}
														checked={scalingEnabled} onChange={e => setScalingEnabled(e.target.checked)} />
													<span>Scale ante with lobby size</span>
												</label>
												<label className={`text-xs ${scalingEnabled ? "" : "opacity-60"}`}>
													<span className="block mb-1">Per-player boost ($)</span>
													<input inputMode="numeric" pattern="[0-9]*" className="w-full h-10 px-3 rounded-md border border-deepBrown/40 bg-cream text-deepBrown"
														disabled={!scalingEnabled || String(mode).startsWith("CHALLENGE_")}
														value={perPlayerBoost} onChange={e => setPerPlayerBoost(e.target.value)} />
												</label>
											</div>
										</div>
									</section>
									<section className="space-y-4">
										<div className="ui-panel rounded-xl p-4 space-y-3 border">
											<h3 className="text-sm font-bold tracking-wide">Game Mode</h3>
											<label className="text-xs">
												<span className="block mb-1">Mode</span>
												<select
													className="ui-select w-full h-10 px-3 rounded-md"
													value={mode}
													onChange={e => {
														const val = e.target.value as any;
														setMode(val);
														if (String(val).startsWith("CHALLENGE_")) setChallengeSettings(resetChallengeDefaults(val));
													}}
												>
													<option value="MONEY_SURVIVAL">Money: Survival (classic)</option>
													<option value="MONEY_LAST_MAN">Money: Last Man Standing</option>
													<option value="CHALLENGE_ROULETTE">Challenge: Roulette</option>
													<option value="CHALLENGE_CUMULATIVE">Challenge: Cumulative</option>
												</select>
											</label>
										</div>
										{String(mode).startsWith("CHALLENGE_") && (
											<div className="ui-panel rounded-xl p-4 border">
												<ChallengeSettingsCard mode={mode as any} value={challengeSettings} onChange={setChallengeSettings} />
											</div>
										)}
										{!localStorage.getItem("gymdm_playerId") && (
											<div className="ui-panel rounded-xl p-4 border">
												<label className="text-xs">
													<span className="block mb-1">Your display name (you’ll be the owner)</span>
													<input className="w-full h-10 px-3 rounded-md border border-deepBrown/40 bg-cream text-deepBrown" placeholder="Your name"
														value={ownerName} onChange={e => setOwnerName(e.target.value)} />
												</label>
											</div>
										)}
									</section>
								</div>
							</div>
							
						</motion.div>
					</motion.div>
				)}
			</AnimatePresence>
			<CreateLobbyInfo open={infoOpen} onClose={() => setInfoOpen(false)} />
		</>
	);
}


