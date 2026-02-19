import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabaseClient";
import { getRequestUserId } from "@/lib/requestAuth";

const MAX_TARGET_LOBBIES = 25;
const ELIGIBLE_STATUSES = new Set(["pending", "scheduled", "transition_spin", "active"]);

function normalizeLobbyIds(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	const out: string[] = [];
	const seen = new Set<string>();
	for (const raw of value) {
		if (typeof raw !== "string") continue;
		const id = raw.trim();
		if (!id || seen.has(id)) continue;
		seen.add(id);
		out.push(id);
		if (out.length >= MAX_TARGET_LOBBIES) break;
	}
	return out;
}

function sanitizeLobbyIds(inputIds: string[], eligibleById: Map<string, string>): string[] {
	const out: string[] = [];
	const seen = new Set<string>();
	for (const id of inputIds) {
		if (seen.has(id)) continue;
		if (!eligibleById.has(id)) continue;
		seen.add(id);
		out.push(id);
	}
	return out.slice(0, MAX_TARGET_LOBBIES);
}

async function loadEligibleLobbiesForUser(
	supabase: NonNullable<ReturnType<typeof getServerSupabase>>,
	userId: string
): Promise<Map<string, string>> {
	const eligibleById = new Map<string, string>();

	const [{ data: memberRows, error: memberError }, { data: ownerRows, error: ownerError }] = await Promise.all([
		supabase.from("player").select("lobby_id").eq("user_id", userId).limit(500),
		supabase.from("lobby").select("id,status").eq("owner_user_id", userId).limit(500),
	]);

	if (memberError) throw memberError;
	if (ownerError) throw ownerError;

	const memberLobbyIds = Array.from(new Set((memberRows ?? []).map((row: { lobby_id: string }) => row.lobby_id)));
	const { data: memberLobbies, error: memberLobbiesError } = memberLobbyIds.length
		? await supabase.from("lobby").select("id,status").in("id", memberLobbyIds).limit(1000)
		: { data: [] as Array<{ id: string; status: string }>, error: null as unknown };
	if (memberLobbiesError) throw memberLobbiesError;

	for (const row of memberLobbies ?? []) {
		const status = String(row.status || "");
		if (!ELIGIBLE_STATUSES.has(status)) continue;
		eligibleById.set(String(row.id), status);
	}
	for (const row of ownerRows ?? []) {
		const status = String(row.status || "");
		if (!ELIGIBLE_STATUSES.has(status)) continue;
		eligibleById.set(String(row.id), status);
	}

	return eligibleById;
}

export async function GET(req: Request) {
	const supabase = getServerSupabase();
	if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 501 });

	try {
		const userId = await getRequestUserId(req);
		if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

		const eligibleById = await loadEligibleLobbiesForUser(supabase, userId);
		const { data: profile, error: profileError } = await supabase
			.from("user_profile")
			.select("manual_activity_target_lobbies")
			.eq("user_id", userId)
			.maybeSingle();
		if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });

		const saved = normalizeLobbyIds(profile?.manual_activity_target_lobbies ?? []);
		const sanitized = sanitizeLobbyIds(saved, eligibleById);
		const changed = saved.length !== sanitized.length || saved.some((id, i) => id !== sanitized[i]);

		if (changed && profile) {
			const { error: updateError } = await supabase
				.from("user_profile")
				.update({
					manual_activity_target_lobbies: sanitized,
					updated_at: new Date().toISOString(),
				})
				.eq("user_id", userId);
			if (updateError) {
				return NextResponse.json({ error: updateError.message }, { status: 500 });
			}
		}

		return NextResponse.json({ lobbyIds: sanitized });
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		return NextResponse.json({ error: message }, { status: 500 });
	}
}

export async function PUT(req: Request) {
	const supabase = getServerSupabase();
	if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 501 });

	try {
		const userId = await getRequestUserId(req);
		if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

		let body: { lobbyIds?: unknown } | null = null;
		try {
			body = (await req.json()) as { lobbyIds?: unknown };
		} catch {
			body = null;
		}
		const requested = normalizeLobbyIds(body?.lobbyIds ?? []);
		const eligibleById = await loadEligibleLobbiesForUser(supabase, userId);
		const sanitized = sanitizeLobbyIds(requested, eligibleById);

		const { error: upsertError } = await supabase.from("user_profile").upsert(
			{
				user_id: userId,
				manual_activity_target_lobbies: sanitized,
				updated_at: new Date().toISOString(),
			},
			{ onConflict: "user_id" }
		);
		if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 });

		return NextResponse.json({ ok: true, lobbyIds: sanitized });
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
