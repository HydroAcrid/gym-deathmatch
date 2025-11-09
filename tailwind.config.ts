import type { Config } from "tailwindcss";

export default {
	content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./data/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
	theme: {
		extend: {
			colors: {
				cream: "#1E1714",       // dark cream (background)
				tan: "#2B211D",         // dark tan (cards)
				burntOrange: "#E1542A", // accent
				deepBrown: "#F5E7D3",   // light text on dark surfaces
				mutedTeal: "#7FA39A",   // secondary accent
				neonBlue: "#00FFFF",
				neonPink: "#FF00FF",
				neonPurple: "#A020F0",
				darkBg: "#0B002B",
				magentaGlow: "#E4007C"
			},
			boxShadow: {
				"glow-cyan": "0 0 15px #00FFFF",
				"glow-pink": "0 0 15px #FF00FF",
				"glow-purple": "0 0 20px #A020F0"
			}
		}
	},
	plugins: []
} satisfies Config;


