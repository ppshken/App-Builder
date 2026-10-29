# Bug report

วันที่: 29 ตุลาคม 2026 — Audit Mode / ไม่แก้ Source Code

## สรุป

**7 Confirmed Findings:** P1 = 3, P2 = 4. ไม่มี P0 exploit/data loss ที่พิสูจน์กับระบบนี้ในรอบตรวจ; dependency advisory มี vendor severity critical และผลกระทบอาจถึง P0 ตาม deployment โดยยังไม่ได้ทดสอบ exploit

Confidence และขอบเขตสำคัญกว่าคำว่า green: Unit 323 ข้อผ่าน แต่พบ cross-app file authorization failure และ bug ที่ชุดเดิมไม่ครอบคลุม

| ID | Severity | Module | ข้อค้นพบ |
|---|---|---|---|
| AUD-001 | P1 High | M03 Authorization / M14 Attachments | ผู้พัฒนาแอปหนึ่งดาวน์โหลดไฟล์ของอีกแอปได้ หากทราบรหัสไฟล์ |
| AUD-002 | P1 High | M02 Authentication | Login สำเร็จก็นับเข้าขีดจำกัดส่วนกลาง จนทุกบัญชีถูกบล็อกได้ |
| AUD-003 | P1 High; potential P0 impact on affected Windows production deployments | M01 Framework / dependency security | Next.js และ PostCSS รุ่นที่ติดตั้งอยู่ใน affected ranges ของ security advisories |
| AUD-004 | P2 Medium | M23 QA / regression coverage | E2E เดิม 4 ชุดไม่ตรงกับ contract ของ UI ปัจจุบัน ทำให้ทดสอบไม่ครบ |
| AUD-005 | P2 Medium | M07 View data tabs | แท็บที่เลือกจาก เพิ่มเติม แสดงจำนวนเป็น 0 แม้มีข้อมูล |
| AUD-006 | P2 Medium | M23 Test runner | สะกดชื่อ integration mode ผิด แต่ runner กลับรายงานผล API ชุดอื่นผ่าน |
| AUD-007 | P2 Medium | M13 PDF User fields / M24 Performance | การ resolve ชื่อ User ซ้ำทำ N+1 queries จำนวนมากในรายงาน PDF |

## AUD-001 — ผู้พัฒนาแอปหนึ่งดาวน์โหลดไฟล์ของอีกแอปได้ หากทราบรหัสไฟล์

- **Category:** Confirmed Finding
- **Module / Feature:** M03 Authorization / M14 Attachments
- **Severity:** P1 High
- **Confidence:** High — reproduced at helper and production HTTP API layers
- **File and Line:** lib/permissions.ts:46; lib/auth-api.ts:31; app/api/files/[id]/route.ts:2
- **Root Cause:** assertFileAccess returns immediately for access.builder, without checking access.datasets, attachment ownership or a readable row reference. The file handler then reads the global _files table. assertImageAccess applies a different, stricter dataset-aware rule.

**Steps to Reproduce**

1. สร้างไฟล์จำลองผูกกับตารางในแอปต้นทาง
2. สร้างแอป A แยกและมอบเฉพาะสิทธิ์พัฒนาแอป A ให้บัญชีจำลอง โดยไม่เชื่อมตารางต้นทาง
3. Login บัญชีดังกล่าวและเลือกแอป A
4. เรียก API ตารางต้นทาง แล้วเรียก /api/files/<synthetic-id> ด้วย session เดียวกัน

**Expected:** ทั้งตารางและไฟล์ที่ไม่อยู่ในขอบเขตแอปต้องตอบ 403

**Actual:** ตารางตอบ 403 แต่ไฟล์ตอบ 200 และ bytes ตรงกับข้อมูลจำลอง

**Evidence:** [HTTP evidence](evidence/http-file-authorization.json), [helper evidence](evidence/runtime-reproductions.json)

**Impact:** Cross-app confidentiality boundary fails for attachments; a UUID is not an authorization boundary. Requires an authenticated app developer and knowledge of an attachment ID. No live attachment or real account was accessed.

**Recommended Fix:** Apply dataset-aware authorization for developers, like the image path. Require an authorized reference in the active app, or a narrowly scoped upload-owner/provenance exception for unfinished uploads. Preserve explicitly shared table access and owner-only central management.

**Regression Tests (proposed; not written during audit):** Developer A vs file B (known ID); ordinary reader row allow/deny; shared-table file; own pending upload; revoked membership; default/PWA simultaneous apps; malformed/missing ID.

## AUD-002 — Login สำเร็จก็นับเข้าขีดจำกัดส่วนกลาง จนทุกบัญชีถูกบล็อกได้

- **Category:** Confirmed Finding
- **Module / Feature:** M02 Authentication
- **Severity:** P1 High
- **Confidence:** High — isolated runtime reproduction
- **File and Line:** lib/auth.ts:33-35, 51; app/api/auth/profile/route.ts:10
- **Root Cause:** throttle increments a global bucket for every validly formed login request. Successful login clears only the per-account hashed scope; global remains. The public bucket is shared across accounts and IPs for 15 minutes. Password-change validation also calls login.

**Steps to Reproduce**

1. เริ่มฐานข้อมูลจำลองใหม่และสร้างบัญชีที่ใช้งานได้
2. Login ด้วยข้อมูลที่ถูกต้องซ้ำ 20 ครั้ง
3. Login ครั้งที่ 21 ก่อนครบเวลา bucket

**Expected:** Successful logins should not exhaust a shared failed-login quota and deny unrelated legitimate users

**Actual:** 20 successes; the next request returns 429; global bucket count is 20

**Evidence:** [Runtime evidence AUD-002](evidence/runtime-reproductions.json)

**Impact:** Availability failure and a shared public denial-of-login mechanism; normal aggregate traffic can trigger it. The reported experiment used successful logins only, not a production flood.

**Recommended Fix:** Separate failed-attempt rate limits per account and trusted client identity/IP, with a deliberate aggregate abuse budget. Do not retain successful requests as failures. Keep atomic updates and generic error responses; verify reverse-proxy client identity before trusting forwarded headers.

**Regression Tests (proposed; not written during audit):** More than 20 aggregate successful logins; success after prior failures; distinct users/IPs; one abusive account must not lock all users; password-change validation; concurrent failed attempts and expiry.

## AUD-003 — Next.js และ PostCSS รุ่นที่ติดตั้งอยู่ใน affected ranges ของ security advisories

- **Category:** Confirmed Finding
- **Module / Feature:** M01 Framework / dependency security
- **Severity:** P1 High; potential P0 impact on affected Windows production deployments
- **Confidence:** High for vulnerable installed versions; application exploitability NOT TESTED
- **File and Line:** package.json:34; package-lock.json:1202 (next); lockfile node_modules/postcss entry
- **Root Cause:** The lockfile and installed dependencies resolve Next.js 14.2.15 and PostCSS 8.4.31. npm audit --omit=dev reports 1 critical and 1 high vulnerable package. These are dependency findings, not proof that every advisory is exploitable in this app.

**Steps to Reproduce**

1. ใช้ package/lockfile ของสำเนาแยกโดยไม่ install/fix
2. รัน npm.cmd audit --omit=dev --ignore-scripts --registry=https://registry.npmjs.org --json
3. เทียบ affected versions กับ vendor advisories

**Expected:** Production dependency gate contains no unresolved advisories applicable to the deployment

**Actual:** Registry audit flags 2 vulnerable packages (critical: 1, high: 1). Vendor Windows RCE advisory includes this Next version; vendor middleware advisory also includes it.

**Evidence:** [Dependency audit](evidence/dependency-audit.json); [Next vendor middleware advisory](https://github.com/vercel/next.js/security/advisories/GHSA-f82v-jwr5-mffw); [Next vendor Windows advisory](https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36)

**Impact:** Potential framework-level security impact depends on OS and enabled paths. The repository checks sessions/rights in API handlers as well as routing, so middleware advisory presence alone does NOT prove bypass of those API checks. Windows-specific RCE must not be generalized to Linux.

**Recommended Fix:** Plan a supported, fully patched Next/React-compatible target and review migration changes, dynamic route APIs, caching and middleware behavior. Do not blindly run npm audit fix --force or treat one historical 14.x patch as fixing all current advisories. Re-audit and rerun security/E2E gates before rollout.

**Regression Tests (proposed; not written during audit):** Unauthenticated and cross-app API matrix; rewritten/PWA routes; action/body limits; cache behavior; Docker build and native dependency compatibility on the actual Linux target. Destructive exploit tests require a separate approved lab.

## AUD-004 — E2E เดิม 3 ชุดไม่ตรงกับ contract ของ UI ปัจจุบัน ทำให้ทดสอบไม่ครบ

- **Category:** Confirmed Finding
- **Module / Feature:** M23 QA / regression coverage
- **Severity:** P2 Medium
- **Confidence:** High for failed assertions; underlying runtime paths after failure remain untested
- **File and Line:** tests/permissions-browser.cjs:34; tests/workflows-browser.cjs:38; tests/excel-export-options-browser.cjs:3; tests/readiness-browser.cjs:18; app/components/AttachmentValue.tsx:7
- **Root Cause:** Selectors still expect the legacy users heading/global role cards and an exact attachment href without the application query parameter. Current routing centralizes user management; AttachmentValue builds scoped URLs through appResourceUrl.

**Steps to Reproduce**

1. รัน production integration modes permissions, workflows, exceloptions, readiness แยกฐานข้อมูล
2. สังเกต assertion ที่รอ heading, legacy role card และ exact attachment link

**Expected:** Selected suites finish all current behavior assertions and fail only on an actual contract regression

**Actual:** Three suites time out on selectors; readiness fails a legacy expectation that Automation is skipped for a builder. Later assertions are not completed. Earlier successful PDF/webhook/export assertions do not make the whole suite pass.

**Evidence:** [permissions failure](evidence/permissions.log), [workflows failure](evidence/workflows.log), [Excel failure](evidence/exceloptions.log), [readiness failure](evidence/readiness.log)

**Impact:** Reduced regression protection and noisy gates. This finding is a test-maintenance failure, not proof that the three product features are broken.

**Recommended Fix:** After approval, update navigation/selectors against the intended UI contract; assert semantic attachment role/name and parsed scoped URL. Keep authorization assertions and cover the per-app role workflow rather than removing checks to get a green result.

**Regression Tests (proposed; not written during audit):** All 4 full suites must complete after approved changes; intentionally remove permissions/file target to ensure tests still fail.

## AUD-005 — แท็บที่เลือกจาก เพิ่มเติม แสดงจำนวนเป็น 0 แม้มีข้อมูล

- **Category:** Confirmed Finding
- **Module / Feature:** M07 View data tabs
- **Severity:** P2 Medium
- **Confidence:** High — browser and authorized API compared on synthetic rows
- **File and Line:** app/components/ViewDataTabs.tsx:4
- **Root Cause:** The visible chip set is sliced to 50. For a selected value outside this set, the fallback explicitly replaces selected.count with 0 whenever data.total is available. This discards the valid count fetched in the full options/more results.

**Steps to Reproduce**

1. สร้าง View ตารางที่มีคอลัมน์แท็บ 60 ค่าไม่ซ้ำ แต่ละค่ามี 1 แถว
2. เปิด เพิ่มเติม แล้วเลือกค่า State 55
3. เทียบ badge ของชิปกับ option_counts API

**Expected:** Badge is 1, equal to its source count

**Actual:** API count is 1; selected chip badge is 0

**Evidence:** [Browser/API evidence](evidence/tabs-reproduction.json); screenshot retained in isolated audit artifacts (synthetic data only)

**Impact:** Incorrect UI state and misleading counts for high-cardinality tab columns. Row filtering still works in the reproduced case.

**Recommended Fix:** Use the latest matching count from the source/more option; distinguish a confirmed missing value from a value omitted by the 50/500 display cap. Invalidate stale selected counts on data revision without forcing a known value to zero.

**Regression Tests (proposed; not written during audit):** Selection 51–500; server-searched option beyond 500; refresh after count change; deleted selected value; empty values; Slice/row permissions; both table and list layouts.

## AUD-006 — สะกดชื่อ integration mode ผิด แต่ runner กลับรายงานผล API ชุดอื่นผ่าน

- **Category:** Confirmed Finding
- **Module / Feature:** M23 Test runner
- **Severity:** P2 Medium
- **Confidence:** High — unknown mode executed and returned a successful API test summary
- **File and Line:** scripts/integration.cjs:35-36
- **Root Cause:** Unknown process.argv[2] values fall through to the default API test list. There is no allowlist rejection or explicit api/default distinction.

**Steps to Reproduce**

1. รัน node scripts/integration.cjs readonlyaudit ซึ่งไม่มีใน browserTests
2. อ่านชนิด test ที่ถูกรันและผลคำสั่ง

**Expected:** Unknown mode exits nonzero and lists accepted modes; no substitute suite is silently counted

**Actual:** The runner executes default API tests: 15 passed / 0 failed. The originally mistyped applicationroles command behaved the same; correct approles was run separately.

**Evidence:** [Unknown-mode log](evidence/invalidmode.log); scripts/integration.cjs:36

**Impact:** CI and manual audits can falsely believe a requested feature suite passed. These fallback runs were excluded from coverage in this report.

**Recommended Fix:** Reject unknown names explicitly. Preserve deliberate no-argument/api behavior; print the selected file list/mode before execution and emit structured suite identity and status.

**Regression Tests (proposed; not written during audit):** Known mode; explicit api; no argument as documented; misspelling/unknown mode must exit nonzero before launching tests.

## AUD-007 — การ resolve ชื่อ User ซ้ำทำ N+1 queries จำนวนมากในรายงาน PDF

- **Category:** Confirmed Finding
- **Module / Feature:** M13 PDF User fields / M24 Performance
- **Severity:** P2 Medium
- **Confidence:** High for measured query amplification; production latency under load NOT TESTED
- **File and Line:** lib/user-fields.ts:5,7; lib/pdf-report.ts:21
- **Root Cause:** userFieldLabel calls userFieldOptions for every label. userFieldOptions reads all active users and performs app-access/profile lookups for each. The PDF value renderer calls userFieldLabel separately for User cells. Excel already builds a user map once and is not assumed to have the same per-cell behavior.

**Steps to Reproduce**

1. สร้างผู้ใช้จำลอง 100 รายในฐานข้อมูล memory
2. นับ SQL statements โดยไม่บันทึก SQL หรือค่าผู้ใช้
3. เรียก userFieldLabel 20 ครั้งภายใต้ scope เดียวกัน

**Expected:** Resolve an authorized lookup map once per request/report; repeated labels should not rescan the user catalog

**Actual:** 12,020 SQL statements for 20 labels; 118 ms in the local synthetic run

**Evidence:** [Measured query counts](evidence/performance-reproductions.json) DR-001a; PDF call site lib/pdf-report.ts:21

**Impact:** Repeated synchronous queries amplify cost as users and PDF User cells grow. The measurement establishes query amplification; it is not a claimed production throughput/SLA result.

**Recommended Fix:** Build an authorized User label map once per report/request; batch profile and membership queries. Scope any cache by database/application/user/permissions and never use a global unkeyed authorization cache.

**Regression Tests (proposed; not written during audit):** Report with many repeated/different User cells and 100+ users; assert a query budget scaling with users plus cells rather than users times cells; inactive/revoked/cross-app users remain hidden.

## Design Risks — ไม่ใช่บัคที่พิสูจน์ว่าล้มเหลวแล้ว

### DR-001 — inventory scans / quadratic reference de-duplication

- **P2 design/performance risk; confidence high for structure and local timing.** lib/media-inventory.ts:6,20; app/api/app-management/route.ts:11.
- Inventory of 1,000 unreferenced synthetic files made **1,016 SQL statements / 12 ms**. Scanning 10,000 references to one image took **296 ms**. evidence/performance-reproductions.json.
- Each reference insertion scans an ever-growing list with list.some; one popular image has quadratic de-duplication work. Each file also fetches metadata separately, and each UI filter/page can trigger another inventory scan.
- Expected: indexed/batched inventory with bounded request cost. Actual: measured scan/query amplification; no production timeout was demonstrated.
- Recommend keyed Sets, batch joins, a transactionally maintained reference index, and bounded/paginated query work. Regression: 10k/100k references, shared tables, query counts and event-loop responsiveness.

### DR-002 — request/backup buffering and synchronous work

- **P2 design risk; memory exhaustion NOT TESTED.** lib/api.ts:12 reads general JSON without a common byte budget; lib/backup-stages.ts:18 parses multipart before checking actual file.size; app/api/backups/application/route.ts:20,22 buffers files/chunks and reads the download into memory.
- Some routes have explicit streaming limits (images/files/Excel/scoped backup); behavior is duplicated and inconsistent. A 512 MB allowed scoped upload can have multiple live copies during concat/FormData/arrayBuffer.
- Expected: consistent streamed byte limits, bounded staging concurrency and a worker/streaming strategy. No large malicious or OOM payload was sent. Reproduce only in an approved resource-limited test lab; assert controlled 413, bounded RAM and no partial data.

### DR-003 — optimistic versions are optional to API callers

- **P2 design risk.** lib/row-version.ts:6 accepts version === undefined; browser forms provide versions and concurrentedit passed, but an API caller can omit the field.
- Expected policy must be explicit: strict concurrency for user edits versus intentional last-write-wins/integration writes. Actual compatibility path skips conflict detection. No claim of a broken browser form.
- Recommend defining the contract per endpoint and testing stale/missing tokens across imports, Actions, inline child writes and external clients.

### DR-004 — external side effects cannot be rolled back by SQLite

- **P1 operational design risk, not a confirmed duplicate execution.** lib/workflow-runner.ts:32 and processJob webhook/checkpoint branch.
- HTTP success can occur before local checkpoint commits or before a server outage. Idempotency-Key is supplied and redirects/timeouts are controlled, but the receiver must honor the key. Real provider behavior and forced crash recovery were not tested.
- Recommend documented at-least-once semantics, receiver idempotency contract, reconciliation and approved crash-window tests.

### DR-005 — unused-code diagnostics and unproven dead endpoints

- **P3 cleanup candidate.** Supplementary noUnusedLocals/noUnusedParameters returned 36 diagnostics, including app/api/data/[table]/route.ts:7 and lib/workflow-runner.ts:19. Evidence: unused.log.
- These are static diagnostics, not proof of a runtime bug or removable public API. Two initially unreferenced library candidates are used by root middleware/dynamic instrumentation and are not confirmed dead code. No endpoint is declared unused solely from missing literal fetch strings.

## Suspected Issues — ต้องพิสูจน์เพิ่ม

### SUS-001 — HTTPS reverse-proxy request-origin/cookie behavior

lib/auth.ts:53; middleware.ts; deploy/Caddyfile.https. Request protocol/host and secure-cookie handling depend on the actual proxy chain. Local HTTP tests and PWA simulation do not validate the deployed HTTPS chain. Hypothesis only; do not label production CSRF/cookie handling broken without an approved Linux/TLS test.

### SUS-002 — large-table limits in expression-backed screens

lib/expression-context.ts:24-25 intentionally caps a formula snapshot at 10,000 rows. A raw SQL-paged table can work at sizes where a Ref/formula/slice-dependent screen rejects a larger related table. This is a documented guard/scale boundary, not proof of an incorrect result. Needs a user-specific large-schema scenario and an agreed product contract before classification as a bug.

## Untested Areas

See TEST_COVERAGE_MATRIX.md. In particular, no production DB, credentials, physical iPhone, Docker volume, external provider, RCE payload, million-row load or disk-full scenario was tested. Failed legacy E2E checks remain failed; none was edited, skipped or relabeled as fully passed.
