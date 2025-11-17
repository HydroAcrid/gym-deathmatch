"use client";

import { useRouter } from "next/navigation";
import { Countdown } from "./Countdown";

export function Scoreboard({
	amount,
	endIso
}: {
	amount: number;
	endIso: string;
}) {
	const router = useRouter();
	
	// When season ends, refresh to show completed status
	const handleSeasonEnd = () => {
		setTimeout(() => router.refresh(), 1000);
	};

	return (
		<div className="paper-card paper-grain ink-edge scoreboard-vignette px-4 sm:px-6 py-4 sm:py-5 text-center">
			<div className="uppercase tracking-[0.14em] text-[10px] sm:text-[11px] text-deepBrown/70 mb-1">
				Current Pot
			</div>
			<div className="flex flex-col md:flex-row items-center justify-center gap-2 md:gap-4">
				<div className="poster-headline text-5xl sm:text-6xl md:text-7xl leading-none text-cream">
					${amount} 
				</div>
				<div className="countdown-wrap mt-1 md:mt-0">
					<Countdown endIso={endIso} label="SEASON ENDS IN" onReachedZero={handleSeasonEnd} />
				</div>
			</div>
		</div>
	);
}


