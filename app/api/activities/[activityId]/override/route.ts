import { NextRequest, NextResponse } from "next/server";
import { getRequestUserId } from "@/lib/requestAuth";
import { VoteService, isVoteServiceError } from "@/domains/activity/services/voteService";

function parseStatus(value: unknown): "approved" | "rejected" | null {
	const status = String(value ?? "");
	if (status === "approved" || status === "rejected") return status;
	return null;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ activityId: string }> }) {
	const { activityId } = await params;
	const ownerUserId = await getRequestUserId(req);
	if (!ownerUserId) return NextResponse.json({ error: "Missing user" }, { status: 401 });

	try {
		const body = (await req.json().catch(() => ({}))) as { newStatus?: unknown; reason?: unknown };
		const newStatus = parseStatus(body.newStatus);
		if (!newStatus) return NextResponse.json({ error: "Invalid status" }, { status: 400 });
		const reason =
			typeof body.reason === "string" && body.reason.trim().length
				? body.reason.trim()
				: null;

		const result = await VoteService.override({
			activityId,
			ownerUserId,
			newStatus,
			reason,
		});
		return NextResponse.json(result);
	} catch (err) {
		if (isVoteServiceError(err)) {
			return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
		}
		console.error("override error", err);
		return NextResponse.json({ error: "Bad request" }, { status: 400 });
	}
}
