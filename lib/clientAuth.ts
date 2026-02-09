"use client";

import { getBrowserSupabase } from "./supabaseBrowser";

export async function authFetch(input: string | URL | globalThis.Request, init?: RequestInit) {
	const headers = new Headers(init?.headers || {});
	const supabase = getBrowserSupabase();
	if (supabase) {
		const { data } = await supabase.auth.getSession();
		const token = data.session?.access_token;
		if (token) headers.set("Authorization", `Bearer ${token}`);
	}
	return fetch(input, { ...(init || {}), headers });
}

