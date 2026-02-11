"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useAnimation } from "framer-motion";
import { RotateCw } from "lucide-react";

export type PunishmentEntry = {
	id: string;
	displayName: string;
	avatarUrl?: string;
	punishment: string;
	createdBy?: string | null;
};

const segmentColors = [
	{ bg: "hsl(30 70% 25%)", border: "hsl(30 60% 35%)" },
	{ bg: "hsl(25 60% 18%)", border: "hsl(25 50% 28%)" },
	{ bg: "hsl(35 65% 22%)", border: "hsl(35 55% 32%)" },
	{ bg: "hsl(20 55% 20%)", border: "hsl(20 45% 30%)" },
];

export function PunishmentWheel({
	entries,
	disabled,
	spinToIndex,
	spinNonce,
	onStop
}: {
	entries: PunishmentEntry[];
	disabled?: boolean;
	spinToIndex?: number | null;
	spinNonce?: number;
	onStop?: (winnerIndex: number) => void;
}) {
	const eligible = useMemo(() => {
		return (entries || []).filter(e => e.punishment && e.punishment.trim().length > 0);
	}, [entries]);
	const data = useMemo(() => {
		return eligible.map((e) => {
			const name = (e.displayName ?? "").toString().trim() || "Player";
			return { option: name, avatarUrl: e.avatarUrl };
		});
	}, [eligible]);

	const controls = useAnimation();
	const [spinning, setSpinning] = useState(false);
	const [currentRotation, setCurrentRotation] = useState(0);
	const [targetIndex, setTargetIndex] = useState(0);
	const lastNonceRef = useRef<number | undefined>(undefined);
	const segmentAngle = data.length > 0 ? 360 / data.length : 360;

	useEffect(() => {
		if (disabled) return;
		if (typeof spinToIndex !== "number") return;
		if (spinNonce === undefined) return;
		if (lastNonceRef.current === spinNonce) return;
		if (!data.length) return;
		if (spinning) return;
		lastNonceRef.current = spinNonce;
		const idx = Math.max(0, Math.min(spinToIndex, data.length - 1));
		setTargetIndex(idx);

		const winnerCenter = idx * segmentAngle + segmentAngle / 2;
		const targetWithin360 = (360 - winnerCenter + 360) % 360;
		const currentWithin360 = ((currentRotation % 360) + 360) % 360;
		const delta = (targetWithin360 - currentWithin360 + 360) % 360;
		const totalTurns = 7 * 360;
		const finalRotation = currentRotation + totalTurns + delta;

		setSpinning(true);
		controls
			.start({
				rotate: finalRotation,
				transition: {
					duration: 4.8,
					ease: [0.15, 0.85, 0.25, 1],
				},
			})
			.then(() => {
				setCurrentRotation(finalRotation);
				setSpinning(false);
				onStop?.(idx);
			});
	}, [disabled, spinToIndex, spinNonce, data.length, spinning, segmentAngle, currentRotation, controls, onStop]);

	const renderSegmentAvatar = (entry: { option: string; avatarUrl?: string }, index: number) => {
		if (entry.avatarUrl) {
			return (
				<img
					src={entry.avatarUrl}
					alt={entry.option}
					className="h-10 w-10 sm:h-12 sm:w-12 rounded-full object-cover border-2 border-primary-foreground/50 shadow-md"
				/>
			);
		}
		return (
			<div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full border-2 border-primary-foreground/30 bg-primary/20 flex items-center justify-center">
				<span className="font-display text-[11px] sm:text-xs tracking-wider text-primary-foreground">
					{entry.option.slice(0, 2).toUpperCase() || `${index + 1}`}
				</span>
			</div>
		);
	};

	return (
		<div className="scoreboard-panel">
			<div className="flex items-center justify-center gap-3 p-4 border-b-2 border-border">
				<h2 className="font-display text-lg sm:text-2xl font-bold tracking-widest text-center">
					PUNISHMENT ROULETTE
				</h2>
			</div>

			<div className="p-6 sm:p-8 flex flex-col items-center gap-6">
				<div className="relative w-64 h-64 sm:w-80 sm:h-80">
					<div className="absolute -top-2 left-1/2 -translate-x-1/2 z-20">
						<div className="w-0 h-0 border-l-[16px] border-r-[16px] border-t-[28px] border-l-transparent border-r-transparent border-t-primary drop-shadow-lg" />
						<div className="absolute top-0 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[10px] border-r-[10px] border-t-[18px] border-l-transparent border-r-transparent border-t-primary-foreground" />
					</div>

					<div
						className={`pointer-events-none absolute -inset-2 rounded-full border-4 ${spinning ? "border-primary/70" : "border-primary/55"}`}
						style={{ boxShadow: spinning ? "0 0 26px hsl(var(--primary) / 0.45)" : "0 0 12px hsl(var(--primary) / 0.25)" }}
					/>

					{data.length > 0 ? (
						<>
							<motion.div
								animate={controls}
								initial={{ rotate: currentRotation }}
								className="absolute inset-0 rounded-full overflow-hidden shadow-2xl"
								style={{ rotate: currentRotation }}
							>
								<svg viewBox="0 0 200 200" className="w-full h-full">
									{data.map((entry, index) => {
										const startAngle = (segmentAngle * index - 90) * (Math.PI / 180);
										const endAngle = (segmentAngle * (index + 1) - 90) * (Math.PI / 180);
										const colors = segmentColors[index % segmentColors.length];
										const x1 = 100 + 100 * Math.cos(startAngle);
										const y1 = 100 + 100 * Math.sin(startAngle);
										const x2 = 100 + 100 * Math.cos(endAngle);
										const y2 = 100 + 100 * Math.sin(endAngle);
										const largeArc = segmentAngle > 180 ? 1 : 0;
										return (
											<path
												key={entry.option + String(index)}
												d={`M 100 100 L ${x1} ${y1} A 100 100 0 ${largeArc} 1 ${x2} ${y2} Z`}
												fill={colors.bg}
												stroke={colors.border}
												strokeWidth="1"
											/>
										);
									})}
									<circle cx="100" cy="100" r="22" fill="hsl(20 18% 6%)" />
								</svg>

								{data.map((entry, index) => {
									const angle = (segmentAngle * index + segmentAngle / 2 - 90) * (Math.PI / 180);
									const radius = 55;
									const x = 50 + (radius / 100) * 50 * Math.cos(angle);
									const y = 50 + (radius / 100) * 50 * Math.sin(angle);
									return (
										<div
											key={`avatar-${entry.option}-${index}`}
											className="absolute pointer-events-none"
											style={{
												left: `${x}%`,
												top: `${y}%`,
												transform: "translate(-50%, -50%)",
											}}
										>
											{renderSegmentAvatar(entry, index)}
										</div>
									);
								})}
							</motion.div>

							<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-14 w-14 sm:h-16 sm:w-16 rounded-full bg-gradient-to-br from-primary via-primary to-accent border-4 border-primary-foreground flex items-center justify-center shadow-lg z-10">
								<RotateCw className={`h-6 w-6 sm:h-8 sm:w-8 text-primary-foreground ${spinning ? "animate-spin" : ""}`} />
							</div>
						</>
					) : (
						<div
							className="h-full w-full rounded-full border-2 border-border/70 flex flex-col items-center justify-center text-center px-6"
							style={{ background: "radial-gradient(circle, hsl(22 22% 12%), hsl(20 20% 7%))" }}
						>
							<span className="font-display text-sm tracking-widest text-muted-foreground">AWAITING SUBMISSIONS</span>
							<span className="mt-2 text-[11px] uppercase tracking-wider text-muted-foreground/80">
								Add punishments to arm the wheel
							</span>
						</div>
					)}
				</div>

				{spinning ? (
					<p className="font-display text-sm tracking-widest text-primary animate-pulse">SPINNING...</p>
				) : data.length > 0 ? (
					<p className="font-mono text-xs text-muted-foreground">
						Synchronized roulette spin is ready
					</p>
				) : null}

				{!spinning && data.length > 0 && typeof targetIndex === "number" && data[targetIndex] ? (
					<p className="text-[11px] uppercase tracking-wider text-muted-foreground/80 text-center">
						Next result is synchronized by server event
					</p>
				) : null}
			</div>
		</div>
	);
}
