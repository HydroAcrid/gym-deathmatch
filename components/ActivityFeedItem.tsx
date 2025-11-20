"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ActivityRow, PlayerLite } from "@/types/game";

export function ActivityFeedItem({
	activity,
	votes,
	players,
	onVote,
	onComment,
	onDelete,
	currentUserId,
	onImageClick
}: {
	activity: ActivityRow;
	votes: { legit: number; sus: number; mine?: "legit" | "sus" };
	players: PlayerLite[];
	onVote: (id: string, type: "legit" | "sus") => void;
	onComment: (id: string, text: string) => void;
	onDelete?: () => void;
	currentUserId?: string;
	onImageClick?: (url: string) => void;
}) {
	const [comment, setComment] = useState("");
	const [showComments, setShowComments] = useState(false);
	const player = players.find(p => p.id === activity.playerId);
	const isMine = player?.userId === currentUserId;

	return (
		<div className="paper-card paper-grain ink-edge p-4 relative">
			<div className="flex items-start gap-3">
				{player?.avatarUrl ? (
					<img src={player.avatarUrl} alt={player.name} className="w-10 h-10 rounded-full object-cover border border-deepBrown/30" />
				) : (
					<div className="w-10 h-10 rounded-full bg-deepBrown/10 flex items-center justify-center text-lg">👤</div>
				)}
				<div className="flex-1 min-w-0">
					<div className="flex justify-between items-start">
						<div>
							<div className="font-bold text-sm">{player?.name || "Unknown Player"}</div>
							<div className="text-xs text-deepBrown/60">{new Date(activity.createdAt).toLocaleString()}</div>
						</div>
						{onDelete && (
							<button onClick={onDelete} className="text-red-500 text-xs hover:underline">Delete</button>
						)}
					</div>
					
					<div className="mt-2 text-sm">
						<div className="font-medium">
							{activity.type.toUpperCase()} · {activity.duration}m
							{activity.distance ? ` · ${activity.distance}km` : ""}
						</div>
						{activity.notes && <div className="mt-1 italic opacity-80">"{activity.notes}"</div>}
					</div>

					{activity.imageUrl && (
						<div className="mt-3 relative rounded-lg overflow-hidden border border-deepBrown/20 cursor-pointer group" onClick={() => onImageClick?.(activity.imageUrl!)}>
							<img src={activity.imageUrl} alt="Proof" className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-500" />
							<div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
						</div>
					)}

					<div className="mt-4 flex items-center gap-4 border-t border-deepBrown/10 pt-3">
						<button 
							onClick={() => onVote(activity.id, "legit")}
							className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ${votes.mine === "legit" ? "bg-green-100 text-green-800 font-bold" : "hover:bg-deepBrown/5"}`}
						>
							<span>🔥</span> Legit ({votes.legit})
						</button>
						<button 
							onClick={() => onVote(activity.id, "sus")}
							className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ${votes.mine === "sus" ? "bg-red-100 text-red-800 font-bold" : "hover:bg-deepBrown/5"}`}
						>
							<span>👀</span> Sus ({votes.sus})
						</button>
						<button 
							onClick={() => setShowComments(!showComments)}
							className="ml-auto text-xs text-deepBrown/60 hover:text-deepBrown"
						>
							Comments
						</button>
					</div>

					<AnimatePresence>
						{showComments && (
							<motion.div 
								initial={{ height: 0, opacity: 0 }} 
								animate={{ height: "auto", opacity: 1 }} 
								exit={{ height: 0, opacity: 0 }}
								className="overflow-hidden"
							>
								<div className="mt-3 pt-3 border-t border-deepBrown/10">
									<div className="flex gap-2">
										<input 
											type="text" 
											placeholder="Write a comment..." 
											className="flex-1 text-xs px-3 py-2 rounded border border-deepBrown/20 bg-white/50 focus:outline-none focus:border-accent-primary"
											value={comment}
											onChange={e => setComment(e.target.value)}
											onKeyDown={e => {
												if (e.key === "Enter") {
													onComment(activity.id, comment);
													setComment("");
												}
											}}
										/>
										<button 
											onClick={() => {
												onComment(activity.id, comment);
												setComment("");
											}}
											className="text-xs font-bold text-accent-primary px-2"
										>
											Post
										</button>
									</div>
								</div>
							</motion.div>
						)}
					</AnimatePresence>
				</div>
			</div>
		</div>
	);
}

