import { NextRequest, NextResponse } from "next/server";
import { resolveLobbyAccess } from "@/lib/lobbyAccess";

type LobbyModeRow = {
	mode: string | null;
	sudden_death_enabled: boolean | null;
	challenge_settings: Record<string, unknown> | null;
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ lobbyId: string }> }) {
	const { lobbyId } = await params;
	const access = await resolveLobbyAccess(req, lobbyId);
	if (!access.ok) return NextResponse.json({ error: access.message }, { status: access.status });
	if (!access.memberPlayerId && !access.isOwner) return NextResponse.json({ error: "Not a lobby member" }, { status: 403 });
	const supabase = access.supabase;
	const { data } = await supabase
		.from("lobby")
		.select("mode, sudden_death_enabled, challenge_settings")
		.eq("id", lobbyId)
		.maybeSingle();
	const row = (data as LobbyModeRow | null) ?? null;
	if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
	return NextResponse.json({
		mode: row.mode,
		suddenDeathEnabled: !!row.sudden_death_enabled,
		challengeSettings: row.challenge_settings ?? null
	});
}
