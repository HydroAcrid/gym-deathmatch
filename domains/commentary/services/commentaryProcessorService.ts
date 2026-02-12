import { processCommentaryQueue } from "@/lib/commentaryProcessor";

export type ProcessCommentaryInput = {
	lobbyId?: string;
	limit?: number;
	maxMs?: number;
};

export const CommentaryProcessorService = {
	async process(input: ProcessCommentaryInput = {}) {
		return processCommentaryQueue(input);
	},
};
