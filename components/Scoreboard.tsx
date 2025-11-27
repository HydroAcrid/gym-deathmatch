"use client";

import { useRouter } from "next/navigation";
import { Countdown } from "./Countdown";
import { useEffect, useState, useRef } from "react";

function AnimatedDigit({ value }: { value: string }) {
	const [prev, setPrev] = useState(value);
	const [curr, setCurr] = useState(value);
	const [animating, setAnimating] = useState(false);

	if (value !== curr) {
		setPrev(curr);
		setCurr(value);
		setAnimating(true);
	}

	useEffect(() => {
		if (animating) {
			const t = setTimeout(() => setAnimating(false), 500); // Match CSS duration
			return () => clearTimeout(t);
		}
	}, [animating]);

	// If not a number (like $ or ,), just render static
	if (!/[0-9]/.test(value)) {
		return <span className="inline-block">{value}</span>;
	}

	return (
		<span className="digit-roller inline-block relative overflow-hidden h-[1em] leading-[1em]">
			<span 
				className={`flex flex-col absolute left-0 top-0 transition-transform duration-500 ease-out ${animating ? "-translate-y-full" : ""}`}
			>
				<span>{animating ? prev : curr}</span>
				<span>{curr}</span>
			</span>
			{/* Spacer to hold width */}
			<span className="opacity-0">{curr}</span>
		</span>
	);
}

function SplitFlapNumber({ amount }: { amount: number }) {
	const formatted = amount.toLocaleString();
	const chars = formatted.split("");
	
	return (
		<div className="flex items-baseline justify-center overflow-hidden" aria-label={`Current pot: ${formatted} dollars`}>
			<span className="mr-1 opacity-60">$</span>
			{chars.map((char, i) => (
				<AnimatedDigit key={`${i}-${char}`} value={char} />
			))}
		</div>
	);
}

export function Scoreboard({
	amount,
	endIso,
	canEdit = false,
	onEdit
}: {
	amount: number;
	endIso: string;
	canEdit?: boolean;
	onEdit?: () => void;
}) {
	const router = useRouter();
	
	// When season ends, refresh to show completed status
	const handleSeasonEnd = () => {
		setTimeout(() => router.refresh(), 1000);
	};

	return (
		<div className="paper-card paper-grain ink-edge scoreboard-vignette px-4 sm:px-6 py-4 sm:py-5 text-center relative overflow-hidden group">
			{/* Halftone/Noise accent in corners */}
			<div className="absolute top-0 left-0 w-16 h-16 bg-[radial-gradient(circle_at_top_left,var(--accent-primary)_1px,transparent_1px)] bg-[length:4px_4px] opacity-[0.15] pointer-events-none" />
			<div className="absolute bottom-0 right-0 w-16 h-16 bg-[radial-gradient(circle_at_bottom_right,var(--accent-primary)_1px,transparent_1px)] bg-[length:4px_4px] opacity-[0.15] pointer-events-none" />

			<div className="uppercase tracking-[0.14em] text-[10px] sm:text-[11px] text-deepBrown/70 mb-2 font-bold border-b border-deepBrown/10 inline-block pb-1">
				Current Pot
			</div>
			<div className="flex flex-col md:flex-row items-center justify-center gap-2 md:gap-4">
				<button
					type="button"
					disabled={!canEdit}
					onClick={() => canEdit && onEdit?.()}
					className={`poster-headline text-5xl sm:text-6xl md:text-7xl leading-none text-accent-primary text-print-error animate-stamp transition transform ${
						canEdit ? "hover:scale-[1.01] focus:scale-[1.01] focus:outline-none" : ""
					}`}
					title={canEdit ? "Click to adjust pot" : undefined}
					data-text={`$${amount}`}
				>
					<SplitFlapNumber amount={amount} />
				</button>
				<div className="countdown-wrap mt-2 md:mt-0 transform rotate-1 group-hover:rotate-0 transition-transform duration-300">
					<Countdown endIso={endIso} label="SEASON ENDS IN" onReachedZero={handleSeasonEnd} />
				</div>
			</div>
		</div>
	);
}
