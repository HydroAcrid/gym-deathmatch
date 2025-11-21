/**
 * Service Worker v2 for Gym Deathmatch PWA
 * 
 * Caching Strategy:
 * - HTML navigations: Network-first, NOT cached (to avoid stale UI after deploys)
 * - Static assets (scripts, styles, images, fonts): Cache-first with network fallback
 * 
 * CACHE_NAME is versioned. Changing it will force old asset caches to be dropped.
 */

const CACHE_NAME = "arena-assets-v2";

// Install event: force immediate activation
self.addEventListener('install', (event) => {
	console.log('[SW] Installing service worker v2...');
	// Force activation without waiting for other tabs to close
	self.skipWaiting();
});

// Activate event: clean up old caches and claim clients
self.addEventListener('activate', (event) => {
	console.log('[SW] Activating service worker v2...');
	event.waitUntil(
		caches.keys().then((cacheNames) => {
			return Promise.all(
				cacheNames.map((cacheName) => {
					// Delete any cache that doesn't match our current cache name
					if (cacheName !== CACHE_NAME) {
						console.log('[SW] Deleting old cache:', cacheName);
						return caches.delete(cacheName);
					}
				})
			);
		}).then(() => {
			// Take control of all pages immediately
			return self.clients.claim();
		})
	);
});

// Fetch event: implement caching strategies
self.addEventListener('fetch', (event) => {
	const { request } = event;

	// Only handle GET requests
	if (request.method !== 'GET') {
		return;
	}

	// Skip cross-origin requests
	const url = new URL(request.url);
	if (url.origin !== location.origin) {
		return;
	}

	// HTML navigations: network-first, DO NOT cache
	if (request.mode === 'navigate') {
		event.respondWith(
			fetch(request).catch(() => {
				// Network failed, try cache as last resort (but don't cache the response)
				return caches.match(request).then((cachedResponse) => {
					return cachedResponse || fetch(request);
				});
			})
		);
		return;
	}

	// Static assets: cache-first with network fallback
	const destination = request.destination;
	if (destination === 'script' || destination === 'style' || destination === 'image' || destination === 'font') {
		event.respondWith(
			caches.open(CACHE_NAME).then((cache) => {
				return cache.match(request).then((cachedResponse) => {
					if (cachedResponse) {
						return cachedResponse;
					}
					// Not in cache, fetch from network
					return fetch(request).then((response) => {
						// Only cache successful responses
						if (response && response.status === 200 && response.type === 'basic') {
							const responseToCache = response.clone();
							cache.put(request, responseToCache);
						}
						return response;
					});
				});
			})
		);
		return;
	}

	// For all other requests, let the browser handle normally
	// (don't call event.respondWith, just return)
});

