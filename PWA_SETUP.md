# PWA Setup Documentation

This app is now configured as a Progressive Web App (PWA) that can be installed on iOS, Android, and desktop browsers.

## Files Created/Modified

### Manifest & Icons
- **`public/manifest.webmanifest`**: PWA manifest file defining app metadata, icons, and display settings
- **`public/icons/icon-192.png`**: 192x192 app icon
- **`public/icons/icon-512.png`**: 512x512 app icon
- **`public/icons/icon.svg`**: Source SVG icon (can be used to regenerate PNGs)

### Service Worker
- **`public/sw.js`**: Service worker implementing caching strategies:
  - **Static assets** (`/_next/static/*`, `/icons/*`): Cache-first
  - **HTML pages**: Network-first with cache fallback
  - **API calls** (`/api/*`): Network-only (no caching to avoid stale data)

### Components
- **`components/PWARegister.tsx`**: Client component that registers the service worker
- **`components/PWAMeta.tsx`**: Client component that injects iOS-specific meta tags

### Configuration
- **`app/layout.tsx`**: Updated with PWA metadata (manifest link, theme color, Apple Web App settings)
- **`next.config.js`**: Added headers for service worker and manifest files

## Caching Strategy

The service worker uses different strategies based on content type:

1. **Static Assets** (JS, CSS, images, fonts): Cache-first
   - Faster load times for repeat visits
   - Falls back to network if cache miss

2. **HTML Pages**: Network-first with cache fallback
   - Always tries to fetch fresh content
   - Falls back to cached version if offline

3. **API Calls**: Network-only
   - Never cached to ensure fresh data from Supabase/Strava
   - Prevents stale lobby data, votes, activities, etc.

## Installation

### iOS (iPhone/iPad)
1. Open the site in Safari
2. Tap the Share button
3. Select "Add to Home Screen"
4. The app will appear with the "Arena" icon
5. When opened from home screen, it runs in standalone mode (no Safari UI)

### Android (Chrome)
1. Open the site in Chrome
2. Tap the menu (three dots)
3. Select "Add to Home Screen" or "Install app"
4. The app will appear in your app drawer

### Desktop (Chrome/Edge)
1. Look for the install icon in the address bar
2. Click "Install" when prompted
3. The app will open in a standalone window

## Testing

### Verify PWA Installation
1. Open Chrome DevTools → Application tab
2. Check "Manifest" section - should show "Arena" with icons
3. Check "Service Workers" section - should show registered worker
4. Run Lighthouse audit - should pass PWA criteria

### Test Offline Behavior
1. Open DevTools → Network tab
2. Enable "Offline" mode
3. Navigate the app - static assets should load from cache
4. API calls will fail (expected - no stale data)

### iOS Testing
1. Open site in Safari on iPhone
2. Verify "Add to Home Screen" option appears
3. Add to home screen
4. Open from home screen - should run in standalone mode
5. Check status bar styling matches dark theme

## Icon Generation

If you need to regenerate icons:

```bash
# Using Node.js script (requires sharp)
npm install sharp --save-dev
node scripts/generate-icons.js

# Or use the HTML generator
# Open public/icons/generate-icons.html in a browser
# Icons will auto-download
```

## Notes

- Service worker updates automatically check for new versions every hour
- Cache version is `arena-pwa-v1` - increment when making breaking changes
- The app name in PWA is "Arena" (short name) while the site title remains "Gym Deathmatch"
- Theme color matches the dark theme background: `#140b07`
- All API calls bypass cache to ensure real-time data accuracy

