# Test coverage matrix

วันที่: 29 ตุลาคม 2026 — Asia/Bangkok

## นิยามผล

- **PASS**: การทดสอบที่ระบุผ่านตามขอบเขตนั้น ไม่ใช่การรับรองทุกเส้นทางของ Module
- **FAIL**: มีข้อผิดพลาดยืนยันใน Module หรือ gate ที่ระบุ แม้บางการทดสอบผ่าน
- **PARTIAL**: มีผล runtime บางส่วน แต่ suite ไม่จบ/ยังมีช่องว่างสำคัญ ห้ามนับเป็นผ่าน
- **NOT TESTED**: ไม่ได้รันทดสอบ runtime; การอ่าน config ไม่ใช่ผลผ่าน

ตรวจ discovery/static แบบมุ่งความเสี่ยงครบ **25 Modules**; มี runtime evidence **24 Modules**; PASS **14**, FAIL **8**, PARTIAL **2**, NOT TESTED **1**. บัคหนึ่งข้ออาจกระทบหลาย Module จึงห้ามนำจำนวน Module ที่ FAIL ไปเท่ากับจำนวนบัค

| ID | Module | สถานะ | จุดตรวจหลัก | Runtime evidence | ขอบเขต / ข้อจำกัด |
| --- | --- | --- | --- | --- | --- |
| M01 | Framework / dependencies | FAIL | package.json; next.config.mjs; middleware.ts | Type/build + registry audit | AUD-003 |
| M02 | Authentication / accounts / profile | FAIL | lib/auth.ts; auth-schema.ts; app/api/auth | Unit + runtime login probe | AUD-002; physical device profile UX not tested |
| M03 | Authorization / app-table-row boundaries | FAIL | lib/auth-api.ts; permissions.ts; row-access.ts | approles + HTTP negative probe | AUD-001 |
| M04 | Schema / migration / conversion | PASS | lib/schema.ts; column-conversion.ts; unique.ts | Unit + API + conversion | Scoped pass; no copy of live schema/data used |
| M05 | CRUD / Ref / cascade / child forms | PASS | data-write.ts; delete-record.ts; part-of-records.ts; form-save.ts | Unit + API + concurrentedit | Positive/negative/rollback cases in existing suites |
| M06 | Expressions / data types / validation | PASS | expression.ts; columns.ts; duration.ts; scalar-fields.ts; barcode.ts | Unit + valuetypes | Camera scanning and all real-world formulas not tested |
| M07 | View builder / tabs / groups / filters | FAIL | view-api.ts; view-display.ts; ViewDataTabs.tsx | quickfilters + selected-more browser probe | AUD-005 |
| M08 | Runtime navigation / form/detail/inline | PASS | RuntimeTransition.tsx; RuntimeTable.tsx; runtime-page-stack.ts | navcontract + mapdesign + concurrentedit | Simulated mobile; not physical iPhone |
| M09 | Dashboard / Map / Calendar / Chart | PASS | RuntimeViewRenderer.tsx; SpecialRuntimeView.tsx; special-view-data.ts | mapdesign + quickfilters | Map tiles mocked; all chart distributions not exhaustively covered |
| M10 | Custom page designer/runtime | PASS | custom-page.ts; custom-page-references.ts; CustomRuntimeView.tsx | Unit + custompagev2 | Selected v2 components and access controls |
| M11 | Actions / ordered values / business writes | PASS | automation.ts; action-config.ts; form-save.ts | Unit + API + approles | Full user-specific Action catalog not available |
| M12 | Automation / schedules / webhook | PARTIAL | workflows.ts; workflow-runner.ts; workflow-config.ts | Unit + workflows E2E until final failure | Entire workflows suite failed; real external provider and crash window not tested |
| M13 | PDF generation / designer | FAIL | pdf-report.ts; pdf-design-html.ts; workflow-runner.ts | Unit + PDF steps executed before workflows final failure + SQL probe | AUD-007; complete PDF E2E suite not passed |
| M14 | Images / attachments / file inventory | FAIL | permissions.ts; files.ts; images.ts; media-inventory.ts | Unit + appoperations + HTTP file probe | AUD-001; DR-001/DR-002 |
| M15 | Excel import/export and permissions | PARTIAL | excel.ts; app/api/excel; Excel UI | API + approles + valuetypes + partial exceloptions | exceloptions fails before final permission-revoke UI checks |
| M16 | Applications / clone / delete / role membership | PASS | applications.ts; application-lifecycle.ts; application-roles.ts | Unit + approles + applifecycle | Separate and shared data modes tested in fixtures |
| M17 | Backup / restore / account remapping | PASS | backups.ts; backup-stages.ts; application-backups.ts; restore-applications.ts | Unit + restoreapps + appoperations | Small fixtures; 512 MB restore and disk-full not tested |
| M18 | Audit / user usage history | PASS | audit-schema.ts; audit-log.ts; app-usage.ts; AppOperationsManager.tsx | Unit + appoperations | No historical live identities read; retention-scale boundary not tested |
| M19 | Realtime / authorization refresh | PASS | realtime-schema.ts; app/api/realtime; Runtime realtime client | Unit + realtime + approles | Multiple-process deployment not tested |
| M20 | Cache / IndexedDB / PWA | PASS | runtime-cache.ts; runtime-storage.ts; pwa-worker.ts; pwa-server.ts | Unit + pwa + navcontract | Native iOS PWA lifecycle, quota exhaustion not tested |
| M21 | Diagnostics / system report / readiness | PASS | system-report.ts; performance-report.ts; readiness.ts | Unit + systemreport + readinessperf | Metrics scope is one process; no production monitoring validation |
| M22 | Docker / Linux / Caddy / cold backup | NOT TESTED | Dockerfile; compose.yaml; deploy/* | Static review only | No Docker command, volume, production DNS/HTTPS or credentials accessed |
| M23 | Test infrastructure / regression gates | FAIL | scripts/test.cjs; scripts/integration.cjs; tests | Actual selected suites + invalid mode execution | AUD-004 / AUD-006; no coverage instrumentation installed |
| M24 | Performance / scalability | FAIL | user-fields.ts; media-inventory.ts; expression-context.ts | 10,000-row E2E + SQL-count/timing probes | AUD-007; no 1M-row or multi-user stress test |
| M25 | Draft / release / rollback isolation | PASS | releases.ts; draft-request.ts; simulation.ts | Unit isolation + readiness publish/rollback/conflict assertions before unrelated final failure | No production publishing or live rollback performed |

## การรันทดสอบ

Unit: **323 ผ่าน / 0 ล้มเหลว**. Type check ตาม tsconfig เดิมและ production build ผ่านบนสำเนาแยก. Supplementary noUnusedLocals/noUnusedParameters พบ **36 diagnostics**; ตัวเลือกนี้ไม่ได้เปิดใน tsconfig เดิม ไม่ใช่ความล้มเหลวของ build เดิม

Integration/API/E2E ที่เลือกชื่อถูกต้อง **20 suites: 16 ผ่าน, 4 ล้มเหลว**. ตารางนี้บันทึก Expected/Actual ทุก suite; รายละเอียด stack trace อยู่ใน evidence ของแต่ละชุด

| Suite | Expected | Actual | Evidence |
| --- | --- | --- | --- |
| permissions | จบ assertions ทั้งหมดโดยไม่ล้มเหลว | FAIL: Legacy users heading selector timed out; downstream assertions not completed. | [log](evidence/permissions.log) |
| workflows | จบ assertions ทั้งหมดโดยไม่ล้มเหลว | FAIL: Final attachment href selector timed out after earlier PDF/webhook/queue checks; complete suite not passed. | [log](evidence/workflows.log) |
| appoperations | จบ assertions ทั้งหมดโดยไม่ล้มเหลว | PASS: Scoped export/import, file inventory, usage and owner-only access completed. | [log](evidence/appoperations.log) |
| quickfilters | จบ assertions ทั้งหมดโดยไม่ล้มเหลว | PASS: Table/list filters, count chips, pagination, dashboard, radius save completed. | [log](evidence/quickfilters.log) |
| api | จบ assertions ทั้งหมดโดยไม่ล้มเหลว | PASS: 15 TAP tests passed, 0 failed. | [log](evidence/api.log) |
| mapdesign | จบ assertions ทั้งหมดโดยไม่ล้มเหลว | PASS: Map config, source-preserving navigation, calendar/chart responsive checks completed. | [log](evidence/mapdesign.log) |
| realtime | จบ assertions ทั้งหมดโดยไม่ล้มเหลว | PASS: SSE authorization, changes, dirty form, rollback, reconnect and revoke completed. | [log](evidence/realtime.log) |
| pwa | จบ assertions ทั้งหมดโดยไม่ล้มเหลว | PASS: Two apps, app cookies, offline fallback and no business-response SW cache completed. | [log](evidence/pwa.log) |
| approles | จบ assertions ทั้งหมดโดยไม่ล้มเหลว | PASS: Per-app roles, row/Action/Excel grants and revoke completed. | [log](evidence/approles.log) |
| restoreapps | จบ assertions ทั้งหมดโดยไม่ล้มเหลว | PASS: Multi-app restore, account matching, namespaces, Ref and session revoke completed. | [log](evidence/restoreapps.log) |
| applifecycle | จบ assertions ทั้งหมดโดยไม่ล้มเหลว | PASS: Clone/delete and mobile layout completed. | [log](evidence/applifecycle.log) |
| concurrentedit | จบ assertions ทั้งหมดโดยไม่ล้มเหลว | PASS: 409 version conflict, preserved draft, reload and child rollback completed. | [log](evidence/concurrentedit.log) |
| navcontract | จบ assertions ทั้งหมดโดยไม่ล้มเหลว | PASS: Header/drawer, dirty form navigation and reduced motion completed. | [log](evidence/navcontract.log) |
| exceloptions | จบ assertions ทั้งหมดโดยไม่ล้มเหลว | FAIL: Legacy global role card selector timed out; later revoke/import-only UI checks not completed. | [log](evidence/exceloptions.log) |
| custompagev2 | จบ assertions ทั้งหมดโดยไม่ล้มเหลว | PASS: Custom views/forms/Actions, responsive and access checks completed. | [log](evidence/custompagev2.log) |
| systemreport | จบ assertions ทั้งหมดโดยไม่ล้มเหลว | PASS: Owner-only metrics API/UI, tables/indexes, graphs and dark/mobile completed. | [log](evidence/systemreport.log) |
| valuetypes | จบ assertions ทั้งหมดโดยไม่ล้มเหลว | PASS: User/Price/Percent/Rating API/forms/Excel completed. | [log](evidence/valuetypes.log) |
| readiness | จบ assertions ทั้งหมดโดยไม่ล้มเหลว | FAIL: final legacy builder Automation-skipped expectation fails; publish/rollback subflow completed | [log](evidence/readiness.log) |
| conversion | จบ assertions ทั้งหมดโดยไม่ล้มเหลว | PASS: conversion preview/apply safety assertions completed | [log](evidence/conversion.log) |
| readinessperf | จบ assertions ทั้งหมดโดยไม่ล้มเหลว | PASS: Existing 10,000-row bounded assertions completed; not a production load guarantee. | [log](evidence/readinessperf.log) |

คำสั่ง applicationroles และ readonlyaudit ไม่ใช่ mode ที่ runner รู้จัก แต่กลับรัน default API tests 15 ข้อและสำเร็จ ทั้งสองคำสั่ง **ไม่นับเป็น coverage ของ Module ที่ตั้งใจทดสอบ** (AUD-006). ได้รัน approles ที่ถูกต้องแยกแล้ว

## Positive / Negative / Boundary / Concurrent

- Positive: form saves, Ref/child writes, export/import, clone/restore, Action, PDF และ SSE ใน fixtures
- Negative/unauthorized: per-app grants, row rules, owner-only management, revoked rights, denied table และ broken file boundary ที่พบ
- Boundary: data type limits, 500-choice options, selected tab beyond first 50, missing User matching และ invalid/empty values ในชุดเดิม/inline probes
- Concurrent: stale version 409, child rollback, dirty draft retention, request-local DB isolation, SSE updates; ไม่ใช่ many-user load test
- Failure: mock webhook failure/resume steps, offline PWA fallback, reconnect, missing coordinates; disk-full, forced process kill และ real network-provider outage ไม่ได้ทดสอบ

## Not Tested / ไม่สามารถสรุปได้

1. Production, ฐานข้อมูลจริง, ข้อมูลผู้ใช้จริง, credentials และ Docker volumes ตามข้อห้าม
2. Linux Compose/Caddy จริง, TLS reverse proxy, real domain, SMTP/S3/Drive และ disaster recovery ทั้งเครื่อง
3. Physical iPhone/Safari/Chrome, camera/gallery permission และ iOS standalone lifecycle; viewport simulation ไม่แทนของจริง
4. 300,000–1,000,000 แถว, concurrent user จำนวนมาก, long soak, 512 MB uploads/restores, storage-full/OOM
5. Exploitability ของทุก dependency advisory; ไม่ทดสอบ RCE หรือ payload ทำลายระบบ
6. ทุก browser test ใน 213 ไฟล์: รอบนี้รันเฉพาะชุดที่ระบุ ไม่มี statement/branch/line coverage instrumentation จึงไม่รายงานเปอร์เซ็นต์ coverage
7. Full end-to-end paths หลังจุดล้มเหลวของ permissions/workflows/exceloptions/readiness; ห้ามนำผลก่อนจุดล้มเหลวไปสรุปว่าส่วนท้ายผ่าน
8. Full security fuzzing ของทุก field/route และ dynamic external references ของไฟล์

## แผนทดสอบที่ต้องอนุมัติก่อนเขียนไฟล์ใหม่

เพิ่ม regression cases ตาม BUG_REPORT และ FIX_PLAN: cross-app attachments, successful-login/global failure isolation, selected-more counts, runner invalid-mode rejection, query budgets และปรับ selectors เดิมให้ตรง contract ปัจจุบัน. ยังไม่ได้เพิ่ม/แก้ไฟล์ทดสอบหรือติดตั้ง dependencies ใน Audit นี้
