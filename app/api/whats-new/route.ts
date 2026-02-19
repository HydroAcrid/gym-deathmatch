import { NextResponse } from "next/server";
import { getLatestWhatsNewEntry, getWhatsNewData } from "@/lib/whatsNew";

export async function GET() {
	try {
		const data = getWhatsNewData();
		return NextResponse.json({
			latestReleaseId: data.latestReleaseId,
			latestEntry: getLatestWhatsNewEntry(data),
			entries: data.entries,
		});
	} catch {
		return NextResponse.json({
			latestReleaseId: "",
			latestEntry: null,
			entries: [],
		});
	}
}
