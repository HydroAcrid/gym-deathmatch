export type CastVoteInput = {
	activityId: string;
	voterUserId: string;
	choice: "legit" | "sus" | "remove";
};

export type CastVoteResult = {
	ok: true;
};

export type OverrideVoteInput = {
	activityId: string;
	ownerUserId: string;
	newStatus: "approved" | "rejected";
	reason?: string | null;
};

export type OverrideVoteResult = {
	ok: true;
};

export interface VoteService {
	castVote(input: CastVoteInput): Promise<CastVoteResult>;
	override(input: OverrideVoteInput): Promise<OverrideVoteResult>;
}
