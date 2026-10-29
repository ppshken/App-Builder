# Security findings

วันที่: 29 ตุลาคม 2026 — Read-only source audit; synthetic runtime probes only

## สิ่งที่ยืนยัน

| ID | ความสำคัญ | Evidence | ขอบเขต |
|---|---|---|---|
| AUD-001 | P1: cross-app attachment read | [HTTP result](evidence/http-file-authorization.json), lib/permissions.ts:46 | Authenticated developer assigned only to app A: table denied 403, file from another app returned 200 |
| AUD-002 | P1: shared login availability failure | [runtime result](evidence/runtime-reproductions.json), lib/auth.ts:33,51 | 20 valid successful logins exhaust the global budget; next request 429 |
| AUD-003 | P1 dependency gate; critical vendor advisories | [registry summary](evidence/dependency-audit.json), package.json:34 | Next 14.2.15 / PostCSS 8.4.31 affected; individual application exploits NOT TESTED |

No actual secret, live file, real user record or live session was read for these probes. The synthetic session token and test passwords were kept inside the test process and are absent from the report.

## Dependency interpretation

npm audit --omit=dev flags **2 packages: 1 critical, 1 high**. Version matching is confirmed; a vulnerable package does not prove every exploit precondition exists.

- [Vendor middleware authorization advisory](https://github.com/vercel/next.js/security/advisories/GHSA-f82v-jwr5-mffw) lists affected 14.x releases before 14.2.25. This app also checks sessions and permissions in API handlers, so middleware bypass alone must not be described as a proven bypass of those guards.
- [Vendor Windows-hosted RCE advisory](https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36) lists the installed version in its affected range and identifies Windows filesystem hosting as a condition. No exploit was executed; do not apply the Windows-specific impact to a Linux deployment without evidence.
- The registry also lists other advisories. Updating to one old patch does not establish that all are fixed. A supported target, compatibility work, a fresh audit and regression tests are required. No npm install/audit fix was run.

## Controls observed and tested within scope

- Opaque, random session tokens; hashed token storage; HttpOnly and SameSite cookie configuration; scrypt password hashing. JWT validation is **not applicable**: the application does not use JWT sessions here.
- API guard enforces table/operation permissions, application dataset ceilings and row checks. approles, API, restoreapps and appoperations exercised selected negative/unauthorized paths. These successes do not cancel AUD-001.
- State-changing guarded APIs call same-origin checks; local negative cases exist in tests. Production TLS/proxy behavior remains untested (SUS-001).
- Parameter-bound values and validated identifiers are used by key data paths. No SQL injection was proven. This is not a claim that every possible dynamic SQL construction was fuzzed.
- Formula engine parses expressions rather than executing arbitrary JavaScript. PDF generation escapes content and blocks outbound browser requests in the inspected path. No stored/reflected XSS was proven; exhaustive payload/browser coverage was not performed.
- Webhook execution uses explicit origin allowlist, no redirects, response/request limits, timeout and idempotency keys. Real DNS/provider behavior and cross-provider crash recovery are untested.
- Upload routes inspect supported file/image formats and sizes in selected paths; central deletion checks references again inside an immediate transaction. Dynamic external URL references are outside that detector's full knowledge.
- PWA phase 1 test verified no caching of authenticated business HTML/API responses by its service worker; IndexedDB uses a session/application/permission scope. Physical-device storage and logout under OS termination remain untested.

## Additional risks and gaps

- DR-002: inconsistent JSON/multipart buffering limits can amplify authenticated memory pressure; no OOM/DoS test was performed.
- DR-003: omitted version tokens retain a last-write-wins API path; explicitly define this contract.
- DR-004: remote side effects need receiver-side idempotency; SQLite cannot undo a delivered HTTP request.
- Real credentials and .env contents were deliberately excluded, so secret rotation, credential validity, production access logs and actual deployment exposure were not audited.
- No production pen-test, port scan, Docker command, public exploit payload or cloud/email operation was performed.

## Priority

1. Correct AUD-001 and add app/row/file boundary regressions.
2. Correct AUD-002 and verify failure quotas do not affect legitimate aggregate traffic.
3. Select a supported patched framework target and clear the applicable dependency gate before external deployment.
4. Restore failed security-related E2E coverage and reject unknown test modes.

Detailed reproduction, expected/actual, fixes and regression proposals: BUG_REPORT.md and FIX_PLAN.md. Source code remains unchanged pending approval.
