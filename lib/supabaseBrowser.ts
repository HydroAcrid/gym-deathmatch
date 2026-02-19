import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null = null;

export function getBrowserSupabase() {
	const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
	const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
	if (!url || !key) return null;
	// Singleton per browser context to avoid multiple GoTrueClient instances
	if (cachedClient) return cachedClient;
	cachedClient = createClient(url as string, key as string, {
		auth: {
			persistSession: true,
			autoRefreshToken: true
		}
	});
	return cachedClient;
}

