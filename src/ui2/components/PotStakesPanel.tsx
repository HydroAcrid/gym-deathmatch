import { Coins, TrendingUp, Trophy, Skull } from "lucide-react";

interface PotStakesPanelProps {
	currentPot: number;
	weeklyAnte: number;
	gameMode: "survival" | "last_man_standing" | "roulette" | "cumulative";
	isStakesIncreasing?: boolean;
}

const gameModeLabels: Record<string, { label: string; winCondition: string; icon: typeof Trophy }> = {
	survival: {
		label: "MONEY: SURVIVAL",
		winCondition: "WINNER TAKES POT",
		icon: Trophy,
	},
	last_man_standing: {
		label: "LAST MAN STANDING",
		winCondition: "LAST SURVIVOR WINS",
		icon: Skull,
	},
	roulette: {
		label: "CHALLENGE: ROULETTE",
		winCondition: "CHAMPION CLAIMS ALL",
		icon: Trophy,
	},
	cumulative: {
		label: "CHALLENGE: CUMULATIVE",
		winCondition: "HIGHEST SCORE WINS",
		icon: Trophy,
	},
};

export function PotStakesPanel({
	currentPot,
	weeklyAnte,
	gameMode,
	isStakesIncreasing = true,
}: PotStakesPanelProps) {
	const modeInfo = gameModeLabels[gameMode] || gameModeLabels.survival;
	const ModeIcon = modeInfo.icon;

	return (
		<div className="scoreboard-panel overflow-hidden">
			<div className="p-4 border-b-2 border-arena-gold/30 bg-gradient-to-r from-arena-gold/10 via-arena-gold/5 to-transparent">
				<div className="flex items-center gap-3">
					<Coins className="w-5 h-5 text-arena-gold" />
					<h2 className="font-display text-base sm:text-lg font-bold tracking-widest text-arena-gold">
						THE POT
					</h2>
					{isStakesIncreasing && (
						<div className="ml-auto flex items-center gap-1.5 arena-badge arena-badge-gold text-[10px]">
							<TrendingUp className="w-3 h-3" />
							<span>RISING</span>
						</div>
					)}
				</div>
			</div>

			<div className="p-6 sm:p-8 text-center border-b-2 border-border">
				<div
					className="text-4xl sm:text-5xl md:text-6xl font-display font-bold text-arena-gold mb-2"
					style={{ textShadow: "0 0 30px hsl(var(--arena-gold) / 0.4)" }}
				>
					${currentPot}
				</div>
				<div className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-widest font-display font-bold">
					CURRENT POT VALUE
				</div>
			</div>

			<div className="p-4 space-y-3">
				<div className="flex items-center justify-between">
					<span className="text-xs sm:text-sm text-muted-foreground uppercase tracking-widest font-display">
						WEEKLY ANTE
					</span>
					<span className="font-display font-bold text-foreground text-sm sm:text-base">
						${weeklyAnte}/WEEK
					</span>
				</div>

				<div className="arena-divider-solid" />

				<div className="flex items-center justify-between">
					<span className="text-xs sm:text-sm text-muted-foreground uppercase tracking-widest font-display">
						MODE
					</span>
					<span className="font-display font-bold text-[10px] sm:text-xs text-foreground tracking-wider">
						{modeInfo.label}
					</span>
				</div>

				<div className="arena-divider-solid" />

				<div className="flex items-center gap-3 p-3 sm:p-4 bg-arena-gold/10 border-2 border-arena-gold/30">
					<ModeIcon className="w-5 h-5 text-arena-gold flex-shrink-0" />
					<span className="font-display text-xs sm:text-sm tracking-widest text-arena-gold font-bold">
						{modeInfo.winCondition}
					</span>
				</div>
			</div>
		</div>
	);
}
