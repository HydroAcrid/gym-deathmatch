import { NextRequest, NextResponse } from "next/server";
import { resolveLobbyAccess } from "@/lib/lobbyAccess";

type PlayerLite = {
	id: string;
	name: string | null;
	avatar_url?: string | null;
};

type FeedItem = {
	id: string;
	type: "post" | "event" | "comment";
	text: string;
	createdAt: string;
	player: PlayerLite | null;
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ lobbyId: string }> }) {
	const { lobbyId } = await params;
	const access = await resolveLobbyAccess(req, lobbyId);
	if (!access.ok) return NextResponse.json({ error: access.message, items: [] }, { status: access.status });
	if (!access.memberPlayerId && !access.isOwner) return NextResponse.json({ error: "Not a lobby member", items: [] }, { status: 403 });

	const supabase = access.supabase;

	try {
		const limitParam = Number(new URL(req.url).searchParams.get("limit") || "50");
		const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 100) : 50;

		const [{ data: activities }, { data: events }, { data: comments }] = await Promise.all([
			supabase
				.from("manual_activities")
				.select("id,type,caption,created_at,date,player:player_id(id,name,avatar_url)")
				.eq("lobby_id", lobbyId)
				.order("created_at", { ascending: false })
				.limit(limit),
			supabase
				.from("history_events")
				.select(
					"id,type,payload,created_at,actor_player_id,target_player_id,actor:actor_player_id(id,name,avatar_url),target:target_player_id(id,name,avatar_url)"
				)
				.eq("lobby_id", lobbyId)
				.order("created_at", { ascending: false })
				.limit(limit),
			supabase
				.from("comments")
				.select("id,type,rendered,created_at,primary_player_id,player:primary_player_id(id,name,avatar_url)")
				.eq("lobby_id", lobbyId)
				.in("visibility", ["feed", "both"] as any)
				.order("created_at", { ascending: false })
				.limit(limit),
		]);

		const postItems: FeedItem[] = (activities ?? []).map((a: any) => {
			const player = normalizePlayer(a.player);
			const createdAt = a.created_at ?? a.date ?? new Date().toISOString();
			const caption = String(a.caption || "").trim();
			const typeLabel = titleCase(String(a.type || "workout"));
			return {
				id: `post-${a.id}`,
				type: "post",
				text: caption || `${player?.name || "Athlete"} logged a ${typeLabel} workout`,
				createdAt,
				player,
			};
		});

		const eventItems: FeedItem[] = (events ?? []).map((e: any) => {
			const actor = normalizePlayer(e.actor);
			const target = normalizePlayer(e.target);
			const text = renderEventLine(e, actor, target);
			return {
				id: `event-${e.id}`,
				type: "event",
				text,
				createdAt: e.created_at ?? new Date().toISOString(),
				player: actor,
			};
		});

		const commentItems: FeedItem[] = (comments ?? []).map((c: any) => ({
			id: `comment-${c.id}`,
			type: "comment",
			text: String(c.rendered || "Comment"),
			createdAt: c.created_at ?? new Date().toISOString(),
			player: normalizePlayer(c.player),
		}));

		const items = [...postItems, ...eventItems, ...commentItems]
			.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
			.slice(0, limit);

		return NextResponse.json({ items });
	} catch (e) {
		console.error("feed GET error", e);
		return NextResponse.json({ error: "Failed to load feed", items: [] }, { status: 500 });
	}
}

function normalizePlayer(value: any): PlayerLite | null {
	if (!value) return null;
	const row = Array.isArray(value) ? value[0] : value;
	if (!row?.id) return null;
	return {
		id: row.id,
		name: row.name ?? null,
		avatar_url: row.avatar_url ?? null,
	};
}

function titleCase(input: string): string {
	if (!input) return "Workout";
	const lower = input.toLowerCase();
	return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function renderEventLine(ev: any, actor: PlayerLite | null, target: PlayerLite | null): string {
	const actorName = actor?.name || "System";
	const targetName = target?.name || "Athlete";

	if (ev.type === "ACTIVITY_LOGGED") return `${actorName} posted a workout`;
	if (ev.type === "VOTE_RESULT") {
		const result = String(ev.payload?.result || "decision").replace(/_/g, " ");
		return `Vote result: ${result} (${ev.payload?.legit ?? 0} legit · ${ev.payload?.sus ?? 0} sus)`;
	}
	if (ev.type === "WEEKLY_TARGET_MET") {
		const wk = ev.payload?.weeklyTarget ?? "target";
		const cnt = ev.payload?.workouts ?? "?";
		return `${targetName} met weekly target: ${cnt}/${wk}`;
	}
	if (ev.type === "WEEKLY_TARGET_MISSED") {
		const wk = ev.payload?.weeklyTarget ?? "target";
		const cnt = ev.payload?.workouts ?? "?";
		return `${targetName} missed weekly target: ${cnt}/${wk}`;
	}
	if (ev.type === "OWNER_OVERRIDE_ACTIVITY") {
		return `${actorName} set an activity to ${String(ev.payload?.newStatus || "").toUpperCase()}${target ? ` for ${targetName}` : ""}`;
	}
	if (ev.type === "OWNER_ADJUST_HEARTS") {
		const d = Number(ev.payload?.delta || 0);
		const sign = d > 0 ? "+" : "";
		return `${actorName} adjusted hearts for ${targetName}: ${sign}${d}${ev.payload?.reason ? ` — ${ev.payload.reason}` : ""}`;
	}
	if (ev.type === "PUNISHMENT_SPUN") {
		return `Wheel spun: "${String(ev.payload?.text ?? "").trim()}"`;
	}

	return actorName === "System" ? String(ev.type || "SYSTEM") : `${actorName}: ${String(ev.type || "SYSTEM")}`;
}
