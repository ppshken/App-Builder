# Test results — 2026-10-30

รันทดสอบกับฐานข้อมูล isolated/in-memory เท่านั้น ไม่มีการเปลี่ยนฐานข้อมูลจริง, credentials จริง, Docker volumes หรือ deploy

| Check | Expected | Actual | Evidence |
| --- | --- | --- | --- |
| Full unit/regression suite | All pass | **355 passed / 0 failed / 0 skipped** | node scripts/test.cjs; .test-data/external-sources/unit-final-5.log |
| Existing API integration | Existing CRUD/formula/metadata/Ref/View behavior preserved | **15 passed / 0 failed** | node scripts/integration.cjs api; regression-api-2.log |
| External source browser + API | UI connection→preview→schema→mapping→create→table→refresh, atomic sync/recovery and permission/security cases | **Passed** | node scripts/integration.cjs externalsources; browser-final.log |
| Existing Workflow integration/browser | PDF/actions/events/webhook/resume/permissions preserved | **Passed** | node scripts/integration.cjs workflows; regression-workflows.log |
| Existing Automation designer | Event UI, formula modal, ordered nodes, save/reload/mobile/dark | **Passed** | node scripts/integration.cjs workflowdesigner; regression-workflowdesigner.log |
| TypeScript | No diagnostics | **Passed** | tsc --noEmit --incremental false; typecheck-final-4.log (empty) |
| Live public HTTPS smoke | Validate real DNS/TLS/pinned connection and parse public JSON | **HTTP 200**, 83 bytes, expected keys | live-https-smoke.log; JSONPlaceholder /todos/1, no credential |
| Real iPhone / real provider credential / production deployment / million-row load | Explicit environment needed | **Not Tested** | No claim made |

Paths for logs above are under .test-data/external-sources/ (generated and ignored by Git). Stable regression cases are committed-source test files under tests/. Browser was desktop Chromium via msedge headless, with mobile viewport and dark emulation; this is not a physical iPhone test.

## New focused tests

tests/external-data.test.cjs contains **18** focused tests covering:

- SSRF address policy, exact origin, DNS pinning, TLS verification option and denied private DNS
- Schema/nullable/path/normalization, duplicate/missing key, sensitive preview, invalid/malformed credential/config rejection
- Live SQL view read-only, stable IDs, TTL and refresh
- Complete page/offset/cursor/next traversal, loop/truncation failure
- Atomic import/upsert, no-op, failure rollback, duplicate queued job, schedule/inactive policy
- Numeric/timezone incremental cursor, checkpoint commit only on success, explicit full sync
- Per-app source lookup and builder management boundary, shared quotas
- Clone isolated IDs/paused sources, app deletion retaining definitions, restore lease cancellation
- Trusted/tampered SQL view staging, full restore twice preserving account credentials, per-app export/restore
- Sync summary formula evaluation and loop rejection

The E2E fixture preloads tests/external-http-fixture.cjs only in the isolated externalsources runner. It replaces the HTTPS transport for api.fixture.test; it is not a production switch. Error/SSRF/redirect/oversize simulations therefore do not prove real-network infrastructure behavior. The separate public HTTPS smoke covers one genuine DNS/TLS request without credentials.

## Failures found and corrected during implementation

1. Credential selector lacked an explicit accessible name and source creation could begin before registry metadata loaded. Added label and initial loading guard; final wizard passes.
2. Sync summary fields were rejected by the existing formula lexer, and row calculation discarded those fields. Added exactly four reserved summary identifiers and preserved the synthetic row only for sync events; unit and E2E now pass.
3. Extracting table creation introduced a trailing comma for virtual-only internal tables. Existing API regression failed at tests/api.test.cjs:67; corrected to count physical columns, then API suite passes 15/15.
4. Existing backup staging rejected all SQL views; restoring only tables would omit/collide with connector views. Added exact generated-view trust validation, trusted recreation and removal of old views within restore transaction. Tampered view rejection and restore-twice tests pass.
5. Added numeric/timestamp cursor ordering and safe numeric key validation to avoid lexical ordering or precision errors; dedicated tests pass.

## Visual artifacts inspected

- artifacts/external-source-review.png
- artifacts/external-source-runtime-table.png
- artifacts/external-source-runtime-mobile.png
- artifacts/external-source-sync-history.png
- artifacts/external-source-builder-mobile-dark.png

Observed runtime readonly table and mobile dark Builder; adjusted source sidebar labels and shared runtime source notice styling. Screenshots are test artifacts, not evidence of real-device performance.
