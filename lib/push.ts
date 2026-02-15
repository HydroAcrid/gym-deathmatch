import webpush from "web-push";
import { getServerSupabase } from "@/lib/supabaseClient";

const vapidPublic = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const vapidPrivate = process.env.VAPID_PRIVATE_KEY || "";
const vapidSubject = process.env.VAPID_SUBJECT || "mailto:notifications@gymdeathmatch.app";

if (vapidPublic && vapidPrivate) {
	webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
}

export type PushPayload = {
	title: string;
	body: string;
	url?: string;
	icon?: string;
	badge?: string;
};

type StoredSubscription = {
	id: string;
	endpoint: string | null;
	p256dh: string | null;
	auth: string | null;
	subscription: {
		keys?: {
			p256dh?: string;
			auth?: string;
		};
	} | null;
};

type LobbyPlayerUserIdRow = {
	user_id: string | null;
};

export async function sendPushToUser(userId: string, payload: PushPayload) {
	if (!vapidPublic || !vapidPrivate) return;
	const supabase = getServerSupabase();
	if (!supabase) return;
	const { data: subs } = await supabase
		.from("push_subscriptions")
		.select("id, endpoint, p256dh, auth, subscription")
		.eq("user_id", userId);
	const rows = (subs ?? []) as StoredSubscription[];
	if (!rows.length) return;

	const notifications = rows.map(async (sub) => {
		const endpoint = sub.endpoint || "";
		const p256dh = sub.p256dh || sub.subscription?.keys?.p256dh || "";
		const auth = sub.auth || sub.subscription?.keys?.auth || "";
		if (!endpoint || !p256dh || !auth) return;
		try {
			await webpush.sendNotification(
				{
					endpoint,
					keys: {
						p256dh,
						auth,
					}
				},
				JSON.stringify(payload)
			);
		} catch (err: unknown) {
			// Cleanup dead subscriptions
			const status =
				typeof err === "object" && err !== null && "statusCode" in err
					? Number((err as { statusCode?: unknown }).statusCode)
					: typeof err === "object" && err !== null && "status" in err
						? Number((err as { status?: unknown }).status)
						: undefined;
			if (status === 410 || status === 404) {
				await supabase.from("push_subscriptions").delete().eq("id", sub.id);
			}
		}
	});
	await Promise.all(notifications);
}

export async function sendPushToLobby(lobbyId: string, payload: PushPayload, opts?: { excludeUserId?: string }) {
	if (!vapidPublic || !vapidPrivate) return;
	const supabase = getServerSupabase();
	if (!supabase) return;
	const { data: players } = await supabase
		.from("player")
		.select("user_id")
		.eq("lobby_id", lobbyId);
	const userIds = ((players ?? []) as LobbyPlayerUserIdRow[])
		.map((p) => p.user_id)
		.filter((id): id is string => Boolean(id));
	const unique = Array.from(new Set(userIds));
	const targets = opts?.excludeUserId ? unique.filter(u => u !== opts.excludeUserId) : unique;
	await Promise.all(targets.map((userId) => sendPushToUser(userId, payload)));
}
