import { NextRequest, NextResponse } from "next/server";
import { resolveLobbyAccess } from "@/lib/lobbyAccess";

export async function GET(req: NextRequest, { params }: { params: Promise<{ lobbyId: string }> }) {
	const { lobbyId } = await params;
	const access = await resolveLobbyAccess(req, lobbyId);
	if (!access.ok) return NextResponse.json({ error: access.message }, { status: access.status });
	if (!access.memberPlayerId) return NextResponse.json({ error: "Not a lobby member" }, { status: 403 });
	const supabase = access.supabase;
	const { data } = await supabase
		.from("lobby")
		.select("mode, sudden_death_enabled, challenge_settings")
		.eq("id", lobbyId)
		.maybeSingle();
	if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
	return NextResponse.json({
		mode: data.mode,
		suddenDeathEnabled: !!data.sudden_death_enabled,
		challengeSettings: (data as any).challenge_settings ?? null
	});
}
