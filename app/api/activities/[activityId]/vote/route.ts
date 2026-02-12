import { NextRequest, NextResponse } from "next/server";
import { getRequestUserId } from "@/lib/requestAuth";
import { VoteService, isVoteServiceError } from "@/domains/activity/services/voteService";

function parseChoice(value: unknown): "legit" | "sus" | "remove" | null {
	const choice = String(value ?? "");
	if (choice === "legit" || choice === "sus" || choice === "remove") return choice;
	return null;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ activityId: string }> }) {
	const { activityId } = await params;
	const userId = await getRequestUserId(req);
	if (!userId) return NextResponse.json({ error: "Missing user" }, { status: 401 });

	try {
		const body = (await req.json().catch(() => ({}))) as { choice?: unknown };
		const choice = parseChoice(body.choice);
		if (!choice) return NextResponse.json({ error: "Invalid choice" }, { status: 400 });
		const result = await VoteService.castVote({
			activityId,
			voterUserId: userId,
			choice,
		});
		return NextResponse.json(result);
	} catch (err) {
		if (isVoteServiceError(err)) {
			return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
		}
		console.error("vote error", err);
		return NextResponse.json({ error: "Bad request" }, { status: 400 });
	}
}
