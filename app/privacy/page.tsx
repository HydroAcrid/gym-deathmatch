export default function PrivacyPage() {
	return (
		<div className="min-h-screen py-8 px-4">
			<div className="mx-auto max-w-3xl">
				<div className="scoreboard-panel p-6 sm:p-8">
					<h1 className="font-display text-3xl sm:text-4xl tracking-widest text-primary mb-4">PRIVACY POLICY</h1>
					<p className="text-sm text-muted-foreground mb-8">Last updated: January 15, 2025</p>

					<div className="space-y-6 text-sm sm:text-base text-muted-foreground">
						<section>
							<h2 className="font-display text-xl sm:text-2xl tracking-widest text-primary mb-3">INTRODUCTION</h2>
							<p className="mb-3">
								Arena (also branded as "Gym Deathmatch") is a casual fitness challenge app where friends compete with workouts. 
								This Privacy Policy explains what information we collect, how we use it, and how we protect your privacy when you use our service.
							</p>
							<p>
								By using Arena, you agree to the collection and use of information in accordance with this policy. 
								If you do not agree with our policies and practices, please do not use our service.
							</p>
						</section>

						<section>
							<h2 className="font-display text-xl sm:text-2xl tracking-widest text-primary mb-3">INFORMATION WE COLLECT</h2>
							
							<h3 className="font-display text-lg text-foreground mb-2 mt-4">ACCOUNT DATA</h3>
							<p className="mb-3">
								When you sign in using Google OAuth, we collect your email address and basic profile information 
								(name, profile picture) provided by Google through Supabase Authentication.
							</p>

							<h3 className="font-display text-lg text-foreground mb-2 mt-4">LOBBY & PROFILE DATA</h3>
							<p className="mb-3">
								To participate in lobbies and compete with friends, you may provide:
							</p>
							<ul className="list-disc list-inside mb-3 ml-4 space-y-1">
								<li>Display name</li>
								<li>Avatar URL or image</li>
								<li>Location (optional)</li>
								<li>Quip or personal message</li>
								<li>Lobby membership and participation data</li>
							</ul>

							<h3 className="font-display text-lg text-foreground mb-2 mt-4">ACTIVITY DATA</h3>
							<p className="mb-3">
								We collect workout information in two ways:
							</p>
							<ul className="list-disc list-inside mb-3 ml-4 space-y-1">
								<li>
									<strong>Manual Logs:</strong> Date, duration, notes, and optional photos you upload directly in the app.
								</li>
								<li>
									<strong>Strava Integration:</strong> If you connect your Strava account, we sync activity data including 
									activity type, distance, duration, timestamps, and other metadata provided by Strava's API.
								</li>
							</ul>

							<h3 className="font-display text-lg text-foreground mb-2 mt-4">TECHNICAL DATA</h3>
							<p className="mb-3">
								We automatically collect basic technical information such as IP address, browser type, device information, 
								and usage logs. This data is used for security, debugging, and improving the service.
							</p>
						</section>

						<section>
							<h2 className="font-display text-xl sm:text-2xl tracking-widest text-primary mb-3">HOW WE USE YOUR INFORMATION</h2>
							<p className="mb-3">We use the information we collect to:</p>
							<ul className="list-disc list-inside mb-3 ml-4 space-y-1">
								<li>Operate the app, including authentication, lobby management, and feature functionality</li>
								<li>Calculate and display your workout streaks, hearts, statistics, and competition results</li>
								<li>Show in-app history, comments, and competition summaries to lobby members</li>
								<li>Maintain security, prevent abuse, and debug technical issues</li>
								<li>Improve the product and user experience over time</li>
							</ul>
						</section>

						<section>
							<h2 className="font-display text-xl sm:text-2xl tracking-widest text-primary mb-3">DATA SHARING</h2>
							<p className="mb-3">
								<strong>We do not sell your personal data.</strong>
							</p>
							<p className="mb-3">
								We share data only in the following circumstances:
							</p>
							<ul className="list-disc list-inside mb-3 ml-4 space-y-1">
								<li>
									<strong>Infrastructure Providers:</strong> We use third-party services to operate the app, including 
									Supabase (for authentication and database), Strava API (for activity sync), and Vercel (for hosting). 
									These providers process data only as necessary to provide their services.
								</li>
								<li>
									<strong>Within Lobbies:</strong> When you join a lobby, other players in that lobby can see your display name, 
									avatar, stats, logged activities, and any comments or interactions you make within that lobby.
								</li>
							</ul>
						</section>

						<section>
							<h2 className="font-display text-xl sm:text-2xl tracking-widest text-primary mb-3">STRAVA INTEGRATION</h2>
							<p className="mb-3">
								If you choose to connect your Strava account, we store access tokens securely in Supabase to sync your activities. 
								We only read the activity data necessary for Arena features, such as workout summaries, streaks, and statistics.
							</p>
							<p className="mb-3">
								You can disconnect your Strava account at any time through the app settings. Once disconnected, 
								we will stop syncing new activities, but previously synced data may remain in your Arena account history.
							</p>
						</section>

						<section>
							<h2 className="font-display text-xl sm:text-2xl tracking-widest text-primary mb-3">DATA RETENTION & DELETION</h2>
							<p className="mb-3">
								We retain your data for as long as necessary to operate the service and fulfill the purposes described in this policy. 
								If you wish to delete your account and associated data, please contact us using the information provided below.
							</p>
							<p className="mb-3">
								Note that some aggregated or anonymized statistics may be retained for analytical purposes and cannot be associated with your personal account.
							</p>
						</section>

						<section>
							<h2 className="font-display text-xl sm:text-2xl tracking-widest text-primary mb-3">SECURITY</h2>
							<p className="mb-3">
								We implement reasonable technical and organizational measures to protect your data, including HTTPS encryption, 
								secure authentication through Supabase, and access controls. However, no method of transmission over the internet 
								or electronic storage is 100% secure, and we cannot guarantee absolute security.
							</p>
						</section>

						<section>
							<h2 className="font-display text-xl sm:text-2xl tracking-widest text-primary mb-3">CHILDREN'S PRIVACY</h2>
							<p className="mb-3">
								Arena is not intended for children under 13 years of age. We do not knowingly collect personal information from 
								children under 13. If you believe we have collected information from a child under 13, please contact us immediately 
								so we can delete that information.
							</p>
						</section>

						<section>
							<h2 className="font-display text-xl sm:text-2xl tracking-widest text-primary mb-3">CHANGES TO THIS POLICY</h2>
							<p className="mb-3">
								We may update this Privacy Policy from time to time. When we make changes, we will update the "Last updated" date 
								at the top of this page. We encourage you to review this policy periodically to stay informed about how we protect your information.
							</p>
						</section>

						<section>
							<h2 className="font-display text-xl sm:text-2xl tracking-widest text-primary mb-3">CONTACT</h2>
							<p className="mb-3">
								If you have questions about this Privacy Policy or wish to request deletion of your account and data, please contact us at:
							</p>
							<p>
								<a 
									href="mailto:support@gym-deathmatch.vercel.app" 
									className="text-primary hover:underline"
								>
									support@gym-deathmatch.vercel.app
								</a>
							</p>
						</section>
					</div>
				</div>
			</div>
		</div>
	);
}

