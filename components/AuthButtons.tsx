"use client";

import { useAuth } from "./AuthProvider";

export function AuthButtons() {
	const { user, signInWithGoogle, signOut } = useAuth();
	return (
		<div className="flex items-center gap-2">
			{user ? (
				<>
					<span className="text-[11px] text-deepBrown/70">{user.email}</span>
					<button className="px-2 py-1 rounded-md border border-deepBrown/30 text-[11px]" onClick={signOut}>Sign out</button>
				</>
			) : (
				<button className="px-2 py-1 rounded-md border border-deepBrown/30 text-[11px]" onClick={signInWithGoogle}>Sign in</button>
			)}
		</div>
	);
}


