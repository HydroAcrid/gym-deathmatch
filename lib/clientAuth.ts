"use client";

import { getBrowserSupabase } from "./supabaseBrowser";
import { beginLoading, endLoading } from "./loadingBus";

export type AuthFetchInit = RequestInit & {
	trackLoading?: boolean;
};

function resolveMethod(input: string | URL | globalThis.Request, init?: RequestInit) {
	if (init?.method) return String(init.method).toUpperCase();
	if (typeof Request !== "undefined" && input instanceof Request) return String(input.method || "GET").toUpperCase();
	return "GET";
}

function shouldTrackLoading(input: string | URL | globalThis.Request, init?: AuthFetchInit) {
	if (typeof init?.trackLoading === "boolean") return init.trackLoading;
	const method = resolveMethod(input, init);
	// Default: focus on user actions (mutations), avoid noisy polling GETs.
	return method !== "GET" && method !== "HEAD";
}

export async function authFetch(input: string | URL | globalThis.Request, init?: AuthFetchInit) {
	const headers = new Headers(init?.headers || {});
	const supabase = getBrowserSupabase();
	if (supabase) {
		const { data } = await supabase.auth.getSession();
		const token = data.session?.access_token;
		if (token) headers.set("Authorization", `Bearer ${token}`);
	}
	try {
		const offsetMinutes = -new Date().getTimezoneOffset();
		headers.set("x-timezone-offset-minutes", String(offsetMinutes));
		const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
		if (tz) headers.set("x-timezone", tz);
	} catch {
		// best-effort only
	}
	const track = shouldTrackLoading(input, init);
	if (track) beginLoading();
	try {
		return await fetch(input, { ...(init || {}), headers });
	} finally {
		if (track) endLoading();
	}
}
