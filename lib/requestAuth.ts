import { getServerSupabase } from "./supabaseClient";

function extractBearerToken(req: Request): string | null {
	const header = req.headers.get("authorization") || "";
	if (!header.toLowerCase().startsWith("bearer ")) return null;
	const token = header.slice("bearer ".length).trim();
	return token || null;
}

export async function getRequestUserId(req: Request): Promise<string | null> {
	const token = extractBearerToken(req);
	if (!token) return null;
	const supabase = getServerSupabase();
	if (!supabase) return null;
	const { data, error } = await supabase.auth.getUser(token);
	if (error || !data?.user?.id) return null;
	return data.user.id;
}

