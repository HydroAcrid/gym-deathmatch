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

export async function sendPushToUser(userId: string, payload: PushPayload) {
	if (!vapidPublic || !vapidPrivate) return;
	const supabase = getServerSupabase();
	if (!supabase) return;
	const { data: subs } = await supabase
		.from("push_subscriptions")
		.select("id, endpoint, p256dh, auth, subscription")
		.eq("user_id", userId);
	if (!subs || !subs.length) return;

	const notifications = subs.map(async (sub) => {
		try {
			await webpush.sendNotification(
				{
					endpoint: sub.endpoint as string,
					keys: {
						p256dh: (sub.p256dh as string) || (sub.subscription as any)?.keys?.p256dh,
						auth: (sub.auth as string) || (sub.subscription as any)?.keys?.auth
					}
				},
				JSON.stringify(payload)
			);
		} catch (err: any) {
			// Cleanup dead subscriptions
			const status = err?.statusCode || err?.status;
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
	const userIds = (players ?? []).map((p: any) => p.user_id as string | null).filter(Boolean) as string[];
	const unique = Array.from(new Set(userIds));
	const targets = opts?.excludeUserId ? unique.filter(u => u !== opts.excludeUserId) : unique;
	for (const userId of targets) {
		await sendPushToUser(userId, payload);
	}
}
