import { createClient } from "@supabase/supabase-js";

export function getBrowserSupabase() {
	const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
	const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
	if (!url || !key) return null as any;
	return createClient(url as string, key as string);
}


