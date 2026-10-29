# Confirmed bug repair results — 2026-10-29

## Scope and status

Baseline: [latest bug report](../2026-10-29-system-audit/BUG_REPORT.md) and [fix plan](../2026-10-29-system-audit/FIX_PLAN.md). This repair pass changes only approved confirmed findings. Existing unrelated dirty changes were preserved; diffs below compare per-bug pre-fix snapshots, not the repository's older HEAD.

| Bug | Severity | Status | Evidence |
|---|---|---|---|
| AUD-001 | P1 | Passed within tested scope | [RED](evidence/AUD-001-red.txt), [HTTP](evidence/AUD-001-http-green.txt), [diff](evidence/AUD-001.diff) |
| AUD-002 | P1 | PAUSED by user; not fixed | [2 failing regressions](evidence/AUD-002-red.txt), [paused policy proposal](AUD-002-APPROVAL.md) |
| AUD-003 | P1 | PAUSED by user; not fixed | [current dependency audit](evidence/AUD-003-audit-summary.json), [paused migration proposal](AUD-003-APPROVAL.md) |
| AUD-004 | P2 | Passed: all 4 previously failing suites complete | RED and GREEN suite logs below |
| AUD-005 | P2 | Passed: table/list, mobile/desktop | [RED](evidence/AUD-005-red.txt), [GREEN](evidence/AUD-005-green.txt), [diff](evidence/AUD-005.diff) |
| AUD-006 | P2 | Passed | [RED](evidence/AUD-006-red.txt), [GREEN](evidence/AUD-006-green.txt), [API](evidence/AUD-006-api.txt), [diff](evidence/AUD-006.diff) |
| AUD-007 | P2 | Passed within measured fixture | [RED](evidence/AUD-007-red.txt), [GREEN](evidence/AUD-007-green.txt), query evidence below |

Five confirmed findings fixed and runtime-verified; two explicitly paused. No finding is declared production-ready solely from code inspection.

## Isolation and limitations

- All writes/tests used in-memory SQLite or explicitly isolated test databases under .test-data. No production database, credentials, Docker volume or deployment was changed.
- No dependency installation or framework upgrade. lib/auth.ts remains identical to the repair gate SHA-256: 10797749041DA5C138A60D8CED2D1D130C4C8758B3BF146604CD436DC6B7CC0B. This is a file hash, not a credential.
- Browser validation used installed Chromium browsers at mobile/desktop viewport sizes. Real iPhone, Safari/PWA on device, Linux Docker/staging and production traffic: NOT TESTED in this repair pass.
- Evidence files are sanitized excerpts of actual test outputs. Raw local logs/backups remain under .test-data/confirmed-fixes; test credentials are synthetic and are omitted from published evidence.

## AUD-001 — Cross-app file authorization

**Module:** Authorization / attachments. **Confidence:** High. **File:** lib/permissions.ts:46; entrypoint app/api/files/[id]/route.ts.

**Confirmed root cause:** The attachment guard returned immediately for every Builder, bypassing application dataset and readable-row checks. Knowing another app's UUID was sufficient to fetch its bytes.

**Reproduction:** In isolated applications A/B, give a synthetic user only Builder rights in A, request B's known file ID. Before: file returned 200 although source table was forbidden. Four new unit cases produced 3 failures before the fix.

**Minimal fix:** Keep central Owner/scopeless legacy Builder access; scoped Builders require an authorized readable row reference. Unreferenced uploads require both uploader ownership and matching active-app provenance. Shared datasets remain readable, and revocation removes access.

**Expected vs actual after fix:** Cross-app/default/PWA probes return 403; shared authorized file and same-app pending upload return 200; revoked sharing returns 403.

**Regression:** tests/attachment-boundary.test.cjs (4 cases), tests/attachment-boundary-api.cjs (real HTTP); default unit runner includes the new unit file. [HTTP evidence](evidence/AUD-001-http-green.txt), [327 unit tests](evidence/AUD-001-green.txt).

**Side effects:** [App operations/backup/media](evidence/AUD-001-appoperations.txt) passed. Application-role browser suite first encountered ERR_ABORTED during revoke/redirect; [initial failure](evidence/AUD-001-approles.txt) retained, [isolated retry](evidence/AUD-001-approles-retry.txt) passed. This retry does not prove the navigation timing issue cannot recur.

**Remaining risks:** Old orphan uploads without provenance may require central Owner access until referenced. Large-reference scan cost is unchanged; no new broad index/schema work included. No production rollout authorized.

## AUD-002 — Login quota (PAUSED)

**Module:** Authentication. **Confidence:** High. **File:** lib/auth.ts:33-35,51.

Two isolated regressions still fail: 21 correct logins, and a correct login after unrelated failures, return 429 due to the global bucket. tests/login-quota-regression.test.cjs intentionally remains outside the default green suite while policy changes are paused. The 330 passing default tests do NOT include these 2 known failures. User instruction explicitly paused this finding; no auth policy change made. See the [policy proposal](AUD-002-APPROVAL.md).

## AUD-003 — Vulnerable dependencies (PAUSED)

**Module:** Framework/dependencies. **Confidence:** High for installed affected versions; application exploitability NOT TESTED. **Files:** package.json and package-lock.json.

Read-only npm audit reproduced 2 vulnerable production packages: Next critical and PostCSS high. No install/update/fix command performed. The user explicitly paused the proposed major migration. The [concrete migration proposal](AUD-003-APPROVAL.md) lists target versions, compatibility scope and required gates; outstanding advisories remain unresolved.

## AUD-004 — Stale E2E contracts

**Module:** QA regression coverage. **Confidence:** High. **Files:** tests/permissions-browser.cjs:34, tests/workflows-browser.cjs:38, tests/excel-export-options-browser.cjs:3, tests/readiness-browser.cjs:18.

**Confirmed root cause:** Tests expected removed global-role screens, a legacy users heading, an attachment URL without active-app query scope, and an obsolete Owner-only Automation simulation policy. Current backend requires Builder rights for simulation and denies ordinary users.

**RED before fix:** All four suites reproduced their prior failure independently, using fresh isolated databases.

| Suite | Reproduction | Verified completion |
|---|---|---|
| permissions | [RED](evidence/AUD-004-permissions-red.txt) | [GREEN](evidence/AUD-004-permissions-green.txt) |
| workflows | [RED](evidence/AUD-004-workflows-red.txt) | [final GREEN](evidence/AUD-004-workflows-final.txt) |
| exceloptions | [RED](evidence/AUD-004-exceloptions-red.txt) | [GREEN](evidence/AUD-004-exceloptions-green.txt) |
| readiness | [RED](evidence/AUD-004-readiness-red.txt) | [GREEN](evidence/AUD-004-readiness-green.txt) |

**Minimal fix:** Test-only changes. Exercise actual central-account and per-app-role/member UIs after migration; require the scoped PDF link's exact file pathname and pwa_app=default. Preserve action/table/row/reference/export denial checks. Check that Builder simulation succeeds without changing the business rows and ordinary-user simulation still returns 403. Expectations were updated only where current approved feature contracts changed, not to hide product failures.

**Expected vs actual:** All four suites finish their later assertions. Export permission revocation still denies download and hides export controls; import-only permission remains distinct. Last-owner protection, read-only runtime controls and session revocation remain tested.

**Diffs:** [permissions](evidence/AUD-004-permissions.diff), [workflows](evidence/AUD-004-workflows.diff), [Excel](evidence/AUD-004-excel-export-options.diff), [readiness](evidence/AUD-004-readiness.diff).

**Remaining risks:** Broad suites cover finite fixtures; they do not establish complete security coverage or eliminate browser navigation timing flakes.

## AUD-005 — Selected-tab badge count

**Module:** View tabs. **Confidence:** High. **File:** app/components/ViewDataTabs.tsx:4.

**Root cause:** The fallback branch appended a selected choice outside the first 50 options and explicitly replaced its known count with zero, even when the API supplied a valid count.

**Reproduction:** Seed 602 rows / 601 unique states, choose State 055 from More: API count 1, badge 0 (RED). Search State 600 beyond the 500-option initial domain: count should be 2.

**Minimal fix:** Prefer the current lookup's authoritative label/count; retain an already known count when a truncated option list omits the selected value. Do not alter backend row selection or permission filtering.

**Expected vs actual after fix:** State 055 badge 1; State 600 badge 2 and actual 2-row caption; radius preserved. Passed for table/list at widths 390 and 1440. New tests/data-tab-counts-browser.cjs is registered as integration mode tabcounts.

**Side effects:** [quickfilters](evidence/side-quickfilters.txt) passed: Ref labels, full-table choices, search/AND/empty/clear, pagination reset and responsive layout. Existing unit filter/count tests pass.

**Remaining risks:** A count retained from a prior lookup when the server domain is truncated is a snapshot, not proof of live cardinality after deletion outside that domain. Real device and concurrent-deletion stress were NOT TESTED here.

## AUD-006 — Unknown test mode silently runs another suite

**Module:** Test runner. **Confidence:** High. **File:** scripts/integration.cjs:8-10,39.

**Root cause:** Unrecognized CLI input fell back to the default API test arguments, so a typo could appear green for the wrong suite.

**RED:** New tests/integration-mode.test.cjs ran a synthetic invalid mode, received exit 0 (wrong). **Fix:** Validate against an explicit registry before database/server setup; print selected suite; reject unknown mode with nonzero exit and valid-mode guidance. No-argument and explicit api behavior preserved.

**GREEN:** New regression passes; existing 15 API tests pass. Registered the unit test in scripts/test.cjs. Legitimate modes used throughout this pass continue to work.

**Remaining risks:** No cross-platform process-crash/port-exhaustion stress test added; those are separate runner concerns.

## AUD-007 — Repeated PDF User lookups

**Module:** PDF/User fields/performance. **Confidence:** High. **Files:** lib/user-fields.ts:5-17; lib/pdf-report.ts:2,20.

**Root cause:** Every User cell regenerated the authorized-user catalog and loaded avatar profiles per user. Repeated report cells multiplied the same permission/profile queries.

**Reproduction/RED:** Real pdfHtml call, 20 User cells / 100 synthetic users: 11,930 SQL statements, exceeds a <1,000-statement budget. App-scope/revocation regression already passed before optimization.

**Minimal fix:** Batch avatar lookup and create a lazy authorized-user resolver once inside each pdfHtml call. No process-wide or cross-app permission cache. One-off userFieldLabel remains a fresh lookup.

**GREEN:** Same fixture now 507 SQL statements (~95.8% reduction), correct labels and app A/B visibility, and inactive user disappears in a new report. Two regression cases in tests/pdf-user-lookup.test.cjs are registered in the unit runner.

**Diffs:** [User resolver](evidence/AUD-007-user-fields.diff), [PDF call scope](evidence/AUD-007-pdf-report.diff).

**Side effects:** [Value-type UI/API/Excel](evidence/side-valuetypes.txt), [workflow/PDF/file output](evidence/AUD-004-workflows-final.txt) passed. [Default units](evidence/final-unit.txt): 330/330 passed, zero skipped.

**Remaining risks:** Catalog authorization is still O(users); batching removes repeated profile lookups, not all per-user application authorization queries. Membership changes during one synchronous report apply on the next report. This synthetic query reduction is not a production latency benchmark.

## Final verification

- Default unit tests: 330 passed, 0 failed, 0 skipped. Paused AUD-002 has 2 separate failing tests excluded from that total as explicitly disclosed above.
- Application typecheck: passed with no diagnostics; strict library compilation also runs in the unit runner.
- git diff --check: passed.
- [Fresh production build](evidence/production-build.txt): passed, compile/type checks and 23 static pages completed. Build used .next-check and an isolated build-only database.
- [Production-mode attachment HTTP](evidence/production-attachmentboundary.txt): passed against that fresh build.
- [Production-mode API](evidence/production-api.txt): 15/15 passed, zero skipped.
- [Verification manifest](evidence/verification.json) records completed command outcomes; all report links checked.
- No commit, dependency installation, production database mutation or deployment.
