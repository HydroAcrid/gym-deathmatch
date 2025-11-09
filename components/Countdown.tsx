"use client";

import { useEffect, useMemo, useState } from "react";

function getRemaining(end: Date) {
	const total = Math.max(0, end.getTime() - Date.now());
	const days = Math.floor(total / (1000 * 60 * 60 * 24));
	const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
	const minutes = Math.floor((total / (1000 * 60)) % 60);
	return { days, hours, minutes };
}

export function Countdown({ endIso }: { endIso: string }) {
	const end = useMemo(() => new Date(endIso), [endIso]);
	const [remaining, setRemaining] = useState(() => getRemaining(end));
	useEffect(() => {
		const t = setInterval(() => setRemaining(getRemaining(end)), 30_000);
		return () => clearInterval(t);
	}, [end]);
	return (
		<div className="inline-flex items-center gap-3 px-3 py-2 bg-cream rounded-md border border-deepBrown/40 ink-edge">
			<div className="text-[10px] text-deepBrown/70">SEASON ENDS IN</div>
			<div className="flex gap-2 items-baseline poster-headline text-2xl text-deepBrown">
				<span>{remaining.days} DAYS</span>
				<span>·</span>
				<span>{remaining.hours} H</span>
				<span>·</span>
				<span>{remaining.minutes} M</span>
			</div>
		</div>
	);
}


