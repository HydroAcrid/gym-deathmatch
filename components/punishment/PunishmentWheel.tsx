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
		if (isSpinningRef.current) return; // Prevent interrupting an active spin
		lastNonceRef.current = spinNonce;
		// Clamp to valid range
		const idx = Math.max(0, Math.min(spinToIndex, eligible.length - 1));
		setPrizeNumber(idx);
		isSpinningRef.current = true;
		setMustSpin(true);
	}, [disabled, spinToIndex, spinNonce, eligible.length]);

	return (
		<div className="punishment-wheel flex flex-col items-center gap-3">
			<div className="relative">
				{data.length > 0 ? (
					<WheelNoSSR
						mustStartSpinning={mustSpin}
						prizeNumber={prizeNumber}
						data={data}
						backgroundColors={["#2b1a12", "#3b2417"]}
						textColors={["#ffffff"]}
						spinDuration={1}
						onStopSpinning={() => {
							setMustSpin(false);
							isSpinningRef.current = false;
							onStop?.(prizeNumber);
						}}
						outerBorderColor="#f3e0c8"
						outerBorderWidth={4}
						radiusLineColor="#000000"
						radiusLineWidth={1}
						fontSize={14}
					/>
				) : (
					<div className="h-64 w-64 rounded-full border-4 border-border" style={{ background: "radial-gradient(circle, hsl(20 15% 12%), hsl(20 18% 6%))" }} />
				)}
			</div>
		</div>
	);
}


