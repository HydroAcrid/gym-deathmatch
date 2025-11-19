"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { OwnerSettingsModal } from "@/components/OwnerSettingsModal";
import { useAuth } from "@/components/AuthProvider";
import { LobbyFiltersBar, type SortOption, type FilterOptions } from "@/components/LobbyFiltersBar";
import { motion } from "framer-motion";

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
	const [playerId, setPlayerId] = useState<string | null>(null);
	const [editLobby, setEditLobby] = useState<LobbyRow | null>(null);
	const { user, isHydrated } = useAuth();
	const [searchQuery, setSearchQuery] = useState<string>("");
	const [debouncedSearch, setDebouncedSearch] = useState<string>("");
	const [sortBy, setSortBy] = useState<SortOption>("newest");
	const [filters, setFilters] = useState<FilterOptions>({
		showMine: false, // Default to false so users see all lobbies they're a member of or own
		showActive: false,
		showCompleted: false,
		showMoney: false,
		showChallenge: false,
	});

	useEffect(() => {
		const me = localStorage.getItem("gymdm_playerId");
		setPlayerId(me);
	}, []);
	
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
			filtered = filtered.filter(l => 
				(user.id === l.owner_user_id) || 
				(playerId && l.owner_id === playerId)
			);
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
	}, [allLobbies, debouncedSearch, filters, sortBy, user?.id, playerId]);

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

	const isOwner = (l: LobbyRow) => 
		(playerId && l.owner_id === playerId) || (user?.id && l.owner_user_id === user.id);

	return (
		<div className="mx-auto max-w-6xl px-4 sm:px-6">
			{/* Header */}
			<div className="paper-card paper-grain ink-edge p-5 mb-6 border-b-4" style={{ borderColor: "#E1542A" }}>
				<div className="poster-headline text-lg mb-1">LOBBIES</div>
				<div className="text-deepBrown/70 text-xs">
					{user?.email ? `Signed in as ${user.email}` : playerId ? `Player: ${playerId}` : "Not joined yet — use Join Lobby to create your player"}
				</div>
			</div>

			{/* Filters Bar */}
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

			{/* Loading state while auth hydrates */}
			{!isHydrated ? (
				<div className="paper-card paper-grain ink-edge p-8 text-center">
					<div className="text-deepBrown/70 text-sm">Loading your account...</div>
				</div>
			) : filteredAndSortedLobbies.length === 0 ? (
				<div className="paper-card paper-grain ink-edge p-8 text-center">
					<div className="text-deepBrown/70 text-sm">
						{allLobbies.length === 0 
							? (user ? "No lobbies yet. Create one from the navbar." : "Sign in to see your lobbies.")
							: "No lobbies found."}
					</div>
				</div>
			) : (
				<div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
					{filteredAndSortedLobbies.map((l) => {
						const mode = String(l.mode || "MONEY_SURVIVAL");
						const isMoney = mode.startsWith("MONEY_");
						const daysAgo = getDaysAgo(l.created_at);
						
						return (
							<motion.div
								key={l.id}
								initial={{ opacity: 0, y: 12 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ duration: 0.3 }}
								className="paper-card paper-grain ink-edge p-4 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 border border-deepBrown/20 hover:border-accent-primary/40"
							>
								{/* Header with name and owner badge */}
								<div className="mb-3">
									<Link 
										href={`/lobby/${l.id}`} 
										className="poster-headline text-lg hover:text-accent-primary transition-colors inline-block"
									>
										{l.name}
									</Link>
									{isOwner(l) && (
										<span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] border border-deepBrown/40 bg-cream/20">
											Owner
										</span>
									)}
								</div>

								{/* Metadata Row */}
								<div className="text-deepBrown/70 text-xs mb-3 space-y-1">
									<div className="flex items-center gap-2 flex-wrap">
										<span>Season {l.season_number}</span>
										{isMoney && <span>• <span className="inline-flex items-center gap-0.5">💰 ${l.cash_pool}</span></span>}
										{typeof l.weekly_target === "number" && (
											<span>• <span className="inline-flex items-center gap-0.5">🎯 {l.weekly_target}/wk</span></span>
										)}
										{typeof l.initial_lives === "number" && (
											<span>• <span className="inline-flex items-center gap-0.5">❤️ {l.initial_lives}</span></span>
										)}
									</div>
									<div className="text-[11px]">
										Mode: {mode.replace(/_/g, " ")}
									</div>
									{l.season_start && l.season_end && (
										<div className="text-[11px]">
											{new Date(l.season_start).toLocaleDateString()} → {new Date(l.season_end).toLocaleDateString()}
										</div>
									)}
									{daysAgo && (
										<div className="text-[10px] text-deepBrown/50 mt-2">
											Created {daysAgo}
										</div>
									)}
								</div>

								{/* Action Buttons */}
								<div className="mt-4 pt-3 border-t border-deepBrown/20 flex flex-col sm:flex-row gap-2">
									<Link 
										href={`/lobby/${l.id}`} 
										className="btn-vintage px-3 py-2 rounded-md text-xs text-center flex-1"
									>
										Open
									</Link>
									{isOwner(l) ? (
										<button 
											className="btn-secondary px-3 py-2 rounded-md text-xs flex-1" 
											onClick={() => setEditLobby(l)}
										>
											Edit
										</button>
									) : user?.id ? (
										<button
											className="px-3 py-2 rounded-md border border-deepBrown/30 text-xs hover:bg-cream/10 transition-colors flex-1"
											onClick={async () => {
												const ok = confirm(`Leave "${l.name}"?`);
												if (!ok) return;
												await fetch(`/api/lobby/${encodeURIComponent(l.id)}/leave`, {
													method: "POST",
													headers: { "Content-Type": "application/json" },
													body: JSON.stringify({ userId: user.id })
												});
												reloadLobbies();
											}}
										>
											Leave
										</button>
									) : null}
								</div>
							</motion.div>
						);
					})}
				</div>
			)}
			{editLobby && ((playerId && editLobby.owner_id === playerId) || (user?.id && editLobby.owner_user_id === user.id)) && (
				<OwnerSettingsModal
					lobbyId={editLobby.id}
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
	);
}


