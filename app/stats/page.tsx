"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function StatsRedirectPage() {
	const router = useRouter();
	useEffect(() => {
		const last = typeof window !== "undefined" ? localStorage.getItem("gymdm_lastLobbyId") : null;
		if (last) {
			router.replace(`/lobby/${encodeURIComponent(last)}/stats`);
		} else {
			router.replace("/lobbies");
		}
	}, [router]);
	return null;
}


