"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

function getRemaining(targetIso?: string | null) {
	if (!targetIso) return { totalMs: 0, d: 0, h: 0, m: 0, s: 0 };
	const now = Date.now();
	const end = new Date(targetIso).getTime();
	const totalMs = Math.max(0, end - now);
	const d = Math.floor(totalMs / (24 * 60 * 60 * 1000));
	const h = Math.floor((totalMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
	const m = Math.floor((totalMs % (60 * 60 * 1000)) / (60 * 1000));
	const s = Math.floor((totalMs % (60 * 1000)) / 1000);
	return { totalMs, d, h, m, s };
}

export function CountdownHero({
	lobbyId,
	targetIso,
	seasonLabel,
	hostName,
	numAthletes
}: {
	lobbyId: string;
	targetIso?: string | null;
	seasonLabel: string;
	hostName?: string;
	numAthletes: number;
}) {
	const router = useRouter();
	const [nowTick, setNowTick] = useState(0);
	const remaining = useMemo(() => getRemaining(targetIso), [targetIso, nowTick]);
	const warmup = remaining.totalMs > 24 * 60 * 60 * 1000;
	const nearStart = remaining.totalMs > 0 && remaining.totalMs <= 10 * 60 * 1000;
	const reached = remaining.totalMs === 0;

	useEffect(() => {
		const id = setInterval(() => setNowTick((n) => n + 1), 1000);
		return () => clearInterval(id);
	}, []);

	// When countdown reaches zero, flash and begin deathmatch automatically
	useEffect(() => {
		if (!reached) return;
		let ignore = false;
		(async () => {
			try {
				await fetch(`/api/lobby/${encodeURIComponent(lobbyId)}/stage`, {
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ startNow: true })
				});
			} catch {
				// ignore
			}
			if (!ignore) {
				setTimeout(() => router.refresh(), 3500);
			}
		})();
		return () => {
			ignore = true;
		};
	}, [reached, lobbyId, router]);

	return (
		<div className="relative overflow-hidden rounded-lg stage-backdrop">
			{/* Spotlight and particles */}
			<div className="stage-spotlight" />
			<div className="stage-noise" />
			<div className={`p-6 md:p-8 text-center ${nearStart ? "stage-warn" : ""}`}>
				<div className="font-display text-2xl md:text-3xl mb-2 flex items-center justify-center gap-2 text-foreground">
					<span className="flicker-slow">⚡</span>
					<span>DEATHMATCH BEGINS IN</span>
					<span className="flicker-slow">⚡</span>
				</div>

				{/* Stage Info bar */}
				<div className="text-[11px] tracking-widest uppercase text-muted-foreground mb-4">
					{seasonLabel} • Hosted by {hostName || "Host"} • {numAthletes} Athletes Registered {warmup ? <span className="ml-2 px-2 py-0.5 rounded bg-arena-gold/20 text-arena-gold border border-arena-gold/40">🔥 Warm Up Mode Active</span> : null}
				</div>

				{/* Big segmented countdown */}
				<div className="flex flex-wrap items-end justify-center gap-2 sm:gap-3 md:gap-5">
					<TimeBlock label="DAYS" value={remaining.d} />
					<Colon />
					<TimeBlock label="HOURS" value={remaining.h} />
					<Colon />
					<TimeBlock label="MINUTES" value={remaining.m} />
					<Colon />
					<TimeBlock label="SECONDS" value={remaining.s} />
				</div>

				{/* Reached zero animation text */}
				<AnimatePresence>
					{reached && (
						<motion.div
							initial={{ opacity: 0, scale: 0.9 }}
							animate={{ opacity: 1, scale: 1 }}
							exit={{ opacity: 0 }}
							className="mt-4 font-display text-2xl md:text-3xl text-arena-gold"
						>
							DEATHMATCH BEGINS!
						</motion.div>
					)}
				</AnimatePresence>
			</div>
		</div>
	);
}

function Colon() {
	return <div className="font-display text-2xl sm:text-3xl md:text-5xl text-muted-foreground mb-3 sm:mb-4">·</div>;
}

function TimeBlock({ label, value }: { label: string; value: number }) {
	return (
		<motion.div
			key={label + value}
			initial={{ opacity: 0, y: 6 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.25 }}
			className="bg-muted/40 border border-border rounded-md px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-3"
		>
			<div className="font-display text-3xl sm:text-4xl md:text-7xl leading-none text-foreground">
				{String(value).padStart(2, "0")}
			</div>
			<div className="text-[9px] sm:text-[10px] md:text-[11px] tracking-widest text-muted-foreground mt-1 text-center">{label}</div>
		</motion.div>
	);
}


