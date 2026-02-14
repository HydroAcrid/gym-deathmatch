"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { OwnerSettingsModal } from "@/components/OwnerSettingsModal";
import { useAuth } from "@/components/AuthProvider";
import { CreateLobby } from "@/components/CreateLobby";
import { Button } from "@/src/ui2/ui/button";
import { LobbyCard } from "@/src/ui2/components/LobbyCard";
import { LobbyFiltersBar, type LobbySortBy, type LobbyFilters } from "@/src/ui2/components/LobbyFiltersBar";
import { mapLobbyRowToCard } from "@/src/ui2/adapters/lobby";
import { authFetch } from "@/lib/clientAuth";
import { useLastLobbySnapshot } from "@/hooks/useLastLobby";
import { LOBBY_INTERACTIONS_STORAGE_KEY, type LobbyInteractionsSnapshot } from "@/lib/localStorageKeys";

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
	player_count?: number;
};

function toMs(value?: string): number {
	if (!value) return 0;
	const ms = new Date(value).getTime();
	return Number.isFinite(ms) ? ms : 0;
}

export default function LobbiesPage() {
	const [allLobbies, setAllLobbies] = useState<LobbyRow[]>([]);
	const [editLobby, setEditLobby] = useState<LobbyRow | null>(null);
	const [nowMs] = useState<number>(() => Date.now());
	const [interactionSnapshot, setInteractionSnapshot] = useState<LobbyInteractionsSnapshot>({});
	const { user, isHydrated } = useAuth();
	const userId = user?.id ?? null;
	const [searchQuery, setSearchQuery] = useState<string>("");
	const [debouncedSearch, setDebouncedSearch] = useState<string>("");
	const [sortBy, setSortBy] = useState<LobbySortBy>("newest");
	const lastLobby = useLastLobbySnapshot();
	const interactionMsByLobby = useMemo(() => {
		const entries = Object.entries(interactionSnapshot || {}).map(([id, iso]) => [id, toMs(iso)] as const);
		return new Map(entries);
	}, [interactionSnapshot]);

	const effectiveRecentLobby = useMemo(() => {
		if (!allLobbies.length) return null;
		const byInteraction = [...allLobbies]
			.sort((a, b) => (interactionMsByLobby.get(b.id) ?? 0) - (interactionMsByLobby.get(a.id) ?? 0))
			.find((lobby) => (interactionMsByLobby.get(lobby.id) ?? 0) > 0);
		if (byInteraction) return byInteraction;
		if (lastLobby?.id) {
			const exact = allLobbies.find((lobby) => lobby.id === lastLobby.id);
			if (exact) return exact;
		}
		return [...allLobbies].sort((a, b) => {
			const aMs = Math.max(toMs(a.created_at), toMs(a.season_start));
			const bMs = Math.max(toMs(b.created_at), toMs(b.season_start));
			return bMs - aMs;
		})[0] ?? null;
	}, [allLobbies, interactionMsByLobby, lastLobby]);
	const [filters, setFilters] = useState<LobbyFilters>({
		showRecent: true,
		showMine: false, // Default to false so users see all lobbies they're a member of or own
		showActive: false,
		showCompleted: false,
		showMoney: false,
		showChallenge: false,
	});

	useEffect(() => {
		if (typeof window === "undefined") return;
		const read = () => {
			try {
				const raw = window.localStorage.getItem(LOBBY_INTERACTIONS_STORAGE_KEY);
				if (!raw) {
					setInteractionSnapshot({});
					return;
				}
				const parsed = JSON.parse(raw) as LobbyInteractionsSnapshot;
				setInteractionSnapshot(parsed && typeof parsed === "object" ? parsed : {});
			} catch {
				setInteractionSnapshot({});
			}
		};
		read();
		const handle = () => read();
		window.addEventListener("storage", handle);
		window.addEventListener("gymdm:last-lobby", handle as EventListener);
		return () => {
			window.removeEventListener("storage", handle);
			window.removeEventListener("gymdm:last-lobby", handle as EventListener);
		};
	}, []);

	const reloadLobbies = useCallback(async () => {
		// CRITICAL: Only fetch if auth is hydrated and user exists
		// This prevents race conditions where we fetch before auth is ready
		if (!isHydrated) {
			console.log("[lobbies] Skipping fetch - auth not hydrated yet");
			return;
		}
		
		if (!userId) {
			console.log("[lobbies] No user ID - user not signed in");
			setAllLobbies([]);
			return;
		}
		
		console.log("[lobbies] Fetching lobbies for user:", userId);
		const url = `/api/lobbies`;
		try {
			const res = await authFetch(url);
			const data = await res.json();
			setAllLobbies(data.lobbies ?? []);
		} catch (err) {
			console.error("[lobbies] Fetch error:", err);
			setAllLobbies([]);
		}
	}, [isHydrated, userId]);

	// Only fetch lobbies after auth is hydrated AND user exists
	useEffect(() => {
		if (!isHydrated) return; // Wait for auth hydration
		const timer = setTimeout(() => {
			void reloadLobbies();
		}, 0);
		return () => clearTimeout(timer);
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
		if (filters.showMine && userId) {
			filtered = filtered.filter(l => userId === l.owner_user_id);
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

		const sortBySelectedMode = (a: LobbyRow, b: LobbyRow) => {
			switch (sortBy) {
				case "newest":
					return toMs(b.created_at) - toMs(a.created_at);
				case "oldest":
					return toMs(a.created_at) - toMs(b.created_at);
				case "season_latest":
					return toMs(b.season_start) - toMs(a.season_start);
				case "season_earliest":
					return toMs(a.season_start) - toMs(b.season_start);
				case "name_az":
					return (a.name || "").localeCompare(b.name || "");
				case "name_za":
					return (b.name || "").localeCompare(a.name || "");
				default:
					return 0;
			}
		};

		// Recent now means "most recently interacted lobbies first", not "single recent lobby only".
		if (filters.showRecent) {
			filtered.sort((a, b) => {
				const interactionDiff = (interactionMsByLobby.get(b.id) ?? 0) - (interactionMsByLobby.get(a.id) ?? 0);
				if (interactionDiff !== 0) return interactionDiff;
				return sortBySelectedMode(a, b);
			});
		} else {
			filtered.sort(sortBySelectedMode);
		}

		return filtered;
	}, [allLobbies, debouncedSearch, filters, interactionMsByLobby, sortBy, userId]);

	// Calculate days ago
	const getDaysAgo = (createdAt?: string) => {
		if (!createdAt) return null;
		const created = new Date(createdAt).getTime();
		const diffMs = nowMs - created;
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
		if (diffDays === 0) return "Today";
		if (diffDays === 1) return "1 day ago";
		return `${diffDays} days ago`;
	};

	const isOwner = (l: LobbyRow) => Boolean(userId && l.owner_user_id === userId);

	return (
		<div className="min-h-screen">
			<div className="mx-auto max-w-6xl space-y-6 py-6 sm:py-8">
				<header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<h1 className="font-display text-3xl md:text-4xl font-black uppercase tracking-tight text-foreground">
							Your Lobbies
						</h1>
						<p className="font-mono text-sm text-muted-foreground">
							{filteredAndSortedLobbies.length} of {allLobbies.length} lobbies
						</p>
						<div className="text-xs text-muted-foreground break-all">
							{user?.email ? `Signed in as ${user.email}` : "Sign in to manage your lobbies"}
						</div>
					</div>
					<CreateLobby>
						<Button variant="arenaPrimary" className="w-full sm:w-auto justify-center">
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
					onResetAll={() => {
						setSearchQuery("");
						setFilters({
							showRecent: true,
							showMine: false,
							showActive: false,
							showCompleted: false,
							showMoney: false,
							showChallenge: false,
						});
						setSortBy("newest");
					}}
					recentLobbyName={effectiveRecentLobby?.name ?? null}
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
							const card = mapLobbyRowToCard(l, { userId: userId ?? undefined, createdAgo: daysAgo });
							return (
								<LobbyCard
									key={l.id}
									lobby={card}
									onEdit={() => setEditLobby(l)}
									onLeave={async (lobbyId) => {
										if (!userId) return;
										await authFetch(`/api/lobby/${encodeURIComponent(lobbyId)}/leave`, {
											method: "POST",
										});
										reloadLobbies();
									}}
									showLeave={Boolean(userId)}
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
