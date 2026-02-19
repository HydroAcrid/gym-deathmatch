"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/src/ui2/ui/dialog";
import { formatLocalDate } from "@/lib/datetime";
import type { WhatsNewEntry } from "@/lib/whatsNew";

type WhatsNewDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	entry: WhatsNewEntry | null;
	entries?: WhatsNewEntry[];
};

export function WhatsNewDialog({ open, onOpenChange, entry, entries = [] }: WhatsNewDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="border-2 border-border bg-background w-[95vw] max-w-2xl max-h-[86vh] overflow-y-auto arena-scrollbar p-0">
				<div className="p-5 sm:p-6 border-b border-border">
					<DialogHeader className="text-left">
						<DialogTitle className="font-display text-xl tracking-widest text-primary">WHAT&apos;S NEW</DialogTitle>
						<DialogDescription className="text-xs sm:text-sm text-muted-foreground">
							Release highlights after your latest update.
						</DialogDescription>
					</DialogHeader>
				</div>
				<div className="p-5 sm:p-6 space-y-5">
					{entry ? (
						<>
							<div className="scoreboard-panel p-4 space-y-2">
								<div className="flex items-center justify-between gap-3 flex-wrap">
									<div className="font-display text-sm sm:text-base tracking-wider text-foreground">{entry.title}</div>
									<div className="arena-badge arena-badge-primary text-[10px]">
										{entry.releaseId.slice(0, 7)}
									</div>
								</div>
								<div className="text-xs text-muted-foreground">
									Deployed {formatLocalDate(entry.deployedAt, { month: "short", day: "numeric", year: "numeric" })}
								</div>
							</div>
							<div className="space-y-2">
								<div className="font-display text-xs tracking-widest text-muted-foreground">HIGHLIGHTS</div>
								<ul className="space-y-2">
									{entry.bullets.map((bullet, idx) => (
										<li
											key={`${entry.releaseId}-${idx}`}
											className="text-sm text-foreground border border-border bg-muted/10 px-3 py-2"
										>
											{bullet}
										</li>
									))}
								</ul>
							</div>
							{entry.links.length > 0 && (
								<div className="flex flex-wrap gap-2">
									{entry.links.map((link) => (
										<a
											key={`${entry.releaseId}-${link.href}`}
											href={link.href}
											target={link.href.startsWith("http") ? "_blank" : undefined}
											rel={link.href.startsWith("http") ? "noreferrer" : undefined}
											className="arena-badge px-3 py-2 text-xs"
										>
											{link.label}
										</a>
									))}
								</div>
							)}
						</>
					) : (
						<div className="text-sm text-muted-foreground">No update notes available yet.</div>
					)}
					{entries.length > 1 && (
						<div className="space-y-2 border-t border-border pt-4">
							<div className="font-display text-xs tracking-widest text-muted-foreground">PREVIOUS UPDATES</div>
							<div className="space-y-2">
								{entries.slice(1, 6).map((previous) => (
									<div key={previous.releaseId} className="border border-border bg-muted/5 px-3 py-2">
										<div className="font-display text-xs tracking-wider text-foreground">{previous.title}</div>
										<div className="text-[11px] text-muted-foreground">
											{formatLocalDate(previous.deployedAt, { month: "short", day: "numeric", year: "numeric" })} •{" "}
											{previous.releaseId.slice(0, 7)}
										</div>
									</div>
								))}
							</div>
						</div>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}
