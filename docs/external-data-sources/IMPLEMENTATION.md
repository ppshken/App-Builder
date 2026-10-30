# External API Data Source Builder — 30 ตุลาคม 2026

## M1: Existing architecture and integration points

ตรวจ repository จริงที่ `C:/xampp/htdocs/App-Builder` ก่อนแก้โค้ด ไม่เปิดไฟล์ environment หรือฐานข้อมูลจริง

| Existing feature | Implementation / evidence | Integration |
| --- | --- | --- |
| Database Builder | `app/data/page.tsx`, `app/api/tables/route.ts` | เพิ่ม External API ข้างการเพิ่มตารางเดิม |
| Table metadata | `lib/schema.ts:18`, `lib/metadata.ts:9`, `_tables`, `_columns` | ใช้ Column metadata เดิม ไม่สร้างชนิดคอลัมน์ใหม่ซ้ำ |
| Data-source registry | ยังไม่มี registry แบบแยก connector; `_tables` เป็น catalog ปัจจุบัน | เพิ่ม descriptor ประเภท/โหมด แยกจากข้อมูลธุรกิจ |
| CRUD and transactions | `lib/data-write.ts:19`, `lib/form-save.ts:7` | Import/sync ต้องเรียก writeRecord ไม่เขียน business rows ข้าม validation |
| Table/list/detail binding | `app/components/RuntimeTable.tsx`, `lib/view-records.ts:3`, `app/api/data/[table]/route.ts:24` | ใช้ renderer, search, filters, pagination เดิม |
| Dashboard/custom pages | `app/run/page.tsx`, `lib/custom-binding-scope.ts` | ใช้ View ที่เลือก data source เดิม |
| Expressions | `lib/expression-context.ts`, `lib/columns.ts` | expression engine synchronous; ต้องระบุ freshness ของ external snapshots |
| Auth/app boundary | `lib/auth-api.ts:13`, `lib/application-context.ts:6`, `lib/permissions.ts` | API ต้องใช้ session, CSRF, app scope และ table/row rights เดิม |
| Existing outbound API | `lib/workflow-runner.ts:30`, `lib/workflow-config.ts` | Webhook มีอยู่แล้ว แต่ไม่ใช่ read connector/schema mapper |
| Jobs | `lib/workflow-runner.ts` drainWorkflows/startWorkflowWorker, `instrumentation.ts:1` | ใช้ worker lifecycle เดิม ไม่เพิ่ม worker timer อีกชุด |
| Backup/clone/release | `lib/backups.ts`, `lib/application-backups.ts`, `lib/application-lifecycle.ts`, `lib/releases.ts` | ต้องรองรับ source metadata และแยก credentials ออกจาก backup |

### Extension design

- Source types: INTERNAL_DATABASE, EXTERNAL_REST_API, IMPORTED_DATA; internal เป็นค่าเริ่มต้นของ metadata เก่า
- REST configuration แยกจาก Column metadata; ใช้ `_tables`/`_columns` และ View เดิม
- Live/Cached อ่านอย่างเดียว ไม่สร้าง physical business table; adapter ใช้ bounded mapped snapshot และ SQL view เพื่อใช้ read/query engine เดิม
- Live ต้อง refresh ผ่าน backend ก่อนอ่าน; Cached ใช้ TTL; UI ต้องบอกว่า search/filter/sort ครอบคลุมเฉพาะ window ที่ดาวน์โหลด
- Import/Sync ใช้ internal table และ writeRecord; external key เป็น unique business key; ไม่มี implicit deletion
- Secrets อ้างอิง server-managed credentials เท่านั้น ไม่รับ/คืน token จริงใน Builder ไม่บันทึก credentials ลง schema/cache/log
- HTTPS + operator allowlist + ตรวจ DNS ทุก address + pin address ของ connection; ไม่ใช้ check-then-fetch ที่ resolve DNS ซ้ำ
- จำกัด response/body/pages/records/time/retry/concurrency และ rate limit; ไม่คืน error body ของ upstream
- การ sync ใช้ persistent job, lease และ checkpoint; ห้ามเริ่ม sync ซ้อนบน source เดียวกัน
- OAuth 2.0 authorization/token refresh และ TWO_WAY_SYNC เป็น future phase ต้องไม่เปิดตัวเลือกที่ใช้งานไม่ได้

### Sources checked 2026-10-30

- [Node HTTPS request options](https://nodejs.org/api/https.html): ใช้ custom lookup, servername และ certificate verification
- [OWASP SSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html): allowlist, IP validation, DNS pinning และ redirect policy

### Milestone delivery — implemented, validated in isolated environments

| Milestone | Files changed / functionality | Compatibility | Evidence / remaining |
| --- | --- | --- | --- |
| M1 discovery | This document; existing feature matrix and integration design above | Reuses Next.js routes, SQLite catalog, app scope, renderer, writeRecord and Automation worker | Analysis, not runtime verification |
| M2 connection/preview | app/data-sources/page.tsx, sources.css, app/api/data-sources/route.ts, lib/external-http.ts, external-connector.ts, data-source-registry.ts | Backend proxy only; operator-managed credential references | E2E six-step wizard; masked preview; actual public HTTPS smoke HTTP 200. OAuth deferred |
| M3 mapping | lib/external-data-config.ts | Existing scalar normalizers/Column metadata; required, default, ignore, unique external key | Unit path/schema/type/duplicate cases. Paths use dot notation and numeric brackets; no full JSONPath language |
| M4 binding | lib/external-storage.ts, table-builder.ts, schema.ts, db.ts; app/data/page.tsx, AppShell.tsx, RuntimeTable.tsx; API data/view-data/excel routes; permissions.ts, applications.ts, metadata.ts, view-api.ts, view-records.ts, auth-api.ts, column-conversion.ts, table metadata route | LIVE/CACHED are read-only SQL views over bounded snapshots; no source-specific physical business table. Original Table/List/Detail, row permissions, search, filters, sorting, paging and Excel reused | Browser live table/refresh/stable ID/write rejection/mobile; API regression 15/15. Cross-table Ref to LIVE is blocked |
| M5 import | lib/external-sources.ts, table-builder.ts | Creates normal internal table; validated writeRecord upsert, external key unique | Unit and API: initial import, stable IDs, no-op, atomic failure rollback |
| M6 sync | lib/external-worker.ts, external-connector.ts, external-storage.ts; existing worker lifecycle in workflow-runner.ts | Persistent job, lease, app/source quota, bounded concurrency, checkpoint, interval schedule, keep/inactive/delete | Unit due schedules/inactive/no-op/incremental/full sync/quotas; E2E upsert/drift recovery and duplicate job. No partial checkpoint commits |
| M7 Automation | lib/external-workflow-events.ts, workflow-config.ts, workflows.ts, workflow-validation.ts, automation.ts, simulation.ts, expression.ts; app/workflows/page.tsx, WorkflowCanvas.tsx | Existing source step registry + sync events; reserved summary fields; normal identifier checks remain intact | E2E completed sync → refresh source workflow. Existing workflows and designer browser regressions pass |
| M8 safety/portability/tests | lib/external-portability.ts, backups.ts, restore-applications.ts, application-backups.ts, application-lifecycle.ts; tests/external-data.test.cjs, external-http-fixture.cjs, external-sources-browser.cjs; scripts/test.cjs, integration.cjs; app/globals.css | Old backups accepted; new generated SQL views reconstructed, arbitrary/tampered views rejected. Clone/restore pause connections; preserve accounts. No production DB or deployment changes | Unit 355/355; API 15/15; E2E, workflows, designer, TypeScript and diff checks. See TEST_RESULTS.md and SECURITY_REVIEW.md for exact scope |

## Usage

1. ผู้ดูแลเซิร์ฟเวอร์อนุญาต Origin และเตรียม Credential ตาม SETUP.md แล้ว restart process/container
2. เข้า Data → เพิ่มแหล่งข้อมูล API → Connection → Test Connection
3. ระบุ Data Path ที่ชี้ไปยัง Array เช่น data.items แล้ววิเคราะห์ Schema
4. ตรวจ Mapping, ชนิดข้อมูล, Required (ปิด = nullable), Default, Ignore และ External Key
5. เลือกโหมดและเพดาน Pagination; ยืนยันชื่อตารางใน Review
6. ระบบสร้าง metadata และ View ปกติ เลือกตารางนี้ใน View/Component เดิมได้ทันที
7. Import/Sync ใช้ฟอร์มของตารางภายในได้; LIVE/CACHED ไม่อนุญาตเพิ่ม/แก้/ลบ
8. จัดการแหล่งข้อมูลที่ Data Sources: พัก/เปิด, แก้ Connection, Refresh, Sync Now, Full Sync และประวัติ 50 งานล่าสุด

## Data and job semantics

- LIVE fetches before normal data/view-data/Excel reads; CACHED reads the snapshot until TTL expires (5–86,400 seconds). Manual Refresh bypasses TTL.
- Expressions are synchronous and see the latest stored snapshot; they do not independently call the remote API. A fetched window is not guaranteed to represent the complete upstream database. The runtime displays that limitation.
- Search/filter/sort/page apply to that downloaded window using the existing query engine. No implicit translation to upstream filters or SQL.
- Source management is per app. LIVE datasets cannot be shared directly across apps; clone to a separate app/source instead. Imported physical tables retain existing dataset sharing behavior.
- Initial import is atomic. Sync fetches all configured pages outside the write transaction, maps all rows, then upserts/checkpoints atomically through existing validation and Automation behavior. A failure commits no partial business changes.
- Incremental cursor accepts integer versions or ISO timestamps **with timezone**. Numeric strings compare numerically; timestamps compare instants, not display text. Pagination cursors are separate from incremental checkpoints.
- Checkpoint advances after a successful queued sync; first scheduled sync may rescan initial imported rows (idempotent upsert). Full Sync omits the saved incremental query parameter; it is explicit, not an automatic silent retry.
- Failed jobs can be resumed by Sync Now from the last successful checkpoint. Active jobs for the same source are deduplicated. Connection edits wait for active sync to finish; pausing causes an in-flight write to fail its precommit check.
- Missing rows default to Keep. Inactive adds source_active. Delete needs typed table confirmation; empty upstream cannot wipe a nonempty table and any incoming Ref/List blocks automatic deletion. Incremental requires Keep.
- Event summaries expose [__SYNC_CREATED], [__SYNC_UPDATED], [__SYNC_FAILED], [__SYNC_SOURCE]. Sync event workflows may Fetch/Refresh or send Webhook; starting another sync from that event is rejected to avoid loops. There is no business row to mutate or render as PDF in a summary event.
- Workflow Fetch validates a bounded API response against the mapping; Refresh updates a live snapshot; Sync enqueues import upsert. Fetch does not automatically export raw response into arbitrary workflow fields.

## Portability and lifecycle

- Source configuration has no secret values, only server registry IDs. Full backups retain snapshots and job history; per-app packages omit live cache, limits/leases and sync history.
- Restore disables all sources, expires caches and fails active sync jobs. Operator checks origin/credential scopes before re-enabling. Current account credentials are preserved and worker ownership is remapped through the existing account restore rules.
- App clone creates new source IDs and paused definitions. It never shares live credentials or a live cache implicitly. Reauthorize the new app ID in the server credential registry.
- Deleting an app retains its existing owned data per platform policy; source definitions are retained under default app, paused. App deletion is blocked while its external jobs are active.
- Draft can preview a connection but cannot create/update/sync source definitions. Connection publication/version rollback is not implemented; configure sources in the Live workspace. Views that consume those tables still use existing app configuration/versioning.

## Limits and deliberate scope

- 20 sources/app; mapping 100 fields; schema sample 30 rows, 200 fields, depth 8; response preview 10 items with masked PII-like fields.
- Request timeout 1–30 seconds; each response 2 MiB; whole traversal 10 MiB/60 seconds; 1–20 pages; 1–10,000 rows; page size <=1,000. Incomplete traversal fails rather than silently importing a truncated result.
- At most 4 outbound requests/process and 2 source-worker app scopes/process; 40 attempts/source/minute and 120/app/minute shared in SQLite. Retries consume the same budget. Rate limits and bounded retries are used instead of a new circuit-breaker service in this release.
- A source lease lasts 90 seconds; abandoned running jobs are failed after 5 minutes. Deployment still needs one consistent shared SQLite storage model; this does not introduce a distributed multi-host queue.
- Stable live IDs retain up to 100,000 unique external keys/source; source snapshots <=10 MiB. Numeric external keys must be safe integers; very large IDs must arrive as strings.
- Simple JSON paths support ASCII keys, dots and numeric brackets. Keys containing literal dots/spaces/non-ASCII and wildcard/filter JSONPath need a future path dialect. JSON Objects/Arrays map into text/longtext as sanitized JSON.
- POST read-only query requires operator exact-path policy and the Builder checkbox. Upstream credentials must themselves be read-only; an HTTP client cannot prove that an external POST has no side effects.
- No arbitrary mapping scripts, two-way writeback, OAuth2 token lifecycle, automatic destructive schema migration, generic plugin sandbox, persistent circuit breaker, source deletion UI or job-retention policy in this release.
- Job history is retained in SQLite (UI shows latest 50); operators should plan a retention policy as usage grows. No million-row load benchmark, actual iPhone test, real credential-based remote integration or production container deployment was run.

## Follow-up order

1. Validate the actual target API in staging with read-only credentials and its pagination contract; check quotas and expected cursor format.
2. Add contract fixtures for that provider, then measure 1k/10k row import/sync latency on target hardware.
3. Add connection versioning/schema evolution and history retention before expanding source volume.
4. Extend path syntax and connector-specific filter/paging pushdown when real integrations need them.
5. OAuth2 and two-way sync need separate consent, encrypted token storage, conflict/idempotency rules and approval design.
