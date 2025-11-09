"use client";

export function QuipBubble({ text }: { text: string }) {
	return (
		<div className="relative bg-cream border border-deepBrown/20 text-deepBrown rounded-md px-3 py-2 ink-edge">
			<span className="font-playfair text-sm italic">{text}</span>
		</div>
	);
}


