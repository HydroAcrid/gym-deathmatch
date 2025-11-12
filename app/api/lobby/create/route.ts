import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabaseClient";
import { jsonError } from "@/lib/logger";

export async function POST(req: NextRequest) {
	const supabase = getServerSupabase();
	if (!supabase) return jsonError("SUPABASE_NOT_CONFIGURED", "Supabase not configured", 501);
	try {
		const body = await req.json();
		// Generate a collision-safe lobby id (slug) on the server
		function slugify(s: string) {
			return (s || "")
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, "-")
				.replace(/^-+|-+$/g, "")
				.replace(/--+/g, "-");
		}
		let desired = (body.lobbyId as string) || slugify(body.name || "");
		if (!desired) desired = `lobby-${Math.random().toString(36).slice(2, 8)}`;
		let candidate = desired;
		for (let i = 0; i < 5; i++) {
			const { data: exists } = await supabase.from("lobby").select("id").eq("id", candidate).maybeSingle();
			if (!exists) break;
			candidate = `${desired}-${Math.random().toString(36).slice(2, 6)}`;
		}
		const lobbyId = candidate;
		// Validate challenge settings (optional)
		let challengeSettings = null as any;
		if (body.mode && String(body.mode).startsWith("CHALLENGE_")) {
			const cs = body.challengeSettings || {};
			const limit = Math.min(140, Math.max(10, Number(cs.suggestionCharLimit ?? 50)));
			challengeSettings = {
				selection: cs.selection ?? "ROULETTE",
				spinFrequency: cs.spinFrequency ?? "WEEKLY",
				visibility: cs.visibility ?? "PUBLIC",
				stackPunishments: !!(cs.stackPunishments ?? (body.mode === "CHALLENGE_CUMULATIVE")),
				allowSuggestions: !!(cs.allowSuggestions ?? true),
				requireLockBeforeSpin: !!(cs.requireLockBeforeSpin ?? true),
				autoSpinAtWeekStart: !!(cs.autoSpinAtWeekStart ?? false),
				showLeaderboard: !!(cs.showLeaderboard ?? true),
				profanityFilter: !!(cs.profanityFilter ?? true),
				suggestionCharLimit: limit
			};
		}

		const lobby = {
			id: lobbyId,
			name: String(body.name || "").slice(0, 48),
			season_number: body.seasonNumber ?? 1,
			season_start: body.seasonStart,
			season_end: body.seasonEnd,
			cash_pool: 0,
			weekly_target: body.weeklyTarget ?? 3,
			initial_lives: body.initialLives ?? 3,
			owner_id: body.ownerId || null,
			owner_user_id: body.userId || null,
			status: body.status || "pending",
			mode: body.mode || "MONEY_SURVIVAL",
			sudden_death_enabled: !!body.suddenDeathEnabled,
			initial_pot: body.initialPot ?? 0,
			weekly_ante: body.weeklyAnte ?? 10,
			scaling_enabled: !!body.scalingEnabled,
			per_player_boost: body.perPlayerBoost ?? 0,
			challenge_allow_suggestions: body.challengeAllowSuggestions ?? true,
			challenge_require_lock: body.challengeRequireLock ?? false,
			challenge_auto_spin: body.challengeAutoSpin ?? false,
			challenge_settings: challengeSettings
		};
		const { error: lerr } = await supabase.from("lobby").insert(lobby);
		if (lerr) {
			console.error("create lobby error", lerr);
			return jsonError("CREATE_LOBBY_FAILED", "Failed to create lobby", 500);
		}
		// Ensure owner player created/updated from user profile
		if (body.ownerId) {
			let ownerName = body.ownerName || null;
			let ownerAvatarUrl = body.ownerAvatarUrl || null;
			try {
				const { data: prof } = await supabase.from("user_profile").select("*").eq("user_id", body.userId).maybeSingle();
				if (!ownerName) ownerName = prof?.display_name ?? null;
				if (!ownerAvatarUrl) ownerAvatarUrl = prof?.avatar_url ?? null;
			} catch { /* ignore */ }
			await supabase.from("player").upsert({
				id: body.ownerId,
				lobby_id: lobbyId,
				name: ownerName ?? "Owner",
				avatar_url: ownerAvatarUrl ?? null,
				location: body.ownerLocation ?? null,
				quip: body.ownerQuip ?? null,
				user_id: body.userId || null
			});
		}
		return NextResponse.json({ ok: true, id: lobbyId });
	} catch (e) {
		return NextResponse.json({ error: "Bad request" }, { status: 400 });
	}
}

