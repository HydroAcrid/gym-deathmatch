import { Lobby } from "@/types/game";

export const defaultLobby: Lobby = {
	id: "kevin-nelly",
	name: "Kevin & Nelly’s Deathmatch Lobby",
	seasonNumber: 1,
	seasonStart: new Date(new Date().getFullYear(), 0, 1).toISOString(),
	seasonEnd: new Date(new Date().getFullYear(), 11, 31).toISOString(),
	cashPool: 120,
	weeklyTarget: 3,
	initialLives: 3,
	ownerId: "kevin",
	players: [
		{
			id: "kevin",
			name: "Kevin",
			avatarUrl: "",
			location: "NYC",
			currentStreak: 4,
			longestStreak: 9,
			livesRemaining: 3,
			totalWorkouts: 27,
			averageWorkoutsPerWeek: 3.5,
			quip: "Gym kryptonite: post-work social plans.",
			isStravaConnected: false
		},
		{
			id: "nelly",
			name: "Nelly",
			avatarUrl: "",
			location: "Boston",
			currentStreak: 6,
			longestStreak: 10,
			livesRemaining: 2,
			totalWorkouts: 32,
			averageWorkoutsPerWeek: 4.1,
			quip: "Natural enemy: cold weather.",
			isStravaConnected: false
		}
	]
};


