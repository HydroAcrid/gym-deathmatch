import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabaseClient";

export async function GET(req: NextRequest, { params }: { params: Promise<{ activityId: string }> }) {
	const { activityId } = await params;
	const supabase = getServerSupabase();
	if (!supabase) return NextResponse.json({ comments: [] });
	try {
		const { data, error } = await supabase
			.from("comments")
			.select("id, type, rendered, created_at, primary_player_id")
			.eq("activity_id", activityId)
			.order("created_at", { ascending: true });
		if (error) throw error;
		return NextResponse.json({ comments: data ?? [] });
	} catch {
		return NextResponse.json({ comments: [] });
	}
}


