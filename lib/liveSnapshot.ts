import type { LiveLobbyResponse } from "@/types/api";
import { LiveSnapshotService } from "@/domains/lobby/services/liveSnapshotService";

export function readRequestTimezoneOffsetMinutes(req: Request): number | undefined {
	return LiveSnapshotService.readRequestTimezoneOffsetMinutes(req);
}

export async function buildLiveLobbyResponse(opts: {
	lobbyId: string;
	debugMode?: boolean;
	requestTimezoneOffsetMinutes?: number;
}): Promise<LiveLobbyResponse | null> {
	return LiveSnapshotService.getLobbySnapshot({
		lobbyId: opts.lobbyId,
		debugMode: opts.debugMode,
		requestTimezoneOffsetMinutes: opts.requestTimezoneOffsetMinutes,
	});
}

