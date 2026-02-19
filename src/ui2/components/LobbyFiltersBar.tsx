import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Search } from "lucide-react";

export type LobbyFilters = {
	showMine: boolean;
	showActive: boolean;
	showCompleted: boolean;
	showMoney: boolean;
	showChallenge: boolean;
};

export type LobbySortBy =
	| "last_interacted"
	| "newest"
	| "oldest"
	| "season_latest"
	| "season_earliest"
	| "name_az"
	| "name_za";

export interface LobbyFiltersBarProps {
	searchQuery: string;
	onSearchChange: (query: string) => void;
	sortBy: LobbySortBy;
	onSortChange: (sort: LobbySortBy) => void;
	filters: LobbyFilters;
	onFiltersChange: (filters: LobbyFilters) => void;
	onResetAll: () => void;
	totalCount: number;
	filteredCount: number;
}

export function LobbyFiltersBar({
	searchQuery,
	onSearchChange,
	sortBy,
	onSortChange,
	filters,
	onFiltersChange,
	onResetAll,
	totalCount,
	filteredCount,
}: LobbyFiltersBarProps) {
	const toggleFilter = (key: keyof LobbyFilters) => {
		onFiltersChange({ ...filters, [key]: !filters[key] });
	};

	const sortLabels: Record<LobbySortBy, string> = {
		last_interacted: "Last interacted",
		newest: "Date created (newest)",
		oldest: "Date created (oldest)",
		season_latest: "Season start (latest)",
		season_earliest: "Season start (earliest)",
		name_az: "Name (A -> Z)",
		name_za: "Name (Z -> A)",
	};

	const activeFilterLabels: string[] = [];
	if (filters.showMine) activeFilterLabels.push("My lobbies");
	if (filters.showActive) activeFilterLabels.push("Active");
	if (filters.showCompleted) activeFilterLabels.push("Completed");
	if (filters.showMoney) activeFilterLabels.push("Money");
	if (filters.showChallenge) activeFilterLabels.push("Challenge");
	if (searchQuery.trim()) activeFilterLabels.push(`Search: "${searchQuery.trim()}"`);
	const hasActiveFilters = activeFilterLabels.length > 0;

	return (
		<div className="space-y-4">
			<div className="space-y-2">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<div className="font-display text-[11px] tracking-widest text-muted-foreground">
						ACTIVE FILTERS {hasActiveFilters ? `(${activeFilterLabels.length})` : "(0)"}
					</div>
					{hasActiveFilters ? (
						<button
							type="button"
							onClick={onResetAll}
							className="arena-badge px-2 py-1 text-[10px] hover:border-primary/60"
						>
							CLEAR ALL
						</button>
					) : null}
				</div>
				<div className="flex flex-wrap items-center gap-2 text-xs font-display tracking-widest text-muted-foreground">
					<span className="arena-badge px-2 py-1">SORT: {sortLabels[sortBy]}</span>
					{hasActiveFilters ? (
						activeFilterLabels.map((label) => (
							<span key={label} className="arena-badge arena-badge-primary px-2 py-1">
								{label}
							</span>
						))
					) : (
						<span className="arena-badge px-2 py-1">ALL LOBBIES</span>
					)}
				</div>
			</div>

			<div className="flex flex-col sm:flex-row gap-3">
				<div className="relative flex-1 min-w-0">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
					<Input
						placeholder="Search lobbies..."
						value={searchQuery}
						onChange={(e) => onSearchChange(e.target.value)}
						className="pl-9"
					/>
				</div>
				<Select value={sortBy} onValueChange={(v) => onSortChange(v as LobbySortBy)}>
					<SelectTrigger className="w-full sm:w-56">
						<SelectValue placeholder="Sort order" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="last_interacted">Last interacted</SelectItem>
						<SelectItem value="newest">Date created (newest)</SelectItem>
						<SelectItem value="oldest">Date created (oldest)</SelectItem>
						<SelectItem value="season_latest">Season start (latest)</SelectItem>
						<SelectItem value="season_earliest">Season start (earliest)</SelectItem>
						<SelectItem value="name_az">Name (A → Z)</SelectItem>
						<SelectItem value="name_za">Name (Z → A)</SelectItem>
					</SelectContent>
				</Select>
			</div>

			<div className="flex flex-wrap gap-2">
				<Button
					variant={filters.showMine ? "arenaPrimary" : "outline"}
					size="sm"
					onClick={() => toggleFilter("showMine")}
					className="font-display text-xs"
				>
					My Lobbies
				</Button>
				<Button
					variant={filters.showActive ? "arenaPrimary" : "outline"}
					size="sm"
					onClick={() => toggleFilter("showActive")}
					className="font-display text-xs"
				>
					Active
				</Button>
				<Button
					variant={filters.showCompleted ? "arenaPrimary" : "outline"}
					size="sm"
					onClick={() => toggleFilter("showCompleted")}
					className="font-display text-xs"
				>
					Completed
				</Button>
				<div className="hidden sm:block w-px bg-border mx-1" />
				<Button
					variant={filters.showMoney ? "arenaPrimary" : "outline"}
					size="sm"
					onClick={() => toggleFilter("showMoney")}
					className="font-display text-xs"
				>
					Money
				</Button>
				<Button
					variant={filters.showChallenge ? "arenaPrimary" : "outline"}
					size="sm"
					onClick={() => toggleFilter("showChallenge")}
					className="font-display text-xs"
				>
					Challenge
				</Button>
			</div>

			{filteredCount !== totalCount && (
				<p className="font-mono text-xs text-muted-foreground">
					Showing {filteredCount} of {totalCount} lobbies
				</p>
			)}
		</div>
	);
}
