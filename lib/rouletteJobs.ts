import { currentWeekIndex, resolvePunishmentWeek } from "@/lib/challengeWeek";
import {
	ensureCommentaryQueueReady,
	isCommentaryQueueUnavailableError,
} from "@/lib/commentaryEvents";
import { emitSpinResolvedEvent } from "@/lib/commentaryProducers";
import { logError } from "@/lib/logger";
import { processCommentaryQueue } from "@/lib/commentaryProcessor";
import { getServerSupabase } from "@/lib/supabaseClient";

type RunWeeklyRouletteJobOptions = {
	lobbyId?: string;
};

type RouletteLobbyRow = {
	id: string;
	mode: string;
	status: string;
	stage: string | null;
	season_start: string | null;
	challenge_settings: Record<string, unknown> | null;
};

type WeekStatusRow = {
	week_status: string | null;
};

type PreviousWeekRow = {
	text: string | null;
	created_by: string | null;
};

type PunishmentItemRow = {
	id: string;
	text: string | null;
	created_by: string | null;
	active: boolean | null;
};

type SpinEventRow = {
	id: string;
	started_at: string;
	winner_item_id: string;
};

function getErrorMessage(error: unknown, fallback: string): string {
	if (error instanceof Error && error.message) return error.message;
	return String(error || fallback);
}

export async function runWeeklyRouletteJob(options: RunWeeklyRouletteJobOptions = {}) {
	const supabase = getServerSupabase();
	if (!supabase) {
		return {
			scanned: 0,
			transitioned: 0,
			spun: 0,
			skipped: ["SUPABASE_NOT_CONFIGURED"],
		};
	}
	try {
		await ensureCommentaryQueueReady();
	} catch (e) {
		if (isCommentaryQueueUnavailableError(e)) {
			return {
				scanned: 0,
				transitioned: 0,
				spun: 0,
				skipped: ["COMMENTARY_QUEUE_UNAVAILABLE"],
			};
		}
		throw e;
	}

	let query = supabase
		.from("lobby")
		.select("id,mode,status,stage,season_start,challenge_settings")
		.eq("mode", "CHALLENGE_ROULETTE")
		.in("status", ["active", "transition_spin"]);
	if (options.lobbyId) query = query.eq("id", options.lobbyId);

	const { data: lobbies } = await query;
	const scanned = (lobbies ?? []).length;
	let transitioned = 0;
	let spun = 0;
	const skipped: string[] = [];
	const errors: Array<{ lobbyId: string; error: string }> = [];

	for (const lobby of (lobbies ?? []) as RouletteLobbyRow[]) {
		const lobbyId = String(lobby.id);
		const challengeSettings = (lobby.challenge_settings || {}) as Record<string, unknown>;
		const autoSpinEnabled = Boolean(challengeSettings.autoSpinAtWeekStart ?? false);
		if (!autoSpinEnabled) {
			skipped.push(`${lobbyId}:AUTO_SPIN_DISABLED`);
			continue;
		}
		if (!lobby.season_start) {
			skipped.push(`${lobbyId}:NO_SEASON_START`);
			continue;
		}

		try {
			const weekByDate = currentWeekIndex(lobby.season_start as string);
			let status = String(lobby.status || "active");
			if (status === "active" && weekByDate > 1) {
				// Only enter transition if the date-derived current week has not started yet.
				// This prevents cron from re-opening the wheel for already-active weeks.
				const { data: currentWeekRows } = await supabase
					.from("lobby_punishments")
					.select("week_status")
					.eq("lobby_id", lobbyId)
					.eq("week", weekByDate);
				const hasStartedCurrentWeek = ((currentWeekRows ?? []) as WeekStatusRow[]).some((row) => {
					const wkStatus = String(row?.week_status || "");
					return wkStatus === "ACTIVE" || wkStatus === "COMPLETE";
				});
				if (!hasStartedCurrentWeek) {
					await supabase
						.from("lobby")
						.update({ status: "transition_spin", stage: "ACTIVE" })
						.eq("id", lobbyId)
						.eq("status", "active");
					status = "transition_spin";
					transitioned += 1;
				}
			}
			if (status !== "transition_spin") {
				skipped.push(`${lobbyId}:STATUS_${status}`);
				continue;
			}

			const week = await resolvePunishmentWeek(supabase, lobbyId, {
				mode: "CHALLENGE_ROULETTE",
				status,
				seasonStart: lobby.season_start as string
			});

			const { data: existingSpinEvent } = await supabase
				.from("lobby_spin_events")
				.select("id")
				.eq("lobby_id", lobbyId)
				.eq("week", week)
				.maybeSingle();
			if (existingSpinEvent?.id) {
				skipped.push(`${lobbyId}:SPIN_EXISTS_WEEK_${week}`);
				continue;
			}

			let { data: items } = await supabase
				.from("lobby_punishments")
				.select("*")
				.eq("lobby_id", lobbyId)
				.eq("week", week);

			// If there are no entries for this week, clone last week's pool to keep auto-spin moving.
			if (!items || items.length === 0) {
				if (week > 1) {
					const { data: previousWeek } = await supabase
						.from("lobby_punishments")
						.select("text,created_by")
						.eq("lobby_id", lobbyId)
						.eq("week", week - 1)
						.order("created_at", { ascending: true });
					if (previousWeek && previousWeek.length > 0) {
						await supabase.from("lobby_punishments").insert(
							(previousWeek as PreviousWeekRow[]).map((row) => ({
								lobby_id: lobbyId,
								week,
								text: String(row.text || "").slice(0, 140),
								created_by: row.created_by ?? null,
								active: false,
								locked: true
							}))
						);
					}
				}
				const fallback = await supabase
					.from("lobby_punishments")
					.select("*")
					.eq("lobby_id", lobbyId)
					.eq("week", week);
				items = fallback.data ?? [];
			}

			// If still empty, create a single fallback entry so the weekly cycle never deadlocks.
			if (!items || items.length === 0) {
				await supabase.from("lobby_punishments").insert({
					lobby_id: lobbyId,
					week,
					text: "Coach's choice this week.",
					created_by: null,
					active: false,
					locked: true
				});
				const fallback = await supabase
					.from("lobby_punishments")
					.select("*")
					.eq("lobby_id", lobbyId)
					.eq("week", week);
				items = fallback.data ?? [];
			}

			if (!items || items.length === 0) {
				skipped.push(`${lobbyId}:NO_ITEMS_WEEK_${week}`);
				continue;
			}

			if (Boolean(challengeSettings.requireLockBeforeSpin ?? true)) {
				await supabase
					.from("lobby_punishments")
					.update({ locked: true })
					.eq("lobby_id", lobbyId)
					.eq("week", week);
			}

			const pool = ((items ?? []) as PunishmentItemRow[]).filter((item) => !item.active);
			if (!pool.length) {
				skipped.push(`${lobbyId}:EMPTY_POOL_WEEK_${week}`);
				continue;
			}
			const winner = pool[Math.floor(Math.random() * pool.length)];
			const startedAt = new Date(Date.now() + 1500).toISOString();

			let spinEvent: SpinEventRow | null = null;
			try {
				const { data, error } = await supabase
					.from("lobby_spin_events")
					.insert({
						lobby_id: lobbyId,
						week,
						winner_item_id: winner.id,
						started_at: startedAt,
						created_by: null
					})
					.select("id,started_at,winner_item_id")
					.single();
				if (error) {
					if (error.code === "23505") {
						const { data: existing } = await supabase
							.from("lobby_spin_events")
							.select("id,started_at,winner_item_id")
							.eq("lobby_id", lobbyId)
							.eq("week", week)
							.maybeSingle();
						spinEvent = (existing as SpinEventRow | null) ?? null;
					} else {
						throw error;
					}
				} else {
					spinEvent = (data as SpinEventRow | null) ?? null;
				}
			} catch (error: unknown) {
				throw new Error(`SPIN_EVENT_FAILED:${getErrorMessage(error, "spin event failed")}`);
			}
			if (!spinEvent) {
				skipped.push(`${lobbyId}:NO_SPIN_EVENT_WEEK_${week}`);
				continue;
			}

			const { data: chosen } = await supabase
				.from("lobby_punishments")
				.select("*")
				.eq("id", spinEvent.winner_item_id)
				.maybeSingle();
			if (!chosen) {
				skipped.push(`${lobbyId}:WINNER_NOT_FOUND_WEEK_${week}`);
				continue;
			}

			await supabase
				.from("lobby_punishments")
				.update({ active: false, week_status: null })
				.eq("lobby_id", lobbyId)
				.eq("week", week);
			await supabase
				.from("lobby_punishments")
				.update({ active: true, week_status: "PENDING_CONFIRMATION" })
				.eq("id", chosen.id);
			await supabase
				.from("week_ready_states")
				.delete()
				.eq("lobby_id", lobbyId)
				.eq("week", week);

				await supabase.from("history_events").insert({
					lobby_id: lobbyId,
					type: "PUNISHMENT_SPUN",
				payload: {
					week,
					text: chosen.text,
					spinId: spinEvent.id,
					startedAt: spinEvent.started_at,
					winnerItemId: spinEvent.winner_item_id,
					auto: true
				}
				});

				try {
					await emitSpinResolvedEvent({
						lobbyId,
						week,
						spinId: String(spinEvent.id),
						winnerItemId: String(spinEvent.winner_item_id),
						text: String(chosen.text || ""),
						startedAt: String(spinEvent.started_at),
						auto: true,
					});
					await processCommentaryQueue({ lobbyId, limit: 80, maxMs: 800 });
				} catch (error) {
					logError({ route: "cron/roulette/weekly", code: "AUTO_SPIN_EVENT_FAILED", err: error, lobbyId });
				}

			spun += 1;
		} catch (error: unknown) {
			errors.push({ lobbyId, error: getErrorMessage(error, "auto spin failed") });
			logError({ route: "cron/roulette/weekly", code: "AUTO_SPIN_FAILED", err: error, lobbyId });
		}
	}

	return { scanned, transitioned, spun, skipped, errors };
}
