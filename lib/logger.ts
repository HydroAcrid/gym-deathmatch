export type LogLevel = "debug" | "info" | "warn" | "error";

function levelEnabled(level: LogLevel): boolean {
	const env = (process.env.LOG_LEVEL || "info").toLowerCase();
	const order: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };
	const current = (order as any)[env as LogLevel] ?? 20;
	return (order[level] >= current);
}

async function maybeSendToSentry(payload: any) {
	try {
		const url = process.env.SENTRY_WEBHOOK_URL;
		if (!url) return;
		// Send minimal JSON to webhook (user can bridge to Sentry or another sink)
		await fetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload)
		}).catch(() => {});
	} catch { /* ignore */ }
}

export async function logError(context: {
	route: string;
	code: string;
	err: unknown;
	lobbyId?: string;
	actorUserId?: string | null;
	actorPlayerId?: string | null;
	extra?: Record<string, unknown>;
}) {
	if (!levelEnabled("error")) return;
	try {
		const payload = {
			level: "error",
			route: context.route,
			code: context.code,
			lobbyId: context.lobbyId,
			actorUserId: context.actorUserId,
			actorPlayerId: context.actorPlayerId,
			extra: context.extra || {},
			message: (context.err as any)?.message || String(context.err),
			stack: (context.err as any)?.stack || undefined
		};
		// eslint-disable-next-line no-console
		console.error("[gymdm]", JSON.stringify(payload));
		await maybeSendToSentry(payload);
	} catch (e) {
		// last resort
		// eslint-disable-next-line no-console
		console.error("[gymdm] logging failed", e);
	}
}

export function jsonError(code: string, message?: string, status = 400) {
	return new Response(JSON.stringify({ error: message || code, code }), {
		status,
		headers: { "Content-Type": "application/json" }
	});
}


