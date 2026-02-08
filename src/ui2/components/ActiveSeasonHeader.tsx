import { Swords, Users, Crown, Radio } from "lucide-react";

interface ActiveSeasonHeaderProps {
	seasonName: string;
	seasonNumber: number;
	gameMode: string;
	hostName: string;
	athleteCount: number;
}

export function ActiveSeasonHeader({
	seasonName,
	seasonNumber,
	gameMode,
	hostName,
	athleteCount,
}: ActiveSeasonHeaderProps) {
	return (
		<div className="scoreboard-panel p-6 sm:p-8 text-center relative overflow-hidden">
			<div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />

			<div className="absolute top-3 sm:top-4 right-3 sm:right-4 flex items-center gap-2">
				<div className="status-dot status-dot-active" />
				<span className="text-[10px] sm:text-xs font-display tracking-widest text-primary font-bold">
					LIVE
				</span>
			</div>

			<div className="relative z-10">
				<div className="flex items-center justify-center gap-2 sm:gap-3 mb-3 sm:mb-4">
					<Swords className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
					<h1 className="font-display text-xl sm:text-2xl md:text-3xl font-bold tracking-widest text-primary animate-marquee">
						THE ARENA IS LIVE
					</h1>
					<Swords className="w-5 h-5 sm:w-6 sm:h-6 text-primary transform scale-x-[-1]" />
				</div>

				<div className="inline-block mb-4 sm:mb-6">
					<div className="arena-badge arena-badge-primary px-4 py-1.5 text-[10px] sm:text-xs">
						SEASON {seasonNumber} — {seasonName}
					</div>
				</div>

				<div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs sm:text-sm">
					<div className="flex items-center gap-2">
						<Radio className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground" />
						<span className="text-muted-foreground font-display tracking-wider">MODE:</span>
						<span className="font-display font-bold text-foreground">{gameMode}</span>
					</div>

					<div className="w-px h-4 bg-border hidden sm:block" />

					<div className="flex items-center gap-2">
						<Crown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground" />
						<span className="text-muted-foreground font-display tracking-wider">HOST:</span>
						<span className="font-display font-bold text-foreground">{hostName}</span>
					</div>

					<div className="w-px h-4 bg-border hidden sm:block" />

					<div className="flex items-center gap-2">
						<Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground" />
						<span className="text-muted-foreground font-display tracking-wider">ATHLETES:</span>
						<span className="font-display font-bold text-foreground">{athleteCount}</span>
					</div>
				</div>
			</div>
		</div>
	);
}
