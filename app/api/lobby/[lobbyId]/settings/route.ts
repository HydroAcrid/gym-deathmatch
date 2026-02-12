import { NextRequest, NextResponse } from "next/server";
import { resolveLobbyAccess } from "@/lib/lobbyAccess";
import { refreshLobbyLiveSnapshot } from "@/lib/liveSnapshotStore";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ lobbyId: string }> }) {
	const { lobbyId } = await params;
	const access = await resolveLobbyAccess(req, lobbyId);
	if (!access.ok) return NextResponse.json({ error: access.message }, { status: access.status });
	if (!access.isOwner) return NextResponse.json({ error: "Owner only" }, { status: 403 });
	const supabase = access.supabase;
	try {
		const body = await req.json();
		const patch: any = {};
		if (typeof body.weeklyTarget === "number") patch.weekly_target = body.weeklyTarget;
		if (typeof body.initialLives === "number") patch.initial_lives = body.initialLives;
		if (typeof body.seasonStart === "string") {
			patch.season_start = body.seasonStart;
			// Sync scheduled_start with season_start for consistent UI display
			// This ensures the countdown in PreStageView matches the season start date
			patch.scheduled_start = body.seasonStart;
		}
		if (typeof body.scheduledStart === "string") {
			patch.scheduled_start = body.scheduledStart;
			// Sync season_start with scheduled_start for bidirectional consistency
			// This ensures the season start date matches the scheduled countdown
			patch.season_start = body.scheduledStart;
		}
		if (typeof body.seasonEnd === "string") patch.season_end = body.seasonEnd;
		// Pot settings (owner only UI)
		if (typeof body.initialPot === "number") patch.initial_pot = body.initialPot;
		if (typeof body.weeklyAnte === "number") patch.weekly_ante = body.weeklyAnte;
		if (typeof body.scalingEnabled === "boolean") patch.scaling_enabled = body.scalingEnabled;
		if (typeof body.perPlayerBoost === "number") patch.per_player_boost = body.perPlayerBoost;
		// Challenge settings (JSONB)
		if (body.challengeSettings !== undefined) patch.challenge_settings = body.challengeSettings;
		// Mode settings
		if (typeof body.mode === "string") patch.mode = body.mode;
		if (typeof body.suddenDeathEnabled === "boolean") patch.sudden_death_enabled = body.suddenDeathEnabled;
		// Invite controls
		if (typeof body.inviteEnabled === "boolean") patch.invite_enabled = body.inviteEnabled;
		if (body.inviteExpiresAt === null) patch.invite_expires_at = null;
		if (typeof body.inviteExpiresAt === "string") patch.invite_expires_at = body.inviteExpiresAt;
		if (typeof body.inviteTokenRequired === "boolean") patch.invite_token_required = body.inviteTokenRequired;
		if (body.rotateInviteToken === true) patch.invite_token = crypto.randomUUID().replace(/-/g, "");
		if (body.inviteTokenRequired === true && patch.invite_token === undefined) {
			// Ensure tokenized invites always have a token.
			const { data: existing } = await supabase
				.from("lobby")
				.select("invite_token")
				.eq("id", lobbyId)
				.maybeSingle();
			if (!existing || !(existing as any).invite_token) {
				patch.invite_token = crypto.randomUUID().replace(/-/g, "");
			}
		}
		if (Object.keys(patch).length === 0) return NextResponse.json({ error: "No changes" }, { status: 400 });
		// Update only provided fields; avoid upsert so NOT NULL columns (e.g. name) aren't required
		let { error } = await supabase.from("lobby").update(patch).eq("id", lobbyId);
		if (error && String((error as any)?.message || "").includes("invite_")) {
			// Backward compatibility: ignore invite controls if DB schema is older.
			delete patch.invite_enabled;
			delete patch.invite_expires_at;
			delete patch.invite_token_required;
			delete patch.invite_token;
			if (Object.keys(patch).length === 0) {
				void refreshLobbyLiveSnapshot(lobbyId);
				return NextResponse.json({ ok: true, inviteControlsSkipped: true });
			}
			const retry = await supabase.from("lobby").update(patch).eq("id", lobbyId);
			error = retry.error;
		}
		if (error) throw error;
		void refreshLobbyLiveSnapshot(lobbyId);
		return NextResponse.json({ ok: true });
	} catch (e) {
		console.error("settings patch error", e);
		return NextResponse.json({ error: "Bad request" }, { status: 400 });
	}
}
