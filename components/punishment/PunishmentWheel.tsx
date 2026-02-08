"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";

export type PunishmentEntry = {
	id: string;
	displayName: string;
	avatarUrl?: string;
	punishment: string;
	createdBy?: string | null;
};

// Avoid SSR window access inside react-custom-roulette
const WheelNoSSR = dynamic(async () => {
	const mod = await import("react-custom-roulette");
	return mod.Wheel;
}, { ssr: false }) as any;

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
			const image = e.avatarUrl ? { uri: e.avatarUrl, sizeMultiplier: 0.65 } : undefined;
			return { option: name, image };
		});
	}, [eligible]);

	const [mustSpin, setMustSpin] = useState(false);
	const [prizeNumber, setPrizeNumber] = useState(0);
	const lastNonceRef = useRef<number | undefined>(undefined);
	const isSpinningRef = useRef<boolean>(false);

	// External spin trigger: when nonce changes, spin to provided index
	useEffect(() => {
		if (disabled) return;
		if (typeof spinToIndex !== "number") return;
		if (spinNonce === undefined) return;
		if (lastNonceRef.current === spinNonce) return;
		if (!eligible.length) return;
		if (isSpinningRef.current) return;
		lastNonceRef.current = spinNonce;
		const idx = Math.max(0, Math.min(spinToIndex, eligible.length - 1));
		setPrizeNumber(idx);
		isSpinningRef.current = true;
		setMustSpin(true);
	}, [disabled, spinToIndex, spinNonce, eligible.length]);

	return (
		<div className="scoreboard-panel">
			{/* Header */}
			<div className="flex items-center justify-center gap-3 p-4 border-b-2 border-border">
				<h2 className="font-display text-lg sm:text-2xl font-bold tracking-widest text-center">
					PUNISHMENT ROULETTE
				</h2>
			</div>

			{/* Wheel */}
			<div className="p-6 sm:p-8 flex flex-col items-center gap-6">
				<div className="relative">
					{data.length > 0 ? (
						<WheelNoSSR
							mustStartSpinning={mustSpin}
							prizeNumber={prizeNumber}
							data={data}
							backgroundColors={[
								"hsl(30 70% 25%)",
								"hsl(25 60% 18%)",
								"hsl(35 65% 22%)",
								"hsl(20 55% 20%)",
							]}
							textColors={["hsl(35 15% 80%)"]}
							spinDuration={1}
							onStopSpinning={() => {
								setMustSpin(false);
								isSpinningRef.current = false;
								onStop?.(prizeNumber);
							}}
							outerBorderColor="hsl(30 60% 50%)"
							outerBorderWidth={4}
							radiusLineColor="hsl(20 12% 16%)"
							radiusLineWidth={1}
							fontSize={14}
						/>
					) : (
						<div
							className="h-64 w-64 border-4 border-border flex items-center justify-center"
							style={{ background: "radial-gradient(circle, hsl(20 15% 12%), hsl(20 18% 6%))" }}
						>
							<span className="font-display text-sm tracking-widest text-muted-foreground">NO PUNISHMENTS</span>
						</div>
					)}
				</div>

				{/* Status text */}
				{mustSpin ? (
					<p className="font-display text-sm tracking-widest text-primary animate-pulse">SPINNING...</p>
				) : data.length > 0 ? (
					<p className="font-mono text-xs text-muted-foreground">
						Spin the wheel to reveal this week&apos;s punishment
					</p>
				) : null}
			</div>
		</div>
	);
}
