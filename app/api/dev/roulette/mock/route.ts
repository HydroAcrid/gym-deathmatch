import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabaseClient";
import { resolvePunishmentWeek } from "@/lib/challengeWeek";

type MockAction = "prepare" | "spin";

type MockBody = {
	admin?: string;
	lobbyId?: string;
	action?: MockAction;
	minPlayers?: number;
	forceRoulette?: boolean;
	winnerIndex?: number;
};

type MockLobbyRow = {
	id: string;
	mode: string | null;
	status: string | null;
	stage: string | null;
	season_start: string | null;
	season_end: string | null;
};

type MockPlayerRow = {
	id: string;
	name: string | null;
};

type MockPunishmentRow = {
	id: string;
	active: boolean | null;
	text: string | null;
	created_by: string | null;
};

type MockSpinEventRow = {
	id: string;
	started_at: string;
	winner_item_id: string;
};

const SEED_TEXT = [
	"50 burpees before next workout",
	"Cold shower after training",
	"Post a plank video (60s)",
	"No sugar for 24 hours",
	"Run stairs for 10 minutes"
];

function isDevAllowed() {
	return process.env.NODE_ENV !== "production";
}

function clampInt(value: unknown, fallback: number, min: number, max: number) {
	const n = Number(value);
	if (!Number.isFinite(n)) return fallback;
	return Math.max(min, Math.min(max, Math.floor(n)));
}

async function ensureSeededWeek(
	supabase: NonNullable<ReturnType<typeof getServerSupabase>>,
	lobbyId: string,
	week: number
) {
	const { data: existing } = await supabase
		.from("lobby_punishments")
		.select("id,active,text,created_by")
		.eq("lobby_id", lobbyId)
		.eq("week", week);
	const existingRows = (existing as MockPunishmentRow[] | null) ?? [];
	if (existingRows.length > 0) return existingRows;

	const { data: players } = await supabase
		.from("player")
		.select("id,name")
		.eq("lobby_id", lobbyId)
		.order("id", { ascending: true });
	const list = (players as MockPlayerRow[] | null) ?? [];
	if (!list.length) return [];

	const seedRows = list.map((p, idx) => ({
		lobby_id: lobbyId,
		week,
		text: `${SEED_TEXT[idx % SEED_TEXT.length]} (${p.name || "Athlete"})`,
		created_by: p.id,
		active: false,
		locked: true,
		week_status: "PENDING_PUNISHMENT"
	}));
	await supabase.from("lobby_punishments").insert(seedRows);
	const { data: inserted } = await supabase
		.from("lobby_punishments")
		.select("id,active,text,created_by")
		.eq("lobby_id", lobbyId)
		.eq("week", week);
	return (inserted as MockPunishmentRow[] | null) ?? [];
}

export async function GET() {
	return NextResponse.json({
		ok: true,
		route: "/api/dev/roulette/mock",
		usage: "POST with { admin, lobbyId, action: 'prepare' | 'spin' }"
	});
}

export async function POST(req: Request) {
	if (!isDevAllowed()) {
		return NextResponse.json({ error: "Not available in production" }, { status: 404 });
	}

	const supabase = getServerSupabase();
	if (!supabase) return NextResponse.json({ error: "No DB" }, { status: 501 });

	const body = (await req.json().catch(() => ({}))) as MockBody;
	if (!process.env.ADMIN_SECRET || body.admin !== process.env.ADMIN_SECRET) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}
	const lobbyId = String(body.lobbyId || "").trim();
	if (!lobbyId) return NextResponse.json({ error: "Missing lobbyId" }, { status: 400 });
	const action = body.action;
	if (action !== "prepare" && action !== "spin") {
		return NextResponse.json({ error: "Invalid action" }, { status: 400 });
	}

	const { data: lobbyData } = await supabase
		.from("lobby")
		.select("id,mode,status,stage,season_start,season_end")
		.eq("id", lobbyId)
		.maybeSingle();
	const lobby = (lobbyData as MockLobbyRow | null) ?? null;
	if (!lobby) return NextResponse.json({ error: "Lobby not found" }, { status: 404 });

	const nowIso = new Date().toISOString();
	const minPlayers = clampInt(body.minPlayers, 2, 1, 12);
	const forceRoulette = body.forceRoulette !== false;

	if (action === "prepare") {
		if (forceRoulette) {
			await supabase
				.from("lobby")
				.update({
					mode: "CHALLENGE_ROULETTE",
					status: "transition_spin",
					stage: "ACTIVE",
					season_start: lobby.season_start ?? nowIso
				})
				.eq("id", lobbyId);
		}

		const { data: playersData } = await supabase
			.from("player")
			.select("id,name")
			.eq("lobby_id", lobbyId)
			.order("id", { ascending: true });
		const currentPlayers = (playersData as MockPlayerRow[] | null) ?? [];
		if (!currentPlayers.length) {
			return NextResponse.json({ error: "No players in lobby" }, { status: 400 });
		}

		let botsAdded = 0;
		if (currentPlayers.length < minPlayers) {
			const needed = minPlayers - currentPlayers.length;
			const botRows = Array.from({ length: needed }).map((_, idx) => ({
				id: crypto.randomUUID(),
				lobby_id: lobbyId,
				name: `Bot ${idx + 1}`,
				avatar_url: null,
				location: null,
				quip: "Testing roulette",
				user_id: null,
				hearts: 3,
				lives_remaining: 3
			}));
			const { error: insertErr } = await supabase.from("player").insert(botRows);
			if (!insertErr) botsAdded = botRows.length;
		}

		const week = await resolvePunishmentWeek(supabase, lobbyId, {
			mode: "CHALLENGE_ROULETTE",
			status: "transition_spin",
			seasonStart: lobby.season_start ?? nowIso
		});
		const seeded = await ensureSeededWeek(supabase, lobbyId, week);

		return NextResponse.json({
			ok: true,
			lobbyId,
			action: "prepare",
			forceRoulette,
			minPlayers,
			botsAdded,
			week,
			seededCount: seeded.length
		});
	}

	const week = await resolvePunishmentWeek(supabase, lobbyId, {
		mode: String(lobby.mode || "CHALLENGE_ROULETTE"),
		status: "transition_spin",
		seasonStart: lobby.season_start ?? nowIso
	});
	const items = await ensureSeededWeek(supabase, lobbyId, week);
	if (!items.length) {
		return NextResponse.json({ error: "No seeded punishments to spin" }, { status: 400 });
	}

	const pool = items.filter((x) => !x.active);
	const candidatePool = pool.length ? pool : items;
	const winnerIdx = clampInt(body.winnerIndex, 0, 0, Math.max(0, candidatePool.length - 1));
	const winner = candidatePool[winnerIdx];

	let spinEvent: MockSpinEventRow | null = null;
	const { data: existing } = await supabase
		.from("lobby_spin_events")
		.select("id,started_at,winner_item_id")
		.eq("lobby_id", lobbyId)
		.eq("week", week)
		.maybeSingle();
	if (existing) {
		spinEvent = existing as MockSpinEventRow;
	} else {
		const { data: created, error } = await supabase
			.from("lobby_spin_events")
			.insert({
				lobby_id: lobbyId,
				week,
				winner_item_id: winner.id,
				started_at: new Date(Date.now() + 1500).toISOString(),
				created_by: null
			})
			.select("id,started_at,winner_item_id")
			.single();
		if (error) return NextResponse.json({ error: "Failed to create spin event" }, { status: 500 });
		spinEvent = created as MockSpinEventRow;
	}

	await supabase.from("lobby_punishments").update({ active: false, week_status: null }).eq("lobby_id", lobbyId).eq("week", week);
	await supabase.from("lobby_punishments").update({ active: true, week_status: "PENDING_CONFIRMATION" }).eq("id", spinEvent.winner_item_id);
	await supabase.from("lobby").update({ mode: "CHALLENGE_ROULETTE", status: "transition_spin", stage: "ACTIVE" }).eq("id", lobbyId);

	const { data: chosen } = await supabase
		.from("lobby_punishments")
		.select("id,text,week,active,week_status")
		.eq("id", spinEvent.winner_item_id)
		.maybeSingle();

	return NextResponse.json({
		ok: true,
		lobbyId,
		action: "spin",
		week,
		spinEvent: {
			spinId: spinEvent.id,
			startedAt: spinEvent.started_at,
			winnerItemId: spinEvent.winner_item_id
		},
		chosen: chosen ?? null
	});
}
