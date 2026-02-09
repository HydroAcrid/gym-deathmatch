import { NextResponse } from "next/server";
import { runDailyCommentaryJob } from "@/lib/commentaryJobs";

function isAuthorized(req: Request): boolean {
	const header = req.headers.get("authorization") || "";
	const secret = process.env.CRON_SECRET || process.env.ADMIN_SECRET || "";
	return !!secret && header === `Bearer ${secret}`;
}

export async function POST(req: Request) {
	if (!isAuthorized(req)) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const url = new URL(req.url);
	const lobbyId = url.searchParams.get("lobbyId") || undefined;
	const result = await runDailyCommentaryJob({ lobbyId });
	return NextResponse.json({ ok: true, ...result });
}
