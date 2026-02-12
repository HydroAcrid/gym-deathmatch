import { runDailyCommentaryJob, runWeeklyCommentaryJob } from "@/lib/commentaryJobs";

export type RunCommentaryJobInput = {
	lobbyId?: string;
	processQueue?: boolean;
};

export const CommentaryJobService = {
	async runDaily(input: RunCommentaryJobInput) {
		return runDailyCommentaryJob(input);
	},
	async runWeekly(input: RunCommentaryJobInput) {
		return runWeeklyCommentaryJob(input);
	},
};
