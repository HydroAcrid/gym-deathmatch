 "use client";
 
 import { useEffect, useState } from "react";
 
 export type Theme = "light" | "dark";
 
 export function useTheme() {
 	const [theme, setThemeState] = useState<Theme>("light");
 
 	useEffect(() => {
 		try {
 			const stored = localStorage.getItem("theme");
 			let t: Theme | null = stored === "dark" || stored === "light" ? (stored as Theme) : null;
 			if (!t) {
 				const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
 				t = prefersDark ? "dark" : "light";
 			}
 			applyTheme(t);
 		} catch {
 			applyTheme("light");
 		}
 		// eslint-disable-next-line react-hooks/exhaustive-deps
 	}, []);
 
 	function applyTheme(t: Theme) {
 		setThemeState(t);
 		if (typeof document !== "undefined") {
 			document.documentElement.classList.toggle("dark", t === "dark");
 		}
 		try {
 			localStorage.setItem("theme", t);
 		} catch { /* ignore */ }
 	}
 
 	function setTheme(t: Theme) {
 		applyTheme(t);
 	}
 
 	function toggleTheme() {
 		setTheme(theme === "dark" ? "light" : "dark");
 	}
 
 	return { theme, setTheme, toggleTheme };
 }
 

