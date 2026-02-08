"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

type Toast = { id: string; message: string };

const ToastCtx = createContext<{ push: (message: string) => void } | null>(null);

export function useToast() {
	const ctx = useContext(ToastCtx);
	if (!ctx) throw new Error("ToastProvider missing");
	return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
	const [toasts, setToasts] = useState<Toast[]>([]);
	const push = useCallback((message: string) => {
		const id = Math.random().toString(36).slice(2);
		setToasts((t) => [...t, { id, message }]);
		setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2500);
	}, []);
	const value = useMemo(() => ({ push }), [push]);
	return (
		<ToastCtx.Provider value={value}>
			{children}
			<div className="fixed bottom-4 right-4 z-50 space-y-2 sm:bottom-4">
				<AnimatePresence>
					{toasts.map((t) => (
						<motion.div key={t.id}
							initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
							className="scoreboard-panel px-3 py-2 text-sm bg-card text-foreground">
							{t.message}
						</motion.div>
					))}
				</AnimatePresence>
			</div>
		</ToastCtx.Provider>
	);
}


