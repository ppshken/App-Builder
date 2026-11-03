# ตารางกลาง: Metadata แยกแอปและการใช้ข้อมูลร่วมกัน

วันที่: 3 พฤศจิกายน 2569

## การใช้งาน

1. แอปเจ้าของตาราง: Data > ตาราง > ตั้งค่าคอลัมน์ > แชร์ตารางกลาง
2. เลือกแอปปลายทาง ระบุสิทธิ์ อ่าน/เพิ่ม/แก้ไข/ลบ/ส่งออก แล้วบันทึก เริ่มต้นอ่านอย่างเดียว
3. แอปปลายทาง: Data > เพิ่มตารางจากส่วนกลาง ค้นหาตาราง/แอป เลือกตาราง และกดนำเข้า
4. ตารางเชื่อมจะแสดงป้ายแอปต้นทาง ข้อมูลและ ID เป็นชุดเดียวกัน ไม่คัดลอกแถว
5. ตั้งค่าคอลัมน์ปลายทาง: ตั้งชื่อตารางที่แสดง ชื่อคอลัมน์ที่แสดง เลือก Label และเพิ่มช่องคำนวณเฉพาะแอป
6. ต้นทางเพิ่มคอลัมน์: ปลายทางแสดงสถานะมีโครงสร้างใหม่ กดรีเจนคอลัมน์ ตรวจรายการเพิ่ม/ลบ/เปลี่ยน แล้วกดยืนยัน

เจ้าของ Builder หรือผู้พัฒนาที่จัดการได้ทั้งต้นทางและปลายทางสามารถนำเข้าตารางของแอปที่ตนจัดการได้โดยไม่ต้องตั้งสิทธิ์ซ้ำ ระบบสร้างการเชื่อมแบบอ่านอย่างเดียว ไม่เปิดให้ Builder ทุกคนเห็นทุกตาราง

## สถาปัตยกรรม

- ใช้ _application_datasets, applicationScopeFor และ TableAccess เดิมสำหรับการเชื่อมและสิทธิ์
- _table_shares: สิทธิ์จากเจ้าของตาราง ระบุแอปปลายทางชัดเจน เพดานนี้ใช้ร่วมกับสิทธิ์เชื่อมและบทบาทของผู้ใช้ ถอดอ่านแล้ว API ครั้งถัดไปถูกปฏิเสธ
- _table_overlays: Metadata แยกตามแอปผ่าน APPLICATION_CONFIG_TABLES เก็บ snapshot คอลัมน์จริงพร้อม ID ถาวร, overrides ของ Label, local virtuals และเวลารีเจน
- physical readColumns/rebuildTable/syncKeyIndex ยังคงอ่านโครงสร้างจริง ส่วน columnsOf และ expressionContext รวม Metadata ตามแอปปัจจุบัน
- ไม่สร้าง SQL View หรือสำเนาตารางสำหรับแต่ละการเชื่อม
- ไม่รับคอลัมน์เสมือนต้นทางมาแสดงในแอปปลายทาง สูตรต้นทางยังใช้ภายในเส้นทางตรวจสอบการบันทึก ไม่ใช่ช่องที่นำเข้า
- Runtime ไม่รับ overrides ของชนิดข้อมูล Key Unique หรือชื่อจริงจากปลายทาง และตรวจ shape/identifiers ของ Metadata ก่อนใช้
- ข้อมูลเขียนผ่าน writeRecord เดิม: ใช้ defaults, reset, editability, auto-number, validation และคอลัมน์คำนวณภายในของต้นทาง ร่วมกับสูตรปลายทาง ไม่สร้าง Write/Action Engine ใหม่
- Action ของปลายทางใช้ local formula ได้ และลงท้าย writeRecord เดิม; Automation เกิดในแอปที่สั่งเขียนตาม semantics เดิม ไม่เรียกทุกแอปที่แชร์พร้อมกัน
- การตรวจเวอร์ชันแถวเดิมยังใช้งานได้ การเขียนขณะ snapshot โครงสร้างเก่าถูกปฏิเสธด้วย 409

## รีเจนและการป้องกันผลกระทบ

- ตรวจ preview แล้วใช้ token ซึ่งผูกกับ snapshot + local config + โครงสร้างล่าสุด ยืนยันด้วย token เก่าไม่ได้
- คอลัมน์เพิ่มเข้ามาได้เมื่อไม่มีชื่อชนกับ local virtual และตาราง Ref ที่จำเป็นเชื่อมครบ
- เก็บชื่อที่แสดงและสูตรที่ตั้งเอง หลังรีเจนตรวจ readiness; ถ้าล้มเหลว rollback Metadata ทั้งรายการ
- การเปลี่ยนชื่อ/ชนิด/Ref หรือลบคอลัมน์จริงที่มีผลกระทบยังไม่ซ่อมสูตรให้อัตโนมัติ และยังคง guard เดิมที่ห้ามแก้โครงสร้างทำลายขณะมีแอปอื่นเชื่อม นี่เป็นขอบเขตป้องกันข้อมูล ไม่ใช่การรองรับ destructive migration เต็มรูปแบบ
- เมื่อชื่อ local virtual ชนชื่อคอลัมน์ต้นทาง จะปฏิเสธการบันทึกเพื่อป้องกันการทับสูตรตรวจสอบต้นทาง

## Backup, Clone, Draft และ Audit

- Full backup/restore เก็บ grants และ per-app overlays และตรวจ Metadata/formula ก่อนรับไฟล์
- สำรองรายแอป/Clone แบบฐานข้อมูลใหม่ materialize Label/local virtual ของแอปนั้น ไม่คัดลอก upstream virtual ที่ไม่ได้นำเข้า และไม่ส่ง snapshot ที่มี ID คอลัมน์เก่าไปใช้ผิดชุด
- Clone แบบใช้ข้อมูลร่วมกันเก็บ overlays และสิทธิ์ที่จำกัดไว้; ถ้ามีตารางกลาง ผู้สั่งต้องจัดการแอปเจ้าของตารางนั้นได้ก่อนมอบสิทธิ์ให้แอป clone ใหม่
- Draft/Publish รวมการตั้งค่า overlays; การนำเข้าตารางและแชร์สิทธิ์ต้องทำในเวอร์ชันจริงก่อนสร้าง Draft
- Audit จัดเก็บการแก้ grants และ overlays แยกจาก physical columns
- schemaVersion เพิ่มเป็น v11 เพื่อให้ dev process ที่มี connection เดิมสร้าง Metadata ใหม่ได้ ไม่ต้องอ่าน/แก้ฐานจริงระหว่างงานนี้

## ขอบเขตและข้อจำกัด

- ตาราง Live/Cached API ไม่เปิดแชร์ข้ามแอปในรุ่นนี้ ตามข้อจำกัดเดิม
- อัปเดต: เลือกนำเข้าได้หลายตาราง สูงสุด 50 ตารางต่อครั้ง รวม Ref ภายในชุดเดียวกัน ไม่ grant ตารางที่ไม่ได้เลือกโดยอัตโนมัติ
- การเชื่อมแบบเก่าจากหน้าส่วนกลางยังใช้ behavior เดิม ไม่ migrate โดยเงียบ ๆ; หน้าตั้งค่าแยกแอปนี้ใช้กับการนำเข้าผ่านปุ่มใหม่
- Clone/สำรองแบบฐานข้อมูลใหม่จะปฏิเสธหากกฎบันทึกยังอ้างคอลัมน์คำนวณต้นทางที่ไม่ได้รับมา เพื่อไม่สร้างแพ็กเกจที่กู้คืนแล้วใช้ไม่ได้ ในกรณีนี้ต้องปรับกฎหรือใช้ข้อมูลร่วมกันต่อ
- รูปแบบคอลัมน์จริงปลายทางตั้งได้ชื่อที่แสดงและ Label; ตัวเลือกฟอร์ม/รูปแบบเพิ่มเติมยังตั้งใน View ตามเดิม
- เพิ่มสิทธิ์ที่ต้นทางเป็นการเพิ่มเพดานเท่านั้น สิทธิ์เชื่อมเดิมและบทบาทผู้ใช้ยังต้องอนุญาตด้วย
- สูตรบันทึกต้นทางที่อ้างข้อมูลนอกสิทธิ์ปลายทางจะถูกปฏิเสธ ไม่ยกระดับสิทธิ์ให้สูตรอัตโนมัติ
- อัปเดต: มีปุ่มยกเลิกการเชื่อมพร้อมตรวจผลกระทบและยืนยัน ทั้งรายตารางและหลายตาราง ไม่ลบตาราง/แถวต้นทาง
- ไม่ทดสอบ physical iPhone, VPS จริง หรือ Docker deployment ในงานนี้

## หลักฐานและความคืบหน้า

- Milestone 1: ตรวจ application-schema/context/db, schema/readColumns, permissions, Data UI, Action/writeRecord, backups/clones/releases เสร็จแล้ว
- Milestone 2: per-app overlays + isolated column resolution + source rule write path เสร็จแล้ว
- Milestone 3: share/import UI, tags, local settings/virtual editor และ guarded regeneration เสร็จแล้ว
- Milestone 4: recipient write path ใช้ของเดิมและตรวจ source rules, permissions, row version; legacy source destructive-change guards คงอยู่

Tests:
- Unit/regression: .test-data/shared-unit-delivery.log — 444 total, 437 passed, 0 failed, 7 Windows/POSIX skips
- Development browser/API: .test-data/shared-browser-third.log — Passed; source share/import UI, local Label/formulas, shared data, validation, regen, private-catalog protection, revocation, mobile
- Clone/backup tests verify independent/shared clone, per-app package and full backup inspection. Malformed identifiers and source-formula shadowing fail closed
- Initial failures retained: wrong test formula used + for text instead of CONCATENATE; UI labels were corrected after a Windows encoding issue; temporary export serializer needed its isolated metadata FK setting. Expected results were not weakened
- ผลตรวจ Production Build และ Regression ชุดเดิมอยู่ด้านล่าง

No production database, VPS, credentials or Docker volumes were modified. No deployment performed.

## Acceptance verification

| Check | Result | Evidence (.test-data/) |
|---|---|---|
| Final build / TypeScript | Passed, Next 16 webpack, exit 0 | shared-acceptance-build.log |
| Final shared-table HTTP / browser | Passed, exit 0 | shared-acceptance-browser.log |
| API on final build | Passed 18/18, exit 0 | shared-acceptance-api.log |
| Unit/regression | 444 total: 437 passed / 0 failed / 7 skipped | shared-unit-delivery.log |
| Existing multi-app | Passed | shared-regression-multiapp.log |
| Existing app lifecycle UI | Passed | shared-regression-applifecycle.log |
| Existing Automation/PDF | Passed | shared-regression-workflows.log |
| Existing Bulk Actions | Passed | shared-regression-bulk.log |
| Existing defaults UI suite | Failed, same failure reproduced before this feature | shared-final-defaults.log; shared-baseline-defaults.log |

The final shared-table suite also checks physical-field default values via the real defaults API, original row-version checks, and executing an existing Action using a recipient-only formula. The 13 added unit tests cover metadata isolation, regen/token checks, grant revocation, original write validation, clone/export/restore inspection, malformed persisted metadata, source-formula shadowing, duplicate requests with stale scope, source app branding, safe export rejection and cross-table local-formula dependencies.

### Pre-existing failing suite — not marked Passed

The defaults browser suite expects one button with accessible name “กลับหน้าก่อนหน้า”, but finds zero after opening a desktop detail. Reproduced at tests/defaults-browser.cjs:19 both on current code and on an isolated archive of HEAD 16ea85f (before shared-table implementation). The baseline archive used the same installed dependency tree, a separate production build and disposable synthetic DB. Baseline build passed; the same UI assertion failed. This establishes the failure predates this change; it does not classify whether the product UI or the old test contract needs correction. No expected result was changed and the unrelated navigation UI was not edited. Later steps in that suite did not run.

### Milestone file map

- Metadata/engine added: lib/shared-table-schema.ts, shared-table-columns.ts, shared-tables.ts, shared-table-export.ts. Integration: schema.ts, application-context.ts, db.ts, applications.ts, expression-context.ts, data-write.ts and the defaults branch of api/data/[table].
- UI/API added: api/shared-tables/route.ts, SharedTableDialog.tsx, SharedTableSettings.tsx. Integration: Data page, table edit page, AppShell and existing theme CSS.
- Lifecycle integration: audit-schema.ts, application-lifecycle.ts, application-backups.ts, backups.ts, releases.ts, draft-request.ts, restore-applications.ts, workflow-validation.ts.
- Tests added: shared-tables.test.cjs and shared-tables-browser.cjs. Registered in scripts/test.cjs and scripts/integration.cjs. No dependency installation.
- Mobile screenshot inspected: artifacts/shared-table-mobile.png. Physical iPhone not tested.
- The explicitly isolated build-only database path was not created; no business DB opens during build. Generated next-env references restored to the normal repository location after tests.

## Follow-up: batch import / disconnect

See [multi-table import and impact-checked disconnect](2026-11-03-shared-table-batch-disconnect.md) for current UI, limits, API and verification. This replaces the initial single-table selection and legacy-only unlink limitation.
