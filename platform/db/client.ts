import { getServerSupabase } from "@/lib/supabaseClient";

export type DbClient = NonNullable<ReturnType<typeof getServerSupabase>>;

export function requireDbClient(): DbClient {
	const db = getServerSupabase();
	if (!db) {
		throw new Error("SUPABASE_NOT_CONFIGURED");
	}
	return db;
}
