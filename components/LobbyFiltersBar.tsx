"use client";

import { useState, useMemo } from "react";

export type SortOption = 
	| "newest"
	| "oldest"
	| "season_earliest"
	| "season_latest"
	| "name_az"
	| "name_za";

export type FilterOptions = {
	showMine: boolean;
	showActive: boolean;
	showCompleted: boolean;
	showMoney: boolean;
	showChallenge: boolean;
};

export function LobbyFiltersBar({
	searchQuery,
	onSearchChange,
	sortBy,
	onSortChange,
	filters,
	onFiltersChange,
	totalCount,
	filteredCount
}: {
	searchQuery: string;
	onSearchChange: (query: string) => void;
	sortBy: SortOption;
	onSortChange: (sort: SortOption) => void;
	filters: FilterOptions;
	onFiltersChange: (filters: FilterOptions) => void;
	totalCount: number;
	filteredCount: number;
}) {
	const [showFilters, setShowFilters] = useState<boolean>(false);

	return (
		<div className="paper-card paper-grain ink-edge p-4 mb-6">
			{/* Search Bar */}
			<div className="mb-4">
				<input
					type="text"
					placeholder="Search lobbies…"
					value={searchQuery}
					onChange={(e) => onSearchChange(e.target.value)}
					className="w-full px-4 py-2 rounded-md border border-deepBrown/30 bg-cream text-deepBrown placeholder:text-deepBrown/50 focus:outline-none focus:ring-2 focus:ring-accent-primary/50 focus:border-accent-primary"
				/>
			</div>

			{/* Controls Row */}
			<div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
				{/* Sort Dropdown */}
				<div className="flex items-center gap-2 w-full sm:w-auto min-w-0">
					<label className="text-xs text-deepBrown/70 whitespace-nowrap shrink-0">Sort by:</label>
					<select
						value={sortBy}
						onChange={(e) => onSortChange(e.target.value as SortOption)}
						className="flex-1 sm:flex-initial min-w-0 px-3 py-2 rounded-md border border-deepBrown/30 bg-cream text-deepBrown text-xs focus:outline-none focus:ring-2 focus:ring-accent-primary/50 focus:border-accent-primary"
					>
						<option value="newest">Date created (newest first)</option>
						<option value="oldest">Date created (oldest first)</option>
						<option value="season_latest">Season start (latest first)</option>
						<option value="season_earliest">Season start (earliest first)</option>
						<option value="name_az">Name (A → Z)</option>
						<option value="name_za">Name (Z → A)</option>
					</select>
				</div>

				{/* Filter Toggle Button (Mobile) */}
				<button
					onClick={() => setShowFilters(!showFilters)}
					className="sm:hidden px-3 py-2 rounded-md border border-deepBrown/30 text-xs text-deepBrown/70 hover:bg-cream/50"
				>
					{showFilters ? "Hide Filters" : "Show Filters"} {showFilters ? "▲" : "▼"}
				</button>

				{/* Results Count */}
				<div className="text-xs text-deepBrown/70">
					{filteredCount === totalCount ? (
						<span>{totalCount} {totalCount === 1 ? "lobby" : "lobbies"}</span>
					) : (
						<span>
							{filteredCount} of {totalCount} {totalCount === 1 ? "lobby" : "lobbies"}
						</span>
					)}
				</div>
			</div>

			{/* Filter Checkboxes */}
			<div className={`mt-4 pt-4 border-t border-deepBrown/20 ${showFilters ? "block" : "hidden sm:block"}`}>
				<div className="flex flex-wrap gap-3 sm:gap-4 text-xs">
					<label className="inline-flex items-center gap-2 cursor-pointer">
						<input
							type="checkbox"
							checked={filters.showMine}
							onChange={(e) => onFiltersChange({ ...filters, showMine: e.target.checked })}
							className="w-4 h-4 rounded border-deepBrown/30 text-accent-primary focus:ring-2 focus:ring-accent-primary/50"
						/>
						<span>Show only lobbies I own</span>
					</label>
					<label className="inline-flex items-center gap-2 cursor-pointer">
						<input
							type="checkbox"
							checked={filters.showActive}
							onChange={(e) => onFiltersChange({ ...filters, showActive: e.target.checked })}
							className="w-4 h-4 rounded border-deepBrown/30 text-accent-primary focus:ring-2 focus:ring-accent-primary/50"
						/>
						<span>Show active only</span>
					</label>
					<label className="inline-flex items-center gap-2 cursor-pointer">
						<input
							type="checkbox"
							checked={filters.showCompleted}
							onChange={(e) => onFiltersChange({ ...filters, showCompleted: e.target.checked })}
							className="w-4 h-4 rounded border-deepBrown/30 text-accent-primary focus:ring-2 focus:ring-accent-primary/50"
						/>
						<span>Show completed</span>
					</label>
					<label className="inline-flex items-center gap-2 cursor-pointer">
						<input
							type="checkbox"
							checked={filters.showMoney}
							onChange={(e) => onFiltersChange({ ...filters, showMoney: e.target.checked })}
							className="w-4 h-4 rounded border-deepBrown/30 text-accent-primary focus:ring-2 focus:ring-accent-primary/50"
						/>
						<span>Money mode only</span>
					</label>
					<label className="inline-flex items-center gap-2 cursor-pointer">
						<input
							type="checkbox"
							checked={filters.showChallenge}
							onChange={(e) => onFiltersChange({ ...filters, showChallenge: e.target.checked })}
							className="w-4 h-4 rounded border-deepBrown/30 text-accent-primary focus:ring-2 focus:ring-accent-primary/50"
						/>
						<span>Challenge mode only</span>
					</label>
				</div>
			</div>
		</div>
	);
}

