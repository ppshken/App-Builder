# Bulk Actions — Test evidence

ตรวจวันที่ **2026-10-30** บน Windows / Node / SQLite isolated fixtures และ Next test server ของ Repository ไม่ใช้ฐานข้อมูลจริง ไม่ติดตั้ง Dependency ไม่ Deploy

## ผลรวม

| Command | Expected | Actual | Evidence |
|---|---|---|---|
| `node scripts/test.cjs` | ชุดทดสอบเดิมและ Bulk ผ่าน ไม่มี regression | **Passed: 372/372, failed 0**; มี Bulk 17 ข้อ รวม real executor / SQLite integration | `.test-data/bulk-actions-unit-full.log` |
| `node scripts/integration.cjs api` | API เดิม รวม Single Row / Form / validation ทำงานตามเดิม | **Passed: 15/15, failed 0** | `.test-data/bulk-actions-api-regression.log` |
| `node scripts/integration.cjs bulk` | HTTP + Playwright Table/Builder ครบ flow และ persistence | **Passed** ทุก assertion; ไม่มี pageerror | `.test-data/bulk-actions-browser.log`, `tests/bulk-actions-browser.cjs` |
| `node node_modules/typescript/bin/tsc --noEmit --incremental false` | ไม่มี Type Errors | **Passed**, exit 0 ไม่มี diagnostics | `.test-data/bulk-actions-types.log` |
| `git -c core.safecrlf=false diff --check` | ไม่มี whitespace errors | **Passed**, exit 0 | `.test-data/bulk-actions-diff.log` |

Local logs เป็น generated artifacts ซึ่งไม่ได้จำเป็นต้องถูก commit; Tests และรายงานนี้เป็นหลักฐานที่รันซ้ำได้ Browser mode ปฏิเสธฐานข้อมูลที่ไม่ได้สร้างโดย isolated integration runner

## Unit / SQLite integration: Expected vs Actual

ใช้ `tests/bulk-actions.test.cjs` ร่วมกับ engine จริงที่ compile โดย test runner ทุก fixture สร้าง SQLite ใน memory หรือ `.test-data` เท่านั้น

| Case | Expected | Actual |
|---|---|---|
| Selection / stable IDs | สลับเลือกเฉพาะ IDs ในหน้าที่ส่งเข้า helper ไม่แก้ page อื่น ไม่เลือก unauthorized เกิน max | Passed |
| Strict request / config | ปฏิเสธ Row Data, ขาด versions, IDs ผิด, raw IDs >100, confirmation=false; deduplicate IDs | Passed |
| Per-row expression / condition | amount ของแต่ละแถว +10 โดย Executor เดิม; condition false เป็น skipped | Passed: 2 success, 1 skipped |
| Single Row regression | เรียก `executeAction` เดิมกับแถวเดียวแล้วยังได้ผลเดิม | Passed |
| Idempotency | คำขอเดิมและ JSON สลับ property order คืนผลเดิม; key เดิมแต่ payload ต่างเป็น 409 | Passed; ไม่เพิ่มค่าซ้ำ |
| Stale / deleted / duplicate | stale เป็น VERSION_CONFLICT, missing เป็น ROW_NOT_FOUND, duplicate ทำครั้งเดียว | Passed |
| Partial database failure | Trigger จำลองทำให้แถว 2 fail ต้อง rollback เฉพาะแถวนั้น ไม่ส่ง synthetic error detail | Passed: 1 success, 1 failed; ค่าแถว 2 เดิม |
| Forbidden kinds / hooks | delete/add/copy/grouped/automation/forms/URL/email และ unsafe hook ไม่ทำงาน Bulk | Passed; rows unchanged |
| Duplicate concurrent request | คำขอเหมือนกันพร้อมกันใช้ operation เดียว | Passed; ไม่มี duplicate update |
| Per-row authorization | regular user มี Action grant แต่ row update rule ปฏิเสธแถว 2 | Passed: แถว 1 success, แถว 2 PERMISSION_DENIED |
| Permission revoked mid-batch | ปิด active หลังแถวแรก ต้องไม่แก้แถวถัดไป | Passed |
| Real backend validation | valid_if ไม่ผ่านเฉพาะแถว 2 ต้อง rollback และมี receipt ที่ไม่ซ้ำ | Passed |
| Definition changes / hidden / cross-table | ห้ามใช้กฎใหม่กลางคำขอ, View ซ่อน/Action ต่าง source ไม่อนุญาต | Passed: pending row skipped/403; สำเร็จแล้ว replay ได้แม้ View ถูกซ่อน |
| Crash-state simulation / lease | มี receipt แถวแรกแล้ว resume หลัง lease หมด ต้องทำเฉพาะ pending row | Passed; ไม่ทำแถวแรกซ้ำ |
| Rate / active user limit | max selection, another running request และ >10 new batches/minute ถูกปฏิเสธ | Passed |
| Deadline | เลื่อนเวลาจำลองเกิน 15s หลังแถวแรก แถวถัดไปไม่ทำงาน | Passed: EXECUTION_TIMEOUT |
| App / actor scope | บัญชีหรือแอปอื่นอ่าน receipt ไม่ได้ | Passed: 404 |
| Backup / data epoch | staging ไม่คัดลอก ledger และสร้าง epoch ใหม่; old request ถูกปฏิเสธ | Passed: ledger ว่าง, epoch ต่าง, DATA_EPOCH_CHANGED |
| Existing safe workflow | synchronous same-row set hook ต้องยังเรียกตามเส้นทางเดิมโดยไม่ suppress | Passed: 2 rows updated + hook, 2 succeeded workflow jobs |
| Unsafe workflow variants | background / webhook / parent ref ไม่ผ่าน eligibility | Passed |
| Read-only / Key | external source / changing Key ไม่สามารถใช้ Bulk | Passed |
| Global capacity | 4 active operations แล้ว new request ถูกปฏิเสธ แต่ replay completed receipt ยังได้ | Passed: 429 / replay unchanged |
| Batch boundary | เลือก 100 IDs ทำเฉพาะ IDs เหล่านั้น โดยแถว 101 ไม่ถูกแก้ | Passed: total 100, success 99, skipped 1, failed 0 |

บาง Test มีหลายกรณีในข้อเดียว จำนวนกรณีในตารางจึงมากกว่า 17

## Browser + real HTTP

ใช้ Chromium (Microsoft Edge channel) บน Next server และ SQLite file ที่ runner สร้างใหม่

1. สร้าง Table / Action / View ผ่าน API จริง
2. ตรวจการลบหรือเปลี่ยนชนิด Action ที่ View ใช้อยู่ถูกปฏิเสธ
3. เลือก Header หน้าแรกได้ 25 แถว ไปหน้า 2 เลือกเพิ่ม 1 → แสดง 26
4. Confirmation แสดง Action, Table, จำนวนและชื่อคอลัมน์ แล้วกดซ้ำ
5. ตรวจ success 26 และค่าจริงใน DB เป็น `original +100` ทีละแถว
6. Reload แล้วข้อมูลยังอยู่; replay key เดิมได้ผลเดิม, stale key ใหม่เป็น Conflict
7. Payload เพิ่ม Row Data / View allowlist อ้าง Action ที่ไม่มี ถูกปฏิเสธ
8. ค้นหาแล้ว selection ถูกล้าง; viewport 390×844 ไม่มี document horizontal overflow และ toolbar ใช้ได้
9. จำลอง **server commit แล้ว client ไม่ได้รับ response** ด้วย Playwright route.fetch + abort จากนั้น Reload และกด “ตรวจผล / ลองต่อ” → success 1 และเพิ่มค่าครั้งเดียว
10. ตรวจ Audit receipt จากฐานข้อมูล isolated
11. เปิดหน้า Builder จริง เปลี่ยน maximum selection เป็น 50 บันทึก และอ่าน API ยืนยัน persistence
12. ใช้ real session ของ regular user ที่มี RLS: success 1 และ PERMISSION_DENIED 1
13. ไม่มี cookie →401; Origin ภายนอก →403
14. จำลอง preflight refusal แล้วหยุดติดตามผ่าน Confirmation ได้ ไม่ค้างล็อก Toolbar และคำเตือนระบุชัดว่าไม่ได้ Cancel งานบนเซิร์ฟเวอร์

**Actual: ผ่านทุก assertion** ภาพ viewport มือถือ: `artifacts/bulk-actions-mobile.png` ตรวจภาพแล้ว layout อยู่ในขอบจอ

## Failures encountered and resolved during development

- จำนวน SQL bind placeholders ไม่ตรงหลังเพิ่ม total: แก้ INSERT Ledger และ rerun ผ่าน
- Browser Audit assertion ใช้ชื่อคอลัมน์จากสมมติฐาน: ตรวจ schema จริง พบ Audit เดิมเน้น Metadata จึงเพิ่ม Bulk outcome receipt อย่างชัดเจน และทดสอบ atomicity / ไม่ log ซ้ำ
- Fixture regular-user connection ไม่ได้ register audit SQL functions: register arity ที่ตรงกับ trigger เฉพาะ isolated fixture; ไม่ปิด production audit
- Network retry fixture เลือก version ก่อนการแก้จาก client ภายนอก จึงได้ Conflict ตามที่ออกแบบ: แยก stale test ออกจาก transport test โดย Reload แล้วเลือก snapshot ใหม่ก่อนจำลอง network failure โดยไม่เปลี่ยน Expected Result
- Cold Next development compilation เกินค่าเริ่มต้น 5 วินาทีของ Playwright assertion ในรอบที่รันคู่กับ Unit suite: กำหนด readiness wait 30 วินาทีให้ตรงกับ test-server environment แล้ว rerun ผ่าน โดยไม่เปลี่ยน Expected Result หรืออ้างเป็นการวัด production latency

## Not Tested / Remaining risks

- iPhone/Safari บนอุปกรณ์จริง, accessibility audit เต็มรูปแบบ และ network ระดับ mobile carrier
- หลาย server process / หลาย host พร้อมกัน, kill process ระหว่าง SQLite commit จริง (ทดสอบจำลอง durable state แล้ว)
- Load test ระดับ production, DB ที่มีหลายล้านแถวและสูตร/validation ข้ามตารางที่ซับซ้อน
- Deadline ไม่ interrupt synchronous work กลางแถว
- Automatic ledger retention/cleanup ยังไม่พัฒนา; receipts เก็บต่อเพื่อรักษา idempotency
- เปลี่ยน Production schema, deploy, credentials และ Docker volumes **ไม่ได้ทำ**

สถานะ Milestone: **1–7 Passed สำหรับขอบเขต MVP ที่ระบุ** ไม่รวมรายการ Not Tested ข้างต้น
