import { useState } from "react";
import { Dialog, DialogContent } from "@/src/ui2/ui/dialog";
import { Button } from "@/src/ui2/ui/button";
import { X, ZoomIn, ZoomOut, Download } from "lucide-react";

export interface PhotoLightboxProps {
	open: boolean;
	onClose: () => void;
	imageUrl: string;
	caption?: string;
	athleteName?: string;
	activityDate?: string;
}

export function PhotoLightbox({
	open,
	onClose,
	imageUrl,
	caption,
	athleteName,
	activityDate,
}: PhotoLightboxProps) {
	const [zoom, setZoom] = useState(1);

	const handleZoomIn = () => setZoom((z) => Math.min(z + 0.5, 3));
	const handleZoomOut = () => setZoom((z) => Math.max(z - 0.5, 0.5));
	const handleDownload = () => {
		window.open(imageUrl, "_blank");
	};

	return (
		<Dialog open={open} onOpenChange={onClose}>
			<DialogContent className="max-w-4xl w-full h-[90vh] p-0 bg-black/95 border-border">
				<div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent">
					<div>
						{athleteName && <p className="font-mono text-sm text-white">{athleteName}</p>}
						{activityDate && <p className="font-mono text-xs text-white/60">{activityDate}</p>}
					</div>
					<div className="flex items-center gap-2">
						<Button
							variant="ghost"
							size="icon"
							onClick={handleZoomOut}
							className="text-white hover:bg-white/20"
						>
							<ZoomOut className="w-5 h-5" />
						</Button>
						<span className="font-mono text-sm text-white/80 w-12 text-center">
							{Math.round(zoom * 100)}%
						</span>
						<Button
							variant="ghost"
							size="icon"
							onClick={handleZoomIn}
							className="text-white hover:bg-white/20"
						>
							<ZoomIn className="w-5 h-5" />
						</Button>
						<Button
							variant="ghost"
							size="icon"
							onClick={handleDownload}
							className="text-white hover:bg-white/20"
						>
							<Download className="w-5 h-5" />
						</Button>
						<Button
							variant="ghost"
							size="icon"
							onClick={onClose}
							className="text-white hover:bg-white/20"
						>
							<X className="w-5 h-5" />
						</Button>
					</div>
				</div>

				<div className="w-full h-full flex items-center justify-center overflow-auto p-8">
					<img
						src={imageUrl}
						alt={caption || "Workout photo"}
						className="max-w-full max-h-full object-contain transition-transform duration-200"
						style={{ transform: `scale(${zoom})` }}
					/>
				</div>

				{caption && (
					<div className="absolute bottom-0 left-0 right-0 z-10 p-4 bg-gradient-to-t from-black/80 to-transparent">
						<p className="font-mono text-sm text-white text-center">"{caption}"</p>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
