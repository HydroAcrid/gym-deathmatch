import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabaseClient";
import { jsonError } from "@/lib/logger";
import { getRequestUserId } from "@/lib/requestAuth";

export async function POST(req: NextRequest) {
	const supabase = getServerSupabase();
	if (!supabase) return jsonError("SUPABASE_NOT_CONFIGURED", "Supabase not configured", 501);
	try {
		const userId = await getRequestUserId(req);
		if (!userId) return jsonError("UNAUTHORIZED", "Unauthorized", 401);
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
			const limit = Math.min(140, Math.max(1, Number(cs.suggestionCharLimit ?? 50)));
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

		const ownerId = userId;

		const lobby = {
			id: lobbyId,
			name: String(body.name || "").slice(0, 48),
			season_number: body.seasonNumber ?? 1,
			season_start: body.seasonStart,
			season_end: body.seasonEnd,
			cash_pool: 0,
			weekly_target: body.weeklyTarget ?? 3,
			initial_lives: body.initialLives ?? 3,
			owner_id: null,
			owner_user_id: userId,
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
			challenge_settings: challengeSettings,
			invite_enabled: true,
			invite_expires_at: null,
			invite_token_required: true,
			invite_token: crypto.randomUUID().replace(/-/g, "")
		};
		let { error: lerr } = await supabase.from("lobby").insert(lobby);
		if (lerr && String((lerr as any)?.message || "").includes("invite_")) {
			// Backward compatibility: some environments may not have invite columns yet.
			const legacyLobby = { ...lobby } as any;
			delete legacyLobby.invite_enabled;
			delete legacyLobby.invite_expires_at;
			delete legacyLobby.invite_token_required;
			delete legacyLobby.invite_token;
			const retry = await supabase.from("lobby").insert(legacyLobby);
			lerr = retry.error;
		}
		if (lerr) {
			console.error("create lobby error", lerr);
			return jsonError("CREATE_LOBBY_FAILED", "Failed to create lobby", 500);
		}
		// Ensure owner player created/updated from user profile
		if (ownerId) {
			let ownerName = body.ownerName || null;
			let ownerAvatarUrl = body.ownerAvatarUrl || null;
			try {
				const { data: prof } = await supabase.from("user_profile").select("*").eq("user_id", userId).maybeSingle();
				if (!ownerName) ownerName = prof?.display_name ?? null;
				if (!ownerAvatarUrl) ownerAvatarUrl = prof?.avatar_url ?? null;
			} catch { /* ignore */ }
			const { error: playerErr } = await supabase.from("player").upsert({
				id: ownerId,
				lobby_id: lobbyId,
				name: ownerName ?? "Owner",
				avatar_url: ownerAvatarUrl ?? null,
				location: body.ownerLocation ?? null,
				quip: body.ownerQuip ?? null,
				user_id: userId
			});
			if (playerErr) {
				console.error("owner player upsert error", playerErr);
				return jsonError("CREATE_LOBBY_FAILED", "Failed to create lobby", 500);
			}
			const { error: ownerUpdateErr } = await supabase.from("lobby").update({
				owner_id: ownerId,
				owner_user_id: userId
			}).eq("id", lobbyId);
			if (ownerUpdateErr) {
				console.error("owner update error", ownerUpdateErr);
				return jsonError("CREATE_LOBBY_FAILED", "Failed to create lobby", 500);
			}
		}
		return NextResponse.json({ ok: true, id: lobbyId });
	} catch (e) {
		return NextResponse.json({ error: "Bad request" }, { status: 400 });
	}
}
