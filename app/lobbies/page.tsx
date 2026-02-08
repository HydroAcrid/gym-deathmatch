"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { OwnerSettingsModal } from "@/components/OwnerSettingsModal";
import { useAuth } from "@/components/AuthProvider";
import { CreateLobby } from "@/components/CreateLobby";
import { Button } from "@/src/ui2/ui/button";
import { LobbyCard } from "@/src/ui2/components/LobbyCard";
import { LobbyFiltersBar, type LobbySortBy, type LobbyFilters } from "@/src/ui2/components/LobbyFiltersBar";
import { mapLobbyRowToCard } from "@/src/ui2/adapters/lobby";

type LobbyRow = {
	id: string; 
	name: string; 
	season_number: number; 
	cash_pool: number;
	season_start?: string; 
	season_end?: string; 
	weekly_target?: number; 
	initial_lives?: number; 
	owner_id?: string; 
	owner_user_id?: string;
	created_at?: string;
	status?: string;
	mode?: string;
};

export default function LobbiesPage() {
	const [allLobbies, setAllLobbies] = useState<LobbyRow[]>([]);
	const [editLobby, setEditLobby] = useState<LobbyRow | null>(null);
	const { user, isHydrated } = useAuth();
	const [searchQuery, setSearchQuery] = useState<string>("");
	const [debouncedSearch, setDebouncedSearch] = useState<string>("");
	const [sortBy, setSortBy] = useState<LobbySortBy>("newest");
	const [filters, setFilters] = useState<LobbyFilters>({
		showMine: false, // Default to false so users see all lobbies they're a member of or own
		showActive: false,
		showCompleted: false,
		showMoney: false,
		showChallenge: false,
	});

	const reloadLobbies = useCallback(async () => {
		// CRITICAL: Only fetch if auth is hydrated and user exists
		// This prevents race conditions where we fetch before auth is ready
		if (!isHydrated) {
			console.log("[lobbies] Skipping fetch - auth not hydrated yet");
			return;
		}
		
		if (!user?.id) {
			console.log("[lobbies] No user ID - user not signed in");
			setAllLobbies([]);
			return;
		}
		
		console.log("[lobbies] Fetching lobbies for user:", user.id);
		const url = `/api/lobbies?userId=${encodeURIComponent(user.id)}`;
		try {
			const res = await fetch(url);
			const data = await res.json();
			setAllLobbies(data.lobbies ?? []);
		} catch (err) {
			console.error("[lobbies] Fetch error:", err);
			setAllLobbies([]);
		}
	}, [isHydrated, user?.id]);

	// Only fetch lobbies after auth is hydrated AND user exists
	useEffect(() => {
		if (!isHydrated) return; // Wait for auth hydration
		reloadLobbies();
	}, [isHydrated, reloadLobbies]);

	// Poll for lobby updates every 10 seconds
	useEffect(() => {
		const id = setInterval(() => {
			reloadLobbies();
		}, 10 * 1000);
		return () => clearInterval(id);
	}, [reloadLobbies]);

	// Debounce search input
	useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedSearch(searchQuery);
		}, 200);
		return () => clearTimeout(timer);
	}, [searchQuery]);

	// Filter and sort lobbies
	const filteredAndSortedLobbies = useMemo(() => {
		let filtered = [...allLobbies];

		// Apply search filter
		if (debouncedSearch.trim()) {
			const query = debouncedSearch.toLowerCase();
			filtered = filtered.filter(l => l.name.toLowerCase().includes(query));
		}

		// Apply "show mine" filter - filter to only owned lobbies
		if (filters.showMine && user?.id) {
			filtered = filtered.filter(l => user.id === l.owner_user_id);
		}

		// Apply status filters
		if (filters.showActive) {
			filtered = filtered.filter(l => l.status === "active" || l.status === "transition_spin");
		}
		if (filters.showCompleted) {
			filtered = filtered.filter(l => l.status === "completed");
		}

		// Apply mode filters
		if (filters.showMoney) {
			filtered = filtered.filter(l => String(l.mode || "").startsWith("MONEY_"));
		}
		if (filters.showChallenge) {
			filtered = filtered.filter(l => String(l.mode || "").startsWith("CHALLENGE_"));
		}

		// Apply sorting
		filtered.sort((a, b) => {
			switch (sortBy) {
				case "newest":
					const aCreated = a.created_at ? new Date(a.created_at).getTime() : 0;
					const bCreated = b.created_at ? new Date(b.created_at).getTime() : 0;
					return bCreated - aCreated;
				case "oldest":
					const aCreatedOld = a.created_at ? new Date(a.created_at).getTime() : 0;
					const bCreatedOld = b.created_at ? new Date(b.created_at).getTime() : 0;
					return aCreatedOld - bCreatedOld;
				case "season_latest":
					const aStart = a.season_start ? new Date(a.season_start).getTime() : 0;
					const bStart = b.season_start ? new Date(b.season_start).getTime() : 0;
					return bStart - aStart;
				case "season_earliest":
					const aStartEarly = a.season_start ? new Date(a.season_start).getTime() : 0;
					const bStartEarly = b.season_start ? new Date(b.season_start).getTime() : 0;
					return aStartEarly - bStartEarly;
				case "name_az":
					return (a.name || "").localeCompare(b.name || "");
				case "name_za":
					return (b.name || "").localeCompare(a.name || "");
				default:
					return 0;
			}
		});

		return filtered;
	}, [allLobbies, debouncedSearch, filters, sortBy, user?.id]);

	// Calculate days ago
	const getDaysAgo = (createdAt?: string) => {
		if (!createdAt) return null;
		const created = new Date(createdAt).getTime();
		const now = Date.now();
		const diffMs = now - created;
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
		if (diffDays === 0) return "Today";
		if (diffDays === 1) return "1 day ago";
		return `${diffDays} days ago`;
	};

	const isOwner = (l: LobbyRow) => Boolean(user?.id && l.owner_user_id === user.id);

	return (
		<div className="min-h-screen px-4 sm:px-6">
			<div className="mx-auto max-w-6xl space-y-6 py-8">
				<header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<h1 className="font-display text-3xl md:text-4xl font-black uppercase tracking-tight text-foreground">
							Your Lobbies
						</h1>
						<p className="font-mono text-sm text-muted-foreground">
							{filteredAndSortedLobbies.length} of {allLobbies.length} lobbies
						</p>
						<div className="text-xs text-muted-foreground">
							{user?.email ? `Signed in as ${user.email}` : "Sign in to manage your lobbies"}
						</div>
					</div>
					<CreateLobby>
						<Button variant="arenaPrimary">
							Create Lobby
						</Button>
					</CreateLobby>
				</header>

				<LobbyFiltersBar
					searchQuery={searchQuery}
					onSearchChange={setSearchQuery}
					sortBy={sortBy}
					onSortChange={setSortBy}
					filters={filters}
					onFiltersChange={setFilters}
					totalCount={allLobbies.length}
					filteredCount={filteredAndSortedLobbies.length}
				/>

				{!isHydrated ? (
					<div className="arena-panel p-8 text-center">
						<div className="text-muted-foreground text-sm">Loading your account...</div>
					</div>
				) : filteredAndSortedLobbies.length === 0 ? (
					<div className="arena-panel p-8 text-center">
						<div className="text-muted-foreground text-sm">
							{allLobbies.length === 0
								? (user ? "No lobbies yet. Create one from the navbar." : "Sign in to see your lobbies.")
								: "No lobbies found."}
						</div>
					</div>
				) : (
					<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
						{filteredAndSortedLobbies.map((l) => {
							const daysAgo = getDaysAgo(l.created_at);
							const card = mapLobbyRowToCard(l, { userId: user?.id, createdAgo: daysAgo });
							return (
								<LobbyCard
									key={l.id}
									lobby={card}
									onEdit={() => setEditLobby(l)}
									onLeave={async (lobbyId) => {
										if (!user?.id) return;
										await fetch(`/api/lobby/${encodeURIComponent(lobbyId)}/leave`, {
											method: "POST",
											headers: { "Content-Type": "application/json" },
											body: JSON.stringify({ userId: user.id }),
										});
										reloadLobbies();
									}}
									showLeave={Boolean(user?.id)}
								/>
							);
						})}
					</div>
				)}

				{editLobby && isOwner(editLobby) && (
					<OwnerSettingsModal
						lobbyId={editLobby.id}
						ownerPlayerId={editLobby.owner_id || null}
						defaultWeekly={editLobby.weekly_target ?? 3}
						defaultLives={editLobby.initial_lives ?? 3}
						defaultSeasonEnd={editLobby.season_end ?? new Date().toISOString()}
						autoOpen
						hideTrigger
						onSaved={() => { setEditLobby(null); reloadLobbies(); }}
						onClose={() => setEditLobby(null)}
					/>
				)}
			</div>
		</div>
	);
}
