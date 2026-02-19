export type LogLevel = "debug" | "info" | "warn" | "error";

function getErrorDetails(error: unknown): { message: string; stack?: string } {
	if (error instanceof Error) {
		return {
			message: error.message || String(error),
			stack: error.stack,
		};
	}
	return { message: String(error) };
}

function levelEnabled(level: LogLevel): boolean {
	const env = (process.env.LOG_LEVEL || "info").toLowerCase();
	const order: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };
	const current = env in order ? order[env as LogLevel] : order.info;
	return (order[level] >= current);
}

async function maybeSendToSentry(payload: Record<string, unknown>) {
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
		const details = getErrorDetails(context.err);
		const payload = {
			level: "error",
			route: context.route,
			code: context.code,
			lobbyId: context.lobbyId,
			actorUserId: context.actorUserId,
			actorPlayerId: context.actorPlayerId,
			extra: context.extra || {},
			message: details.message,
			stack: details.stack || undefined
		};
		 
		console.error("[gymdm]", JSON.stringify(payload));
		await maybeSendToSentry(payload);
	} catch (e) {
		// last resort
		 
		console.error("[gymdm] logging failed", e);
	}
}

export function jsonError(code: string, message?: string, status = 400) {
	return new Response(JSON.stringify({ error: message || code, code }), {
		status,
		headers: { "Content-Type": "application/json" }
	});
}

