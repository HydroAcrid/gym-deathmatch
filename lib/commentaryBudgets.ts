import type { CommentaryDispatchOutput } from "@/lib/commentaryRules";

export type CommentaryBudgetDecision = {
	allowed: boolean;
	reason?: string;
	meta?: Record<string, unknown>;
};
type DbClient = NonNullable<ReturnType<typeof import("@/lib/supabaseClient").getServerSupabase>>;

function startOfUtcDay(dayKey?: string): Date {
	if (dayKey && /^\d{4}-\d{2}-\d{2}$/.test(dayKey)) {
		return new Date(`${dayKey}T00:00:00.000Z`);
	}
	const now = new Date();
	return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
}

export async function checkCommentaryBudget(input: {
	supabase: DbClient;
	output: CommentaryDispatchOutput;
	now?: Date;
}): Promise<CommentaryBudgetDecision> {
	const now = input.now ?? new Date();
	const output = input.output;
	const supabase = input.supabase;

	if (output.budgetType === "none") {
		return { allowed: true };
	}

	if (output.budgetType === "feed_per_lobby_per_minute") {
		const lobbyId = output.comment?.lobbyId;
		if (!lobbyId) return { allowed: false, reason: "missing_lobby_id" };
		const since = new Date(now.getTime() - 60 * 1000).toISOString();
		const { count, error } = await supabase
			.from("comments")
			.select("id", { count: "exact", head: true })
			.eq("lobby_id", lobbyId)
			.in("visibility", ["feed", "both"])
			.gte("created_at", since);
		if (error) throw error;
		const max = 3;
		const current = Number(count ?? 0);
		return current >= max
			? { allowed: false, reason: "feed_per_lobby_per_minute", meta: { max, current, since } }
			: { allowed: true, meta: { max, current, since } };
	}

	if (output.budgetType === "feed_per_workout") {
		const lobbyId = output.comment?.lobbyId;
		const metaActivityId = typeof output.meta?.activityId === "string" ? output.meta.activityId : "";
		const activityId = output.comment?.activityId ?? metaActivityId;
		if (!lobbyId || !activityId) {
			return { allowed: false, reason: "missing_activity_scope" };
		}
		const { count, error } = await supabase
			.from("comments")
			.select("id", { count: "exact", head: true })
			.eq("lobby_id", lobbyId)
			.in("visibility", ["feed", "both"])
			.eq("activity_id", activityId);
		if (error) throw error;
		const max = 1;
		const current = Number(count ?? 0);
		return current >= max
			? { allowed: false, reason: "feed_per_workout", meta: { max, current, activityId } }
			: { allowed: true, meta: { max, current, activityId } };
	}

	if (output.budgetType === "daily_push_per_user_per_day") {
		const metaUserId = typeof output.meta?.userId === "string" ? output.meta.userId : "";
		const userId = output.push?.userId ?? metaUserId;
		if (!userId) return { allowed: false, reason: "missing_user_id" };
		const dayKey = typeof output.meta?.dayKey === "string" ? output.meta.dayKey : "";
		const dayStartIso = startOfUtcDay(dayKey).toISOString();
		const { count, error } = await supabase
			.from("commentary_rule_runs")
			.select("id", { count: "exact", head: true })
			.eq("channel", "push")
			.eq("decision", "emitted")
			.contains("meta", { userId })
			.gte("created_at", dayStartIso);
		if (error) throw error;
		const max = 1;
		const current = Number(count ?? 0);
		return current >= max
			? { allowed: false, reason: "daily_push_per_user_per_day", meta: { max, current, userId, dayStartIso } }
			: { allowed: true, meta: { max, current, userId, dayStartIso } };
	}

	return { allowed: true };
}
