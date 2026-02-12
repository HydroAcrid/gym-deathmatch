import { buildLiveLobbyResponse, readRequestTimezoneOffsetMinutes } from "@/lib/liveSnapshot";

export type GetLobbySnapshotInput = {
	lobbyId: string;
	debugMode?: boolean;
	requestTimezoneOffsetMinutes?: number;
};

export const LiveSnapshotService = {
	async getLobbySnapshot(input: GetLobbySnapshotInput) {
		return buildLiveLobbyResponse({
			lobbyId: input.lobbyId,
			debugMode: input.debugMode,
			requestTimezoneOffsetMinutes: input.requestTimezoneOffsetMinutes,
		});
	},
	readRequestTimezoneOffsetMinutes(req: Request) {
		return readRequestTimezoneOffsetMinutes(req);
	},
};
