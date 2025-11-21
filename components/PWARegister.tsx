"use client";

import { useEffect } from "react";

export function PWARegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) {
      console.log("[PWA] Service workers not supported");
      return;
    }

    const registerSW = async () => {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const reg of regs) {
          const scriptURL =
            reg.active?.scriptURL ||
            reg.installing?.scriptURL ||
            reg.waiting?.scriptURL ||
            "";
          if (!scriptURL.endsWith("/sw-v2.js")) {
            console.log("[PWA] Unregistering old worker", scriptURL);
            await reg.unregister();
          }
        }

        const reg = await navigator.serviceWorker.register("/sw-v2.js");
        console.log("[PWA] Registered sw-v2", reg);

        reg.update().catch(() => {});
        setInterval(() => {
          reg.update().catch(() => {});
        }, 60 * 60 * 1000);
      } catch (error) {
        console.error("[PWA] Service worker registration failed", error);
      }
    };

    if (document.readyState === "complete") {
      registerSW();
    } else {
      window.addEventListener("load", registerSW);
    }
  }, []);

  return null;
}
