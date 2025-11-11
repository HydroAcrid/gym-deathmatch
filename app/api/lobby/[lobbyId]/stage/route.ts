import { NextResponse } from "next/server";
import { updateLobbyStage } from "@/lib/persistence";

export async function PATCH(req: Request, { params }: { params: { lobbyId: string } }) {
	try {
		const lobbyId = decodeURIComponent(params.lobbyId);
		const body = await req.json();
		const payload: any = {};
		if (body.status) payload.status = body.status;
		if (body.scheduledStart !== undefined) payload.scheduledStart = body.scheduledStart;
		if (body.startNow === true) {
			payload.status = "active";
			payload.seasonStart = new Date().toISOString();
			payload.scheduledStart = null;
		}
		const ok = await updateLobbyStage(lobbyId, payload);
		if (!ok) return NextResponse.json({ ok: false }, { status: 500 });
		return NextResponse.json({ ok: true });
	} catch (e) {
		console.error("stage PATCH error", e);
		return NextResponse.json({ ok: false, error: "bad request" }, { status: 400 });
	}
}


