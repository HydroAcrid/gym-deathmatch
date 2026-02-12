import { NextResponse } from "next/server";
import { runDailyCommentaryJob } from "@/lib/commentaryJobs";
import { isCommentaryQueueUnavailableError } from "@/lib/commentaryEvents";

function isAuthorized(req: Request): boolean {
	const header = req.headers.get("authorization") || "";
	const secret = process.env.CRON_SECRET || process.env.ADMIN_SECRET || "";
	return !!secret && header === `Bearer ${secret}`;
}

export async function POST(req: Request) {
	if (!isAuthorized(req)) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const url = new URL(req.url);
		const lobbyId = url.searchParams.get("lobbyId") || undefined;
		const processRaw = (url.searchParams.get("process") || "true").toLowerCase();
		const processQueue = !["0", "false", "no"].includes(processRaw);
		const result = await runDailyCommentaryJob({ lobbyId, processQueue });
		return NextResponse.json({ ok: true, ...result });
	} catch (err) {
		if (isCommentaryQueueUnavailableError(err)) {
			return NextResponse.json(
				{ error: "COMMENTARY_QUEUE_UNAVAILABLE", message: "Run latest SQL schema before running commentary cron." },
				{ status: 503 }
			);
		}
		console.error("daily commentary cron failed", err);
		return NextResponse.json({ error: "DAILY_COMMENTARY_FAILED" }, { status: 500 });
	}
}

export async function GET(req: Request) {
	return POST(req);
}
