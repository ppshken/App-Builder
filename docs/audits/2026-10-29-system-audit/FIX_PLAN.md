# Fix plan — ต้องอนุมัติก่อนแก้ Source / เขียน regression files

วันที่: 29 ตุลาคม 2026

สถานะ: **Proposal only**. Audit นี้ยังไม่ได้แก้ Source Code, เพิ่มไฟล์ทดสอบ, ติดตั้ง dependency, deploy, migrate ฐานข้อมูลจริง หรือเปลี่ยน Docker volumes

## Gate 0 — เก็บ baseline และกำหนด contract

- ใช้ frozen source snapshot และผลใน evidence เป็น baseline; เดิม Unit 323 ผ่าน แต่ไม่ถือว่าไม่มีบัค
- ทวนขอบเขตผู้พัฒนาแอป: ผู้พัฒนา A ต้องไม่อ่านไฟล์ B เว้นแต่ข้อมูลถูกเชื่อม/อนุญาตอย่างชัดเจน
- ยืนยัน contract ของแท็บ: จำนวนของค่าที่เลือกต้องตรง API แม้เกิน 50/500 ตัวเลือก
- แยก compatibility writes ที่ไม่มี version ออกจาก user-edit concurrency policy
- อนุมัติรายการไฟล์ regression และ framework migration target ก่อนเขียน/ติดตั้ง ไม่ใช้การแก้ test เพียงเพื่อซ่อน failure

## ลำดับ 1 — ปิดข้อผิดพลาด P1

### AUD-001: attachment boundary

**Change scope:** lib/permissions.ts (assertFileAccess), ตรวจ checkFiles และไฟล์ endpoint ที่เรียก guard; ไม่แก้โครงสร้าง/ข้อมูลจริง

**Implementation direction:** เคารพ application datasets และ readable row references; แยก owner central access ออกจาก per-app builder; จำกัด unfinished upload exception ด้วย actor และ app provenance ไม่ใช่ builder flag กว้าง ๆ

**Required regression (proposed):** HTTP two-app developer fixture, ordinary reader row allow/deny, shared table, own pending upload, revoked membership, PWA concurrent apps, unknown/malformed UUID. ต้องได้ 403 ใน probe เดิมพร้อม source table และ file; legitimate file downloads ยังได้ 200

**Rollout:** isolated tests → review → staging access matrix → approval before production. ไม่ลบไฟล์/ข้อมูลเก่าโดยอัตโนมัติ

### AUD-002: login quota

**Change scope:** lib/auth.ts; profile password-check path; optional proxy-aware rate-limit helper

**Implementation direction:** failed-attempt buckets per account and trusted client identity; aggregate abuse threshold ที่ไม่ lock ทุกบัญชีจาก traffic ปกติ; atomic counters, expiry และ generic responses

**Required regression:** 21+ valid successes ไม่บล็อก; single-account brute force ถูกจำกัด; successful login after failures; unrelated users/IPs unaffected; concurrent attempts; password change; expiry. ไม่ใช้ real password/account และห้ามทำ load attack กับ production

### AUD-003: dependencies

**Change scope:** package/lockfile + framework compatibility files only after target approval

**Implementation direction:** เลือก supported patched release ที่แก้ advisories ที่เกี่ยวข้องจริง; ตรวจ React compatibility, Next dynamic route params, middleware, headers/caching, native better-sqlite3 และ Playwright/Docker. ห้ามเริ่มด้วย npm audit fix --force โดยไม่ประเมิน breaking changes

**Required gates:** dependency audit ใหม่, type/build, full auth/access matrix, API/E2E/PWA, Docker Linux staging build. No exploit or framework install performed during this audit. Historical 14.2.25 fixes one advisory but is not a complete current target

## ลำดับ 2 — correctness และ regression gates

| Finding | Proposed change | Acceptance / regression |
|---|---|---|
| AUD-005 | Preserve authoritative count for selected extra chip; distinguish omitted/not-found/stale | State 55 shows 1, options beyond 500, empty/deleted/changed values, row policies, table + list |
| AUD-006 | Reject unknown runner modes; print suite identity and structured result | readonlyaudit must fail fast nonzero; deliberate api/no-argument behavior explicit |
| AUD-004 | Update 4 legacy suites to current central-user/per-app-role/scoped-file contracts | permissions, workflows, exceloptions, readiness all complete; preserve negative security assertions |
| AUD-007 | Resolve authorized User map once per PDF/request and batch membership/profile lookup | Query budget O(users + cells), correct role/app visibility, no shared unkeyed auth cache |

ตำแหน่งไฟล์ทดสอบที่เสนอ: existing tests/permissions-browser.cjs, workflows-browser.cjs, excel-export-options-browser.cjs, readiness-browser.cjs, quick-filters-browser.cjs, view-filter-options.test.cjs และ dedicated access/auth/PDF query-budget cases ตามความเหมาะสม. **ยังไม่เขียนหรือแก้ไฟล์เหล่านี้**

## ลำดับ 3 — design risks ที่ต้องเลือกนโยบายก่อน

1. **DR-001:** keyed reference de-duplication, batch media metadata, bounded inventory; ทดสอบ 10k/100k reference fan-out ก่อนรับรอง large app
2. **DR-002:** per-route byte budgets/streaming/backpressure, staging concurrency, backup download streaming/worker; ทดสอบ payload limits, temp disk/full/RAM ใน container disposable เท่านั้น
3. **DR-003:** document or enforce required optimistic versions per endpoint; integrations ที่ตั้งใจ last-write-wins ต้อง explicit
4. **DR-004:** idempotency contract + reconciliation for external webhooks; approved mock crash-window tests ก่อนเชื่อม provider จริง
5. **DR-005:** cleanup 36 unused diagnostics แยกจาก functional fixes; อย่าลบ public API จาก static reference count เพียงอย่างเดียว

## เพิ่มเติมก่อน production confidence

- Approved Linux/Caddy HTTPS staging: secure cookies, CSRF, forwarded host/protocol, connection/SSE behavior
- Real iPhone/PWA test matrix และ low-memory cases
- 100k → 300k → 1M synthetic rows, realistic Ref/formula distribution, concurrent sessions, p95/p99 and CPU/RAM/DB timing; local 10k success ไม่แทนผลนี้
- Restore rehearsal, disk-full and backup retention; no production restore/drop/volume deletion as a test
- No automated destructive cleanup or actual external email/webhook/cloud writes without explicit scope and separate configuration

## Definition of done หลังอนุมัติแก้

- Probe ของแต่ละ Confirmed Bug เปลี่ยนจาก Actual ผิดเป็น Expected ถูกต้อง พร้อม negative/positive regression
- Unit, valid API/E2E และ type/build gates ผ่าน; failed/unknown/partial suites ห้ามนับเป็น passed
- Relevant dependency advisories cleared/mitigated with evidence for target deployment
- Review data-migration impact and a concrete rollback plan before any production change
- เปรียบเทียบ performance ด้วย schema/data/hardware เดียวกัน ไม่เปรียบเทียบตัวเลขจากคนละ environment
