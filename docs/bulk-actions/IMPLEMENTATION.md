# Bulk Actions MVP — บันทึกการพัฒนา

วันที่ 30 ตุลาคม 2026 · ไม่ติดตั้ง Dependency เพิ่ม ไม่ Deploy และไม่เชื่อมต่อฐานข้อมูล Production

## วิธีเปิดใช้

1. ไปที่ **View → เลือก View ชนิดตาราง → รูปแบบหน้าจอ → Bulk Actions · เลือกหลายแถว**
2. เปิดเลือกหลายแถว และติ๊ก Action เดิมที่เป็นการเปลี่ยนค่าคอลัมน์ของตารางนั้น
3. กำหนดจำนวนสูงสุด 1–100 และตำแหน่ง Toolbar ด้านบน/ด้านล่าง แล้วบันทึก View
4. เปิดแอป เลือกแถว เลือก Action และยืนยัน ตรวจผลสำเร็จ/ล้มเหลว/ข้ามหลังทำรายการ

Checkbox หัวตารางเลือกเฉพาะแถวที่แสดงในหน้าปัจจุบัน ไม่ได้เลือกทั้งหมดในฐานข้อมูล เลือกข้ามหน้าและเรียงใหม่ได้ โดยเก็บ ID จริงกับ `__version` ตอนเลือก เปลี่ยนคำค้นหา ตัวกรอง กลุ่ม View แอป หรือ Workspace จะล้าง Selection แถวที่โหลดมาแล้วไม่มีสิทธิ์แก้ไขจะถูกนำออก การ Refresh ไม่เปลี่ยน Version ของแถวที่เลือกโดยเงียบ ๆ จึงรายงาน Conflict หากข้อมูลเปลี่ยน

## Milestone และไฟล์ที่เกี่ยวข้อง

รายการนี้ระบุเฉพาะส่วนของงาน Bulk; Worktree มีงานเดิมของผู้ใช้อยู่ก่อนแล้วและไม่ได้ย้อนกลับ

| Milestone | Files Added | Files Modified | Integration / ผลทดสอบ |
|---|---|---|---|
| 1. สำรวจ | `EXISTING_BULK_ACTION_ANALYSIS.md` | — | ตรวจเส้นทาง Grid → Registry → Executor → writeRecord → Permission / Audit / Workflow; เอกสารสำรวจไม่ถือเป็น Runtime Test |
| 2. Selection | `lib/bulk-action-config.ts` | `app/components/RuntimeTable.tsx` | PK selection, page-only select-all, reset/prune; Unit + Browser ข้ามหน้าและค้นหา |
| 3. Toolbar / Builder | `app/components/BulkActionToolbar.tsx` | `app/components/ViewDisplayEditor.tsx`, `app/globals.css`, `lib/view-display.ts`, `lib/view-api.ts` | Components เดิม, ConfirmDialog, Spinner, ตั้งค่า View และบันทึกจริงใน Browser |
| 4. Orchestrator | `lib/bulk-actions.ts`, `lib/bulk-action-schema.ts`, `app/api/actions/bulk-execute/route.ts` | `lib/schema.ts`, `lib/db.ts` | เรียก `executeAction` เดิมภายใน Transaction รายแถว; Unit / real HTTP |
| 5. Result / Retry | ใช้ Toolbar และ Ledger ข้างต้น | `RuntimeTable.tsx` | Structured result, progress polling, cache invalidation, failed IDs, resume request เดิมหลัง transport failure |
| 6. Security / Audit | Ledger และ endpoint ข้างต้น | `lib/auth-api.ts`, `app/api/actions/route.ts`, `lib/backups.ts` | Auth/RLS ทุกแถว, versions, idempotency, rate/capacity, Action dependency checks, Audit receipts, restore epoch |
| 7. Tests / Evidence | `tests/bulk-actions.test.cjs`, `tests/bulk-actions-browser.cjs`, เอกสารนี้และ `TEST_RESULTS.md` | `scripts/test.cjs`, `scripts/integration.cjs` | ดูผล Expected / Actual และข้อจำกัดใน TEST_RESULTS |

## Reuse และ Transaction

ไม่แก้ฟังก์ชัน `executeAction` หรือ `writeRecord` เพื่อทำ Bulk แต่เรียกของเดิมด้วย Action name, ID, identity และ Slice ของแต่ละแถวจริงจากฐานข้อมูล จึงคงโหมด snapshot/sequential, validation, reset, reference validation, hooks และ realtime triggers เดิม

Outer **IMMEDIATE transaction ต่อแถว** ครอบ Executor ซึ่งใช้ nested transaction/savepoint เดิม รวมการบันทึกผลและ Audit receipt ใน Transaction เดียวกัน หาก Action หรือ validation ล้มเหลว จะ rollback แถวนั้น จากนั้นบันทึกผลล้มเหลวแยกกัน แถวอื่นทำต่อได้ ไม่มี Atomic Batch ใน MVP

Audit เดิมเน้น Metadata ไม่ได้มีประวัติแก้ไข business row ครบทุกค่า งานนี้จึงเพิ่ม receipt ใน `_audit_log` (`category=actions`, `entity_type=bulk_action`) ระบุ app/table/row/action/outcome ไม่บันทึกเนื้อหาแถว สูตรที่คำนวณได้ หรือ SQL errors ใน receipt และยังรักษา Audit/usage เดิม

## Eligibility และ Hook boundary

- เฉพาะ `kind=set` ของตารางเดียวกันและอยู่ใน allowlist ของ **View ที่บันทึกจริง**
- ไม่ใช้ `edit_form`: ชนิดนี้เป็นการเปิดฟอร์ม ไม่ใช่ Executor อัปเดตทันที
- ไม่เปิด delete/add/copy/grouped/automation/navigation/URL/communication/HTTP/script
- ไม่รองรับการเปลี่ยนคอลัมน์ Key และ Key ที่มี Reset On Edit อัตโนมัติ
- Live/Cached API source ยังคงอ่านอย่างเดียว
- ตรวจ UPDATE Automation ของตารางเป้าหมาย อนุญาตเฉพาะ `execution=save` ซึ่งทุกขั้นตอนเป็น direct `set` ในแถวเดิม ไม่มี parent_ref หรือ composite ทุก Action ต้องใช้ได้ด้วยสิทธิ์ผู้ใช้จริง
- Hook ที่ไม่เข้าเกณฑ์ทำให้ Bulk ใช้ไม่ได้ ไม่ suppress hooks เพื่อฝืนทำงาน และไม่เปลี่ยน Single Row
- Definition signature รวม View / Action / Columns / safe hook definitions ตรวจใหม่ก่อนทุกแถว ป้องกันเปลี่ยนสูตรกลาง Batch
- Dropdown ตรวจ Availability ด้วยข้อมูลจริงของ ID ที่เลือก แสดง Action เมื่อมีอย่างน้อยหนึ่งแถวทำได้ แถวอื่นที่ไม่ผ่านเงื่อนไขจะเป็น skipped และ Backend ตรวจซ้ำตอน Execute

## API และการจำกัดทรัพยากร

`GET /api/actions/bulk-execute?view=NAME&ids=1,2` ส่ง `{dataEpoch,actions:[{name,label,fields}]}`

`POST /api/actions/bulk-execute`

```json
{
  "actionId": "approve_order",
  "viewName": "orders_table",
  "rowIds": [101, 102],
  "versions": {"101": "64-hex-existing-row-version", "102": "64-hex-existing-row-version"},
  "dataEpoch": "32-hex-value-from-options-response",
  "idempotencyKey": "new-unique-request-key"
}
```

ตัวอย่าง Version เป็นข้อความอธิบาย ต้องใช้ hash จริงจาก `__version` ไม่ส่ง Row Data

`GET /api/actions/bulk-execute?idempotencyKey=KEY` อ่านผลของบัญชีและแอปตนเองเท่านั้น

ผลลัพธ์มี `status,total,processed,success,failed,skipped,results` โดยแต่ละ result มี `rowId,status,code?` ไม่มีข้อความ exception ภายใน; Server log บันทึกเฉพาะรหัสผล, hash อ้างอิงคำขอ และ SQLite error code ที่ผ่านการกรอง ไม่บันทึกข้อมูลแถวหรือ exception message

- Request body ≤32 KiB, จำนวน raw IDs ≤100, deduplicate แล้วตรวจเพดาน View อีกครั้ง
- ทำทีละแถว พร้อม yield ระหว่างแถว ไม่มี Promise.all ที่ไม่จำกัด
- Active batch ≤1 ต่อบัญชี/แอป และ ≤4 ต่อฐานข้อมูล
- New batches ≤10 ต่อบัญชี/แอป/นาที; replay ไม่กิน budget ใหม่
- Deadline 15 วินาที ตรวจระหว่างแถว แถวที่ยังไม่ทำได้ EXECUTION_TIMEOUT
- Lease 60 วินาที ป้องกันการแย่งงาน คำขอเดิมหลัง lease หมดทำต่อเฉพาะแถวที่ยังไม่มี receipt

## Retry / Restore

Ledger แยกตาม app + actor + idempotency key; payload เดิมที่สลับลำดับ JSON properties ยังถือเป็นคำขอเดิม แต่เปลี่ยน IDs / versions / Action ด้วย key เดิมจะถูกปฏิเสธ

Pending request เก็บใน sessionStorage แยก user/app/workspace/view เพื่อกลับมาตรวจผลหลังเครือข่ายขาดหรือ Reload ได้ ใช้ key เดิมเสมอ หาก Batch สำเร็จบางส่วน จะคงเฉพาะ failed IDs ให้แก้ปัญหาแล้วลองใหม่ ส่วน Version Conflict ต้องตรวจข้อมูลและเลือกแถวใหม่ ไม่อัปเดต Version แล้วเขียนทับโดยอัตโนมัติ

หลังเครือข่ายขัดข้องสามารถกดหยุดติดตามได้โดยต้องยืนยันคำเตือนว่าไม่ใช่การยกเลิกงานบนเซิร์ฟเวอร์ และต้องตรวจข้อมูลล่าสุดก่อนสั่งใหม่

Ledger ไม่ Clone และไม่คัดลอกจาก Backup เข้า Restore staging; `_bulk_action_state` สร้าง data epoch ใหม่ ปฏิเสธ pending request จาก timeline ก่อน Restore แม้เนื้อหาแถวตรงกัน ไม่มีงานถูก replay โดยตัว Restore

## Known limitations / Remaining risks

- รองรับ Table View ผ่าน RuntimeTable; ยังไม่มี Multi-select ใน Related inline แบบฝังหรือหน้า raw Data ของ Builder
- ยังไม่รองรับ Atomic Batch, เลือกทั้งหมดในฐานข้อมูล, Delete, Background queue หรือ Cancel หลังส่งคำขอ
- Deadline หยุดระหว่างแถว ไม่สามารถยกเลิก JavaScript/SQLite synchronous action ที่กำลังทำงานกลางแถวได้
- Resume หลัง crash ทดสอบด้วยการจำลอง durable state ไม่ได้ kill process กลาง SQLite commit จริง หรือทดสอบหลาย host
- Audit receipt ไม่ใช่ complete before/after row history; บันทึกเฉพาะ outcome และตัวระบุ
- Ledger ยังไม่มีนโยบายล้างอัตโนมัติ เพื่อคง idempotency receipts; ต้องวางแผน retention ก่อนใช้งานปริมาณสูง
- App/role/columns ที่แก้กลาง Batch อาจทำให้แถวที่เหลือล้มเหลวหรือถูกข้ามตามสิทธิ์/definition ใหม่ ไม่ยอมทำด้วยกฎเก่าที่ถูกถอนสิทธิ์
- ทดสอบ viewport มือถือใน Chromium ไม่ใช่ iPhone จริง และไม่ใช่ load test ระดับ production
