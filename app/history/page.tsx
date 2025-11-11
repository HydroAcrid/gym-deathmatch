"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function HistoryRedirectPage() {
	const router = useRouter();
	useEffect(() => {
		const last = typeof window !== "undefined" ? localStorage.getItem("gymdm_lastLobbyId") : null;
		if (last) {
			router.replace(`/lobby/${encodeURIComponent(last)}/history`);
		} else {
			router.replace("/lobbies");
		}
	}, [router]);
	return null;
}


