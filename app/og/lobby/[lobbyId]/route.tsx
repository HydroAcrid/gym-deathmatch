import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { getServerSupabase } from "@/lib/supabaseClient";

export const runtime = "edge";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ lobbyId: string }> }) {
	const { lobbyId } = await params;
	const decodedLobbyId = decodeURIComponent(lobbyId);
	let name = "Gym Deathmatch";
	let subtitle = "Join the Deathmatch";
	try {
		const supabase = getServerSupabase();
		if (supabase) {
			const { data: lrow } = await supabase.from("lobby").select("*").eq("id", decodedLobbyId).single();
			if (lrow?.name) {
				name = lrow.name;
				let owner = "Your friend";
				if (lrow.owner_id) {
					const { data: prow } = await supabase.from("player").select("name").eq("id", lrow.owner_id).maybeSingle();
					if (prow?.name) owner = prow.name;
				}
				subtitle = `${owner} invites you to the Deathmatch`;
			}
		}
	} catch {
		// ignore
	}
	const bg = "#2B211D";
	const cream = "#F7E7C6";
	const orange = "#E1542A";
	return new ImageResponse(
		(
			<div
				style={{
					fontFamily: "sans-serif",
					height: "100%",
					width: "100%",
					display: "flex",
					flexDirection: "column",
					justifyContent: "center",
					alignItems: "center",
					background: bg
				}}
			>
				<div
					style={{
						position: "absolute",
						inset: 0,
						background: "radial-gradient(ellipse at 50% 35%, rgba(255,255,255,0.08), rgba(0,0,0,0) 60%)"
					}}
				/>
				<div
					style={{
						position: "absolute",
						inset: 0,
						background:
							"linear-gradient(180deg, rgba(30,24,21,0.6), rgba(22,18,16,0.9))"
					}}
				/>
				<div
					style={{
						color: cream,
						fontSize: 60,
						fontWeight: 800,
						letterSpacing: 6,
						textTransform: "uppercase"
					}}
				>
					Gym Deathmatch
				</div>
				<div
					style={{
						marginTop: 20,
						padding: "10px 20px",
						border: `6px solid ${orange}`,
						borderRadius: 8,
						color: cream,
						fontSize: 44,
						fontWeight: 700
					}}
				>
					{subtitle}
				</div>
				<div
					style={{
						marginTop: 20,
						color: "rgba(247,231,198,0.9)",
						fontSize: 36,
						fontWeight: 700
					}}
				>
					{name}
				</div>
			</div>
		),
		{ width: 1200, height: 630 }
	);
}


