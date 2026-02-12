import { NextResponse } from "next/server";
import { processCommentaryQueue } from "@/lib/commentaryProcessor";
import { isCommentaryQueueUnavailableError } from "@/lib/commentaryEvents";

function isAuthorized(req: Request): boolean {
	const header = req.headers.get("authorization") || "";
	const cronSecret = process.env.CRON_SECRET || "";
	const adminSecret = process.env.ADMIN_SECRET || "";
	if (cronSecret && header === `Bearer ${cronSecret}`) return true;
	if (adminSecret && header === `Bearer ${adminSecret}`) return true;
	return false;
}

function parseBoolean(value: string | null, defaultValue: boolean): boolean {
	if (value == null) return defaultValue;
	const normalized = value.toLowerCase();
	if (normalized === "1" || normalized === "true" || normalized === "yes") return true;
	if (normalized === "0" || normalized === "false" || normalized === "no") return false;
	return defaultValue;
}

function readOptions(req: Request): { lobbyId?: string; limit?: number; maxMs?: number } {
	const url = new URL(req.url);
	const lobbyId = url.searchParams.get("lobbyId") || undefined;
	const limitRaw = Number(url.searchParams.get("limit") || "");
	const maxMsRaw = Number(url.searchParams.get("maxMs") || "");
	return {
		lobbyId,
		limit: Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : undefined,
		maxMs: Number.isFinite(maxMsRaw) && maxMsRaw > 0 ? maxMsRaw : undefined,
	};
}

async function handle(req: Request) {
	if (!isAuthorized(req)) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const options = readOptions(req);
		if (req.method === "POST") {
			const contentType = req.headers.get("content-type") || "";
			if (contentType.includes("application/json")) {
				const body = await req.json().catch(() => ({}));
				if (body && typeof body === "object") {
					if (typeof body.lobbyId === "string" && body.lobbyId.trim()) options.lobbyId = body.lobbyId.trim();
					if (Number.isFinite(Number(body.limit))) options.limit = Number(body.limit);
					if (Number.isFinite(Number(body.maxMs))) options.maxMs = Number(body.maxMs);
				}
			}
		}

		const stats = await processCommentaryQueue(options);
		return NextResponse.json(stats);
	} catch (err) {
		if (isCommentaryQueueUnavailableError(err)) {
			return NextResponse.json(
				{ error: "COMMENTARY_QUEUE_UNAVAILABLE", message: "Run latest SQL schema before processing commentary queue." },
				{ status: 503 }
			);
		}
		console.error("commentary process error", err);
		return NextResponse.json({ error: "COMMENTARY_PROCESS_FAILED" }, { status: 500 });
	}
}

export async function POST(req: Request) {
	return handle(req);
}

export async function GET(req: Request) {
	return handle(req);
}

export async function HEAD(req: Request) {
	if (!isAuthorized(req)) return new NextResponse(null, { status: 401 });
	const url = new URL(req.url);
	if (!parseBoolean(url.searchParams.get("ready"), true)) return new NextResponse(null, { status: 204 });
	return new NextResponse(null, { status: 200 });
}
