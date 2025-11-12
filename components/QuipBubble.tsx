"use client";

export function QuipBubble({ text }: { text: string }) {
	// Clamp quip length to avoid overflowing the card
	const MAX = 140;
	const display = (text || "").length > MAX ? (text || "").slice(0, MAX).trimEnd() + "…" : (text || "");
	return (
		<div className="relative bg-cream border border-deepBrown/20 text-deepBrown rounded-md px-3 py-2 ink-edge">
			<span className="font-playfair text-sm italic" title={text}>{display}</span>
		</div>
	);
}


