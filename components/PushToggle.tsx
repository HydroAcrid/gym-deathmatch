"use client";

import { useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";
import { Button } from "@/src/ui2/ui/button";
import { useToast } from "./ToastProvider";
import { authFetch } from "@/lib/clientAuth";

function urlBase64ToUint8Array(base64String: string) {
	const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
	const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
	const rawData = atob(base64);
	const outputArray = new Uint8Array(rawData.length);
	for (let i = 0; i < rawData.length; ++i) {
		outputArray[i] = rawData.charCodeAt(i);
	}
	return outputArray;
}

export function PushToggle() {
	const { user } = useAuth();
	const toast = useToast();
	const [supported, setSupported] = useState(false);
	const [subscribed, setSubscribed] = useState(false);
	const [loading, setLoading] = useState(false);
	const [permission, setPermission] = useState<NotificationPermission | "unknown">("unknown");

	useEffect(() => {
		const ok = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
		setSupported(ok);
		if (ok) setPermission(Notification.permission);
	}, []);

	useEffect(() => {
		if (!supported) return;
		(async () => {
			const reg = await navigator.serviceWorker.ready;
			const sub = await reg.pushManager.getSubscription();
			// If permission is denied, treat as unsubscribed even if a sub exists
			setSubscribed(Notification.permission === "granted" && !!sub);
			setPermission(Notification.permission);
		})();
	}, [supported]);

	const enable = async () => {
		if (!user?.id) {
			toast?.push?.("Sign in to enable notifications.");
			return;
		}
		if (!supported) {
			toast?.push?.("Notifications not supported on this device.");
			return;
		}
		setLoading(true);
		try {
			const perm = await Notification.requestPermission();
			setPermission(perm);
			if (perm !== "granted") {
				setSubscribed(false);
				toast?.push?.("Notifications blocked. Enable in browser settings.");
				return;
			}
			const reg = await navigator.serviceWorker.ready;
			const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
			if (!key) {
				toast?.push?.("Missing VAPID public key.");
				return;
			}
			const sub = await reg.pushManager.subscribe({
				userVisibleOnly: true,
				applicationServerKey: urlBase64ToUint8Array(key)
			});
			const res = await authFetch("/api/notifications/subscribe", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ subscription: sub.toJSON() })
			});
			if (!res.ok) {
				toast?.push?.("Failed to save notification preference.");
				await sub.unsubscribe().catch(() => {});
				return;
			}
			setSubscribed(true);
			toast?.push?.("Notifications enabled.");
		} catch (e) {
			console.error("Push enable error", e);
			toast?.push?.("Failed to enable notifications.");
		} finally {
			setLoading(false);
		}
	};

	const disable = async () => {
		if (!user?.id || !supported) return;
		setLoading(true);
		try {
			const reg = await navigator.serviceWorker.ready;
			const sub = await reg.pushManager.getSubscription();
			if (sub) {
				await authFetch("/api/notifications/unsubscribe", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ endpoint: sub.endpoint })
				}).catch(() => {});
				await sub.unsubscribe();
			}
			setSubscribed(false);
			toast?.push?.("Notifications disabled.");
		} catch {
			toast?.push?.("Failed to disable notifications.");
		} finally {
			setLoading(false);
		}
	};

	if (!supported) return null;

	const blocked = permission === "denied";
	const buttonLabel = blocked ? "Blocked" : subscribed ? "Disable" : "Enable";
	const buttonAction = blocked ? undefined : subscribed ? disable : enable;

	return (
		<div className="w-full">
			<div className="w-full rounded-lg border border-border bg-muted/30 text-foreground px-3 py-3">
				<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
					<div className="text-muted-foreground">
						<div className="uppercase tracking-[0.12em] font-semibold text-[11px]">Notifications</div>
						<div className="text-[11px] text-muted-foreground">Alerts about replies and activity.</div>
					</div>
					<div className="flex items-center gap-2 flex-wrap">
						<span className="uppercase tracking-wide font-semibold text-[11px]">Alerts</span>
						<Button
							variant="outline"
							size="sm"
							className="min-w-[90px]"
							disabled={loading || blocked}
							onClick={buttonAction}
						>
							{buttonLabel}
						</Button>
						{blocked && (
							<span className="text-[11px] text-muted-foreground max-w-[160px]">
								Unblock in browser settings
							</span>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
