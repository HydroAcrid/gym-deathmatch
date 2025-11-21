/**
 * Service Worker for Arena PWA
 * 
 * Caching Strategy:
 * - Static assets (_next/static/*, icons/*): Cache-first
 * - HTML pages: Network-first with cache fallback
 * - API calls (/api/*): Network-only (no caching to avoid stale data)
 */

const CACHE_NAME = 'arena-pwa-v2';
const STATIC_CACHE = 'arena-static-v2';

// Assets to precache on install
const PRECACHE_ASSETS = [
	'/',
	'/manifest.webmanifest',
	'/icons/icon-192.png',
	'/icons/icon-512.png',
];

// Install event: precache essential assets
self.addEventListener('install', (event) => {
	console.log('[SW] Installing service worker...');
	event.waitUntil(
		caches.open(STATIC_CACHE).then((cache) => {
			console.log('[SW] Precaching static assets');
			return cache.addAll(PRECACHE_ASSETS).catch((err) => {
				console.warn('[SW] Precache failed for some assets:', err);
				// Don't fail installation if some assets fail
				return Promise.resolve();
			});
		})
	);
	// Force activation of new service worker
	self.skipWaiting();
});

// Activate event: clean up old caches
self.addEventListener('activate', (event) => {
	console.log('[SW] Activating service worker...');
	event.waitUntil(
		caches.keys().then((cacheNames) => {
			return Promise.all(
				cacheNames.map((cacheName) => {
					// Delete old caches that don't match current version
					if (cacheName !== CACHE_NAME && cacheName !== STATIC_CACHE) {
						console.log('[SW] Deleting old cache:', cacheName);
						return caches.delete(cacheName);
					}
				})
			);
		})
	);
	// Take control of all pages immediately
	return self.clients.claim();
});

// Fetch event: implement caching strategies
self.addEventListener('fetch', (event) => {
	const { request } = event;
	const url = new URL(request.url);

	// Skip non-GET requests
	if (request.method !== 'GET') {
		return;
	}

	// Skip cross-origin requests (Supabase, Strava, etc.)
	if (url.origin !== location.origin) {
		return;
	}

	// API calls: network-only (no caching)
	if (url.pathname.startsWith('/api/')) {
		event.respondWith(fetch(request));
		return;
	}

	// Static assets: cache-first strategy
	if (
		url.pathname.startsWith('/_next/static/') ||
		url.pathname.startsWith('/icons/') ||
		url.pathname.startsWith('/images/') ||
		url.pathname.match(/\.(js|css|woff|woff2|ttf|eot|png|jpg|jpeg|gif|svg|ico)$/)
	) {
		event.respondWith(
			caches.match(request).then((cachedResponse) => {
				if (cachedResponse) {
					return cachedResponse;
				}
				return fetch(request).then((response) => {
					// Don't cache non-successful responses
					if (!response || response.status !== 200 || response.type !== 'basic') {
						return response;
					}
					const responseToCache = response.clone();
					caches.open(STATIC_CACHE).then((cache) => {
						cache.put(request, responseToCache);
					});
					return response;
				});
			})
		);
		return;
	}

	// HTML pages: network-first with cache fallback
	if (request.headers.get('accept')?.includes('text/html')) {
		event.respondWith(
			fetch(request)
				.then((response) => {
					// Cache successful responses
					if (response && response.status === 200) {
						const responseToCache = response.clone();
						caches.open(CACHE_NAME).then((cache) => {
							cache.put(request, responseToCache);
						});
					}
					return response;
				})
				.catch(() => {
					// Network failed, try cache
					return caches.match(request).then((cachedResponse) => {
						if (cachedResponse) {
							return cachedResponse;
						}
						// Fallback to home page if available
						return caches.match('/');
					});
				})
		);
		return;
	}

	// Default: try cache, then network
	event.respondWith(
		caches.match(request).then((cachedResponse) => {
			return cachedResponse || fetch(request);
		})
	);
});

