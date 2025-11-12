import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabaseClient";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ lobbyId: string }> }) {
	const { lobbyId } = await params;
	const supabase = getServerSupabase();
	if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 501 });
	const { data } = await supabase.from("lobby").select("mode, sudden_death_enabled").eq("id", lobbyId).maybeSingle();
	if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
	return NextResponse.json({ mode: data.mode, suddenDeathEnabled: !!data.sudden_death_enabled });
}


