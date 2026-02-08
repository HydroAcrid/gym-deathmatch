import { useEffect, useState } from "react";

interface CountdownTimerProps {
	targetDate: Date;
	label: string;
	sublabel?: string;
}

interface TimeLeft {
	days: number;
	hours: number;
	minutes: number;
	seconds: number;
}

function calculateTimeLeft(targetDate: Date): TimeLeft {
	const difference = targetDate.getTime() - new Date().getTime();
	if (difference <= 0) {
		return { days: 0, hours: 0, minutes: 0, seconds: 0 };
	}
	return {
		days: Math.floor(difference / (1000 * 60 * 60 * 24)),
		hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
		minutes: Math.floor((difference / 1000 / 60) % 60),
		seconds: Math.floor((difference / 1000) % 60),
	};
}

function padNumber(num: number): string {
	return num.toString().padStart(2, "0");
}

export function CountdownTimer({ targetDate, label, sublabel }: CountdownTimerProps) {
	const [timeLeft, setTimeLeft] = useState<TimeLeft>(calculateTimeLeft(targetDate));

	useEffect(() => {
		const timer = setInterval(() => {
			setTimeLeft(calculateTimeLeft(targetDate));
		}, 1000);
		return () => clearInterval(timer);
	}, [targetDate]);

	const isComplete =
		timeLeft.days === 0 && timeLeft.hours === 0 && timeLeft.minutes === 0 && timeLeft.seconds === 0;

	return (
		<div className="scoreboard-panel p-6 sm:p-8 text-center relative overflow-hidden">
			<div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />

			<div className="relative z-10">
				<div className="text-muted-foreground text-xs sm:text-sm uppercase tracking-widest mb-4 sm:mb-6 font-display font-bold">
					{label}
				</div>

				{!isComplete ? (
					<div className="flex items-center justify-center gap-2 sm:gap-4 md:gap-6">
						<TimeBlock value={timeLeft.days} unit="DAYS" />
						<Separator />
						<TimeBlock value={timeLeft.hours} unit="HRS" />
						<Separator />
						<TimeBlock value={timeLeft.minutes} unit="MIN" />
						<Separator />
						<TimeBlock value={timeLeft.seconds} unit="SEC" animate />
					</div>
				) : (
					<div
						className="text-3xl sm:text-4xl md:text-6xl font-display font-bold text-primary animate-marquee"
						style={{ textShadow: "0 0 30px hsl(var(--primary) / 0.5)" }}
					>
						COMMENCE
					</div>
				)}

				{sublabel && (
					<div className="mt-4 sm:mt-6">
						<div className="arena-badge arena-badge-primary inline-flex text-[10px] sm:text-xs">
							{sublabel}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

interface TimeBlockProps {
	value: number;
	unit: string;
	animate?: boolean;
}

function TimeBlock({ value, unit, animate }: TimeBlockProps) {
	return (
		<div className="countdown-block min-w-[60px] sm:min-w-[70px] md:min-w-[90px]">
			<div
				className={`text-2xl sm:text-3xl md:text-5xl font-display font-bold text-primary ${
					animate ? "animate-countdown" : ""
				}`}
				style={{ textShadow: "0 0 20px hsl(var(--primary) / 0.4)" }}
			>
				{padNumber(value)}
			</div>
			<div className="text-[10px] sm:text-xs text-muted-foreground mt-1 tracking-widest font-display">
				{unit}
			</div>
		</div>
	);
}

function Separator() {
	return <div className="text-xl sm:text-3xl md:text-5xl font-display text-muted-foreground/60">:</div>;
}
