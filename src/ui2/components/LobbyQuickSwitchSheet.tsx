"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Loader2, Swords } from "lucide-react";
import { useRouter } from "next/navigation";
import { authFetch } from "@/lib/clientAuth";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/src/ui2/ui/sheet";
import { Button } from "@/src/ui2/ui/button";

type LobbyListItem = {
	id: string;
	name: string;
	season_number?: number;
	status?: string;
	mode?: string;
	player_count?: number;
};

interface LobbyQuickSwitchSheetProps {
	currentLobbyId: string;
	currentLobbyName: string;
}

function mapStatusLabel(status?: string): string {
	if (status === "completed") return "COMPLETED";
	if (status === "active") return "ACTIVE";
	if (status === "transition_spin") return "ACTIVE";
	if (status === "scheduled") return "PRE-STAGE";
	return "PRE-STAGE";
}

export function LobbyQuickSwitchSheet({ currentLobbyId, currentLobbyName }: LobbyQuickSwitchSheetProps) {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [loading, setLoading] = useState(false);
	const [items, setItems] = useState<LobbyListItem[]>([]);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!open) return;
		let cancelled = false;

		(async () => {
			setLoading(true);
			setError(null);
			try {
				const response = await authFetch("/api/lobbies", { cache: "no-store" });
				const body = await response.json().catch(() => ({ lobbies: [] }));
				if (!response.ok) {
					if (!cancelled) setError(typeof body?.error === "string" ? body.error : "Failed to load lobbies.");
					return;
				}
				if (!cancelled) {
					const list = Array.isArray(body?.lobbies) ? (body.lobbies as LobbyListItem[]) : [];
					setItems(list);
				}
			} catch {
				if (!cancelled) setError("Failed to load lobbies.");
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [open]);

	const sortedItems = useMemo(() => {
		return [...items].sort((a, b) => {
			if (a.id === currentLobbyId) return -1;
			if (b.id === currentLobbyId) return 1;
			return a.name.localeCompare(b.name);
		});
	}, [items, currentLobbyId]);

	return (
		<Sheet open={open} onOpenChange={setOpen}>
			<SheetTrigger asChild>
				<button
					type="button"
					className="inline-flex max-w-full items-center gap-2 border-2 border-border bg-muted/40 px-3 py-2 text-left"
				>
					<Swords className="h-4 w-4 text-primary" />
					<span className="truncate font-display text-xs tracking-widest text-foreground">{currentLobbyName}</span>
					<ChevronDown className="h-4 w-4 text-muted-foreground" />
				</button>
			</SheetTrigger>
			<SheetContent
				side="bottom"
				className="max-h-[75vh] overflow-y-auto border-t-2 border-border bg-card p-0 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]"
			>
				<SheetHeader className="border-b-2 border-border px-4 py-3 text-left">
					<SheetTitle className="font-display text-base tracking-widest text-primary">SWITCH LOBBY</SheetTitle>
					<div className="font-mono text-[11px] text-muted-foreground">
						Quick switch between lobbies without leaving the arena.
					</div>
				</SheetHeader>
				<div className="px-3 py-3">
					{loading ? (
						<div className="flex items-center gap-2 px-2 py-4 text-sm text-muted-foreground">
							<Loader2 className="h-4 w-4 animate-spin" />
							Loading lobbies...
						</div>
					) : error ? (
						<div className="border-2 border-destructive/40 bg-destructive/10 px-3 py-3 text-xs text-destructive">{error}</div>
					) : sortedItems.length === 0 ? (
						<div className="px-2 py-4 text-xs text-muted-foreground">No lobbies available.</div>
					) : (
						<div className="space-y-2">
							{sortedItems.map((item) => {
								const active = item.id === currentLobbyId;
								return (
									<button
										key={item.id}
										type="button"
										onClick={() => {
											setOpen(false);
											if (active) return;
											router.push(`/lobby/${encodeURIComponent(item.id)}`);
										}}
										className={`w-full border-2 px-3 py-2 text-left transition-colors ${
											active
												? "border-primary bg-primary/10"
												: "border-border bg-muted/20 hover:border-primary/60"
										}`}
									>
										<div className="flex items-center justify-between gap-2">
											<div className="min-w-0">
												<div className="truncate font-display text-xs tracking-widest text-foreground">
													{item.name}
													{active ? " (CURRENT)" : ""}
												</div>
												<div className="mt-1 font-display text-[10px] tracking-widest text-muted-foreground">
													SEASON {item.season_number ?? 1} • {mapStatusLabel(item.status)}
												</div>
											</div>
											<div className="shrink-0 font-display text-[10px] tracking-widest text-muted-foreground">
												{typeof item.player_count === "number" ? `${item.player_count} ATH` : ""}
											</div>
										</div>
									</button>
								);
							})}
						</div>
					)}
				</div>
				<div className="border-t-2 border-border px-3 py-3">
					<Button
						variant="outline"
						size="sm"
						className="w-full font-display text-xs tracking-widest"
						onClick={() => {
							setOpen(false);
							router.push("/lobbies");
						}}
					>
						OPEN FULL LOBBY LIST
					</Button>
				</div>
			</SheetContent>
		</Sheet>
	);
}
