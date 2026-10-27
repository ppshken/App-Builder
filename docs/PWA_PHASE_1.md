# PWA per application — phase 1

Each application has a stable installation URL `/app/{appId}/`. The original `/run` and Builder pages remain available. No database migration or business-data rewrite is required.

## Use

1. Open **แอปของฉัน → ติดตั้งแอพ**, or **เมนูของแอป → ติดตั้งแอพ**.
2. The installation page opens within that application's URL. Chromium can show its native install prompt when available; otherwise instructions explain the browser menu. On iPhone/iPad, use Share → Add to Home Screen and open as a web app. If the browser does not offer that option, use Safari.
3. Open the installed icon to enter the application's configured home View. A missing/expired session opens its login page and returns to the same app. Sessions and per-app authorization use the existing authentication system; this is not a new separate login service. Browser/OS storage behavior can require signing in again in the installed app.

Use HTTPS with a certificate trusted by the actual device. `http://localhost` / loopback are development exceptions; an HTTP LAN IP is not sufficient for service-worker installation on a phone. Production deployment should use a production Next build. Installation UI and behavior vary by browser/OS; the install button cannot force an unavailable native prompt.

## Routes and identity

- `/app/{appId}/` — runtime, including `?view=...&row=...` deep links.
- `/app/{appId}/login` — same login form, app branding and return URL.
- `/app/{appId}/manifest.webmanifest` — public installation branding only; stable `id`, `scope`, `start_url`, standalone display, name and theme color.
- `/app/{appId}/icon/192` and `/icon/512` — PNG icons with a maskable safe area. Uploaded PNG/JPEG/WebP app icons are used; otherwise the selected system icon is rendered. Remote icon URLs are not fetched by the server; these installations use the selected system-icon fallback.
- `/app/{appId}/sw.js` — worker scoped to that app's path.
- `/app/{appId}/offline` — generic offline explanation and retry link; contains no business data.

`skipTrailingSlashRedirect` allows the trailing slash required by the chosen app root. Middleware canonicalizes `/app/{id}` to `/app/{id}/`; it does not rewrite runtime pages or API endpoints.

## App and workspace isolation

Page requests derive the app from their path, not the shared selected-app cookie. PWA fetch requests explicitly send `x-nocode-pwa-app`; Realtime carries the app and PWA mode in its URL. The server validates membership, dataset grants, row rules and operation rights for the requested app. Existing legacy requests keep their selected-cookie mismatch protection.

Image/download requests can obtain app context from a same-origin PWA referrer. Rendered media and attachment links also carry `pwa_app`, so a new tab using `noreferrer` retains the correct app. This identifies the app, not authorization: the server still requires a session and checks file/image permissions. Middleware discards caller-supplied internal routing headers before deriving context. Public icon retrieval is limited to the configured icon of the explicitly named app.

PWA runtime always uses the live workspace, even if another Builder tab has selected a draft. Opening/switching apps in another tab does not invalidate an already open PWA's selected app. Existing per-user/per-app runtime cache scoping remains in place.

## Offline and updates

The worker caches only its generic offline page. API responses, authenticated HTML/RSC, business images and writes are not cached or queued by this worker. Opening the app without connectivity displays the offline explanation. Reconnecting and choosing retry loads from the server.

Workers do not automatically activate an update on install. When an update is waiting, the runtime offers **อัปเดต** and **ภายหลัง**. Update is disabled during an in-flight write and uses the existing form navigation guard before activation. Only the page requesting activation reloads on controller change; other open pages do not automatically reload.

Worker versions follow the production `BUILD_ID`. `NOCODE_PWA_VERSION` can override the deployment version when a custom packaging/deployment system needs it. Rebuild/deploy to publish a new worker version. The client checks for updates on registration and after returning to a visible tab (at most once per minute). App rename does not change its installation ID. OS icon/name refresh timing depends on the platform.

## Verification

Run `node scripts/integration.cjs pwa` against the runner's isolated database. It covers independent manifests/icons/scopes; two apps sharing a browser with a different selected-app cookie; PWA use while a Builder draft cookie exists; unauthorized API access; direct detail reload/back; form save; expired-session/login return; worker caches containing only offline pages; offline navigation/reconnect; and a waiting update while a dirty form remains intact.

After an isolated `.next-check` production build, set `NOCODE_TEST_PRODUCTION=1` when running the same command to exercise the production server. The test temporarily changes that test build's `BUILD_ID` to simulate a worker deployment, then restores it; do not run this test against a deployed build serving real users.

`tests/pwa.test.cjs` checks URL boundaries and worker lifecycle/cache behavior in the unit suite. Native installation and launch on a physical iPhone/Android remain device acceptance checks; Chromium emulation does not establish those results.

Validated on 2026-10-27 with isolated databases:

- Unit suite: 275 passed.
- Existing API integration suite: 15 passed.
- PWA browser suite: passed, including explicit media-link context and denial for an unauthorized user.
- Existing application launcher, app-media settings and Color/Signature/File browser suites: passed.
- Production build and the full PWA suite against the production server: passed. Results are recorded in `.test-data/pwa-build-final.log` and `.test-data/pwa-production.log`.

## Deferred

Offline business-data reads, offline saves/uploads, conflict resolution, Push Notifications and separate Builder/Application authentication belong to later phases.
