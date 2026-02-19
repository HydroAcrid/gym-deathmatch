import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Terms of Service | Gym Deathmatch",
	description: "Terms of Service for Gym Deathmatch.",
};

export default function TermsPage() {
	return (
		<div className="min-h-screen py-8 px-4">
			<div className="mx-auto max-w-3xl">
				<div className="scoreboard-panel p-6 sm:p-8">
					<h1 className="font-display text-3xl sm:text-4xl tracking-widest text-primary mb-4">TERMS OF SERVICE</h1>
					<p className="text-sm text-muted-foreground mb-8">Last updated: February 13, 2026</p>

					<div className="space-y-6 text-sm sm:text-base text-muted-foreground">
						<section>
							<h2 className="font-display text-xl sm:text-2xl tracking-widest text-primary mb-3">ACCEPTANCE OF TERMS</h2>
							<p className="mb-3">
								These Terms of Service govern your use of Gym Deathmatch (&quot;Service&quot;, &quot;we&quot;, &quot;us&quot;, &quot;our&quot;). By
								accessing or using the Service, you agree to these Terms. If you do not agree, do not use
								the Service.
							</p>
						</section>

						<section>
							<h2 className="font-display text-xl sm:text-2xl tracking-widest text-primary mb-3">ELIGIBILITY</h2>
							<p className="mb-3">
								You must be at least 13 years old to use the Service. By using the Service, you represent
								that you meet this requirement and that your use complies with applicable laws.
							</p>
						</section>

						<section>
							<h2 className="font-display text-xl sm:text-2xl tracking-widest text-primary mb-3">ACCOUNTS AND ACCESS</h2>
							<p className="mb-3">
								You may sign in using Google OAuth. You are responsible for activity under your account and
								for keeping your credentials secure. You must provide accurate information and keep it current.
							</p>
						</section>

						<section>
							<h2 className="font-display text-xl sm:text-2xl tracking-widest text-primary mb-3">SERVICE DESCRIPTION</h2>
							<p className="mb-3">
								Gym Deathmatch is a social fitness challenge platform where users can join lobbies, log
								workouts manually or through integrations, view rankings, and interact with other members.
							</p>
						</section>

						<section>
							<h2 className="font-display text-xl sm:text-2xl tracking-widest text-primary mb-3">USER CONTENT AND CONDUCT</h2>
							<p className="mb-3">You are responsible for content you submit, including workouts, images, comments, and profile text.</p>
							<p className="mb-3">You agree not to:</p>
							<ul className="list-disc list-inside mb-3 ml-4 space-y-1">
								<li>Post unlawful, abusive, defamatory, or misleading content</li>
								<li>Impersonate others or misrepresent your identity</li>
								<li>Interfere with or disrupt the Service</li>
								<li>Attempt unauthorized access to systems or data</li>
							</ul>
							<p>
								We may remove content or suspend accounts that violate these Terms or create risk to users
								or the platform.
							</p>
						</section>

						<section>
							<h2 className="font-display text-xl sm:text-2xl tracking-widest text-primary mb-3">THIRD-PARTY SERVICES</h2>
							<p className="mb-3">
								The Service depends on third-party providers, including Supabase, Google, Strava, and Vercel.
								Your use of those services may also be subject to their terms and policies.
							</p>
						</section>

						<section>
							<h2 className="font-display text-xl sm:text-2xl tracking-widest text-primary mb-3">PAYMENTS AND PRIZE POOLS</h2>
							<p className="mb-3">
								Some lobbies may track monetary pots or weekly ante values as user-managed competition data.
								Unless explicitly stated by us in writing, Gym Deathmatch does not process payouts and is not
								a bank, escrow provider, sportsbook, or gambling operator.
							</p>
							<p>
								Users are solely responsible for any real-world payment arrangements made among lobby members.
							</p>
						</section>

						<section>
							<h2 className="font-display text-xl sm:text-2xl tracking-widest text-primary mb-3">INTELLECTUAL PROPERTY</h2>
							<p className="mb-3">
								The Service, including software, design, trademarks, and branding, is owned by Gym Deathmatch
								or its licensors and protected by applicable laws. You may not copy, modify, distribute, or
								reverse engineer the Service except as permitted by law.
							</p>
						</section>

						<section>
							<h2 className="font-display text-xl sm:text-2xl tracking-widest text-primary mb-3">DISCLAIMER OF WARRANTIES</h2>
							<p className="mb-3">
								The Service is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind, express
								or implied, including merchantability, fitness for a particular purpose, and non-infringement.
							</p>
						</section>

						<section>
							<h2 className="font-display text-xl sm:text-2xl tracking-widest text-primary mb-3">LIMITATION OF LIABILITY</h2>
							<p className="mb-3">
								To the maximum extent permitted by law, Gym Deathmatch is not liable for indirect, incidental,
								special, consequential, or punitive damages, or loss of data, profits, or goodwill arising from
								your use of the Service.
							</p>
						</section>

						<section>
							<h2 className="font-display text-xl sm:text-2xl tracking-widest text-primary mb-3">TERMINATION</h2>
							<p className="mb-3">
								We may suspend or terminate access at any time if you violate these Terms or if needed to
								protect users, systems, or legal compliance.
							</p>
						</section>

						<section>
							<h2 className="font-display text-xl sm:text-2xl tracking-widest text-primary mb-3">CHANGES TO TERMS</h2>
							<p className="mb-3">
								We may update these Terms from time to time. Continued use of the Service after changes
								take effect means you accept the revised Terms.
							</p>
						</section>

						<section>
							<h2 className="font-display text-xl sm:text-2xl tracking-widest text-primary mb-3">CONTACT</h2>
							<p className="mb-3">
								If you have questions about these Terms, contact:
							</p>
							<p>
								<a href="mailto:support@gymdeathmatch.com" className="text-primary hover:underline">
									support@gymdeathmatch.com
								</a>
							</p>
						</section>
					</div>
				</div>
			</div>
		</div>
	);
}
