# RotBlock

YouTube, Instagram and LinkedIn without Shorts, Reels or the endless feed.

Live: **https://rotblock.vercel.app**

## How it works

RotBlock is an Expo (React Native) app that ships two ways:

- **iPhone (web app + Safari blocker).** The app is a home-screen web app. Blocking is done by a
  Safari userscript (`public/rotblock.user.js`) run by the free
  [Userscripts](https://apps.apple.com/app/userscripts/id1463298887) app. Tapping an app in RotBlock
  hands the link to Safari with your current filters attached (`#rb=...`).
- **Native build (Android / TestFlight).** Opens each site in RotBlock's own WebView and injects the
  same filter engine — no browser bar.

Both use one filter engine (`src/lib/engine.ts`) and one set of rules (`src/lib/platforms.ts`).

## What it blocks

| App       | Filters |
|-----------|---------|
| YouTube   | Shorts (open as normal videos), home feed, recommendations, comments |
| Instagram | Reels tab, shared Reels, Explore, home feed, or "messages only" |
| LinkedIn  | Feed, promoted posts, red badges, or "messages only" |

## iPhone setup

1. Open https://rotblock.vercel.app in Safari → Share → **Add to Home Screen**.
2. Install **Userscripts** from the App Store and open it once.
3. Settings → Apps → Safari → Extensions → Userscripts → on, All Websites → Allow.
4. In Safari go to **rotblock.vercel.app/install** → puzzle piece → Userscripts → **Install**.
5. Delete the real YouTube / Instagram / LinkedIn apps so links open in Safari.

## Development

```bash
npm install
npx expo start            # dev server (scan QR with Expo Go)
npx tsc --noEmit          # typecheck
npx eslint src            # lint
npm run build:web         # build blocker + static web app into dist/
npm run deploy:web        # build and publish to Vercel
```

Project layout:

- `src/app/` — screens (Expo Router): home/stats/settings, filters, setup guide, native browser
- `src/lib/` — filter engine, platform rules, store, launch + blocker detection
- `scripts/build-userscript.mts` — builds the Safari blocker from the shared engine
- `scripts/postexport.mjs` — moves font assets out of `node_modules/` (Vercel skips that folder)
- `public/` — web shell, icons, manifest, Vercel config
