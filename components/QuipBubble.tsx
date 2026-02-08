"use client";

export function QuipBubble({ text }: { text: string }) {
	// Hide entirely if no text
	const raw = (text ?? "").trim();
	if (!raw) return null;
	// Clamp quip length to avoid overflowing the card
	const MAX = 140;
	const display = raw.length > MAX ? raw.slice(0, MAX).trimEnd() + "…" : raw;
	return (
		<div className="relative bg-muted/30 border border-border text-foreground rounded-md px-3 py-2">
			<span className="font-display text-sm italic" title={raw}>{display}</span>
		</div>
	);
}


