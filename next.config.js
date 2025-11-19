/** @type {import('next').NextConfig} */
const nextConfig = {
	images: {
		remotePatterns: [
			{
				protocol: "https",
				hostname: "**.supabase.co",
			},
		],
	},
	// Ensure service worker and manifest are served correctly
	async headers() {
		return [
			{
				source: "/sw.js",
				headers: [
					{
						key: "Content-Type",
						value: "application/javascript; charset=utf-8",
					},
					{
						key: "Service-Worker-Allowed",
						value: "/",
					},
				],
			},
			{
				source: "/manifest.webmanifest",
				headers: [
					{
						key: "Content-Type",
						value: "application/manifest+json",
					},
				],
			},
		];
	},
};

module.exports = nextConfig;


