# AC Partner Web SDK

A **browser-only TypeScript SDK** for AC partner integrations. It runs entirely
in the user's browser — **no backend and no client secret** — using the OAuth
**Authorization Code + PKCE** flow, and calls the Partner API (`/api/v1`)
directly.

Ships ESM + CommonJS builds with type declarations, so it imports cleanly into
React, Vue, Angular, Svelte, or any frontend.

> Public-client integration: the user signs in on AC's own page; the SDK never
> sees their password, and only ever accesses content **that user** already has.

## How it works

```
Browser (SDK)                         Artist Connection
  │  connect() → build PKCE + state
  │  redirect to consent ───────────────────►  sign-in / approve
  │  ◄──────────── redirect back ?code&state ──
  │  POST /oauth/token (client_id, code, code_verifier)  ──►  tokens
  │  store tokens in the browser
  │  GET /api/v1/... (Authorization: Bearer, X-AC-Platform) ►  your content
```

- No secret: this is a **public client**, so token calls send `client_id` as a
  form field (no HTTP Basic, no secret).
- PKCE (`S256`) protects the authorization code — it is mandatory here.
- Tokens live in the browser (localStorage by default); the SDK refreshes them
  automatically.

## Requirements

- A **public (browser/mobile) integration** registered with AC, with your app's
  origin/redirect URI registered (AC enforces CORS + exact redirect match).
- A secure context (HTTPS, or `localhost` for dev) — PKCE needs Web Crypto.

## Install & build

```bash
npm install
npm run build      # dist/ (ESM, CJS, .d.ts)
npm run typecheck
```

## Usage

```ts
import { AcPartnerClient } from "@ac/partner-sdk";

// 1) App startup. If we're returning from consent (URL has ?code), init
//    completes sign-in automatically.
await AcPartnerClient.init({
  clientId: "partner_acme",
  redirectUri: window.location.origin, // must be registered with AC
  consentUrl: "https://music.pureaudiostreaming.com/connect", // or the AC portal
});

// 2) Sign-in button:
if (!AcPartnerClient.isAuthenticated()) {
  await AcPartnerClient.connect(); // redirects to AC; comes back to redirectUri
}

// 3) Once signed in — call the API directly:
const me = await AcPartnerClient.getUser();
const albums = await AcPartnerClient.getAlbums({ limit: 50, includeArtwork: true });
const results = await AcPartnerClient.search({ query: "horizon" });

AcPartnerClient.logout();
```

Configure once, call statically anywhere (`AcPartnerClient.getAlbums()`), or use
your own instance: `new AcPartnerClient({ clientId, redirectUri })`.

### Handling the redirect manually

`init` auto-completes the redirect by default. To control it yourself:

```ts
await AcPartnerClient.init({ clientId, redirectUri, autoHandleRedirect: false });
if (AcPartnerClient.isRedirectPending()) {
  await AcPartnerClient.handleRedirectCallback(); // exchanges code, cleans the URL
}
```

## Config

| Option               | Default                                          | Notes                                      |
| -------------------- | ------------------------------------------------ | ------------------------------------------ |
| `clientId`           | — (required)                                     | Your public client id (not a secret)       |
| `redirectUri`        | — (required)                                     | Registered with AC (exact match)           |
| `apiBaseUrl`         | `https://api-partners.prod.artistconnection.net` | Partner API base                           |
| `consentUrl`         | `https://music.artistconnection.net/connect`     | Use the Pure Audio portal for PAS accounts |
| `scopes`             | all granted                                      | Space-joined subset to request             |
| `platform`           | `"web"`                                          | `X-AC-Platform` (web/ios/android/…)        |
| `storage`            | `localStorage`                                   | Pass `MemoryTokenStorage` or your own      |
| `timeoutMs`          | `30000`                                          | Per-request timeout                        |
| `autoHandleRedirect` | `true`                                           | Complete the redirect during `init`        |

## API surface

**Auth:** `init`, `connect`, `getAuthorizationUrl`, `isRedirectPending`,
`handleRedirectCallback`, `isAuthenticated`, `logout`, `getAccessToken`.

**Content (the signed-in user's):** `getUser`, `ping`, `getStudio`,
`getAlbums`, `getArtists`, `getArtistAlbums`, `getGenres`, `getFormats`,
`getLabels`, `getAlbumTracks`, `getTrack`, `getAlbumPlayback`,
`getTrackPlayback`, `search`, `getFavoriteAlbums`, `addFavoriteAlbum`,
`removeFavoriteAlbum`, `reportPlaybackEvents`.

Listings are paged (`{ items, total, limit, offset, hasMore }`); advance
`offset` by `limit` until `hasMore` is `false`.

Every method requires the matching scope on your integration — `content:read`,
`content:play`, `content:play:report`, `studio:read`, `user:profile:read`,
`user:favorites:read`, `user:favorites:write`. A missing scope returns `403` as
an `AcApiError`; `ping()` needs none and reports the scopes you actually hold.

### Reporting plays

```ts
await AcPartnerClient.reportPlaybackEvents([
  {
    albumUuid,
    trackId,
    startedAt: startMs,          // Unix ms, UTC
    endedAt: endMs,              // >= startedAt
    listeningTime: 212,          // seconds heard, pauses excluded
    position: 214,               // optional: playhead at the end
    sessionId,                   // optional: stable per play, de-dupes retries
  },
]);
```

Batches hold up to 500 events and are **atomic** — one invalid event rejects the
whole call, so retry the entire batch (a stable `sessionId` keeps that safe).

## Project structure

```
src/
  index.ts                 Public entry / exports
  client.ts                AcPartnerClient (config + facade)
  errors.ts                AcSdkError / AcAuthError / AcApiError
  auth/
    pkce.ts                PKCE verifier/challenge (Web Crypto)
    oauthClient.ts         Authorization URL, code exchange, refresh
    tokenStore.ts          Token storage (local / memory / custom)
  http/
    apiClient.ts           /api/v1 calls (bearer, X-AC-Platform, retry)
  content/
    contentClient.ts       Typed content methods
    types.ts               Album / Artist / Track / ... types
```
