# ตรวจสอบ Slices — 2026-11-06

สถานะหลังได้รับอนุมัติแก้ไข: ดู [ผลการแก้ไขและ Regression](2026-11-06-slices-fixes.md) รายงานด้านล่างเก็บหลักฐานก่อนแก้ไว้ตามเดิม

## ขอบเขตและสภาพแวดล้อม

ตรวจเส้นทาง Builder → Slice metadata → View → Data API → Action และ Excel รวมถึงข้อจำกัด Inline โดยไม่แก้ Source Code ไม่แตะฐานข้อมูลผู้ใช้ และไม่ Deploy

Runtime: Windows, Node 22.12.0, localhost, production build `.next-check` ที่มีอยู่จากงานก่อนหน้า ใช้ฐานข้อมูลใหม่จาก integration runner ทุกครั้ง ข้อมูลจำลองทั้งหมด ไม่มีข้อมูลบุคคลจริง ผลนี้ไม่ใช่การวัดบนเซิร์ฟเวอร์จริงหรือ iPhone จริง ไม่ได้ build source ล่าสุดซ้ำในการตรวจนี้

## การทำงานปัจจุบัน

- `app/components/RuleManager.tsx:59`: เลือกตาราง สูตรกรอง และคอลัมน์ ไม่เลือกคอลัมน์หมายถึงทั้งหมด ช่องจำเป็นของฟอร์มยังใช้กฎตารางต้นทาง
- `app/api/slices/route.ts:14`: ตรวจตาราง สูตรและคอลัมน์ก่อนบันทึก ป้องกันตัดคอลัมน์ที่ View ใช้ และป้องกันลบ Slice ที่ View อ้างอิง
- `lib/automation.ts`: ตรวจสูตรด้วย schema จริง; resolve Slice ของตาราง; ประเมินสูตรต่อแถว; Action ตรวจ Slice บนข้อมูลปัจจุบันก่อนทำงาน
- `app/api/data/[table]/route.ts:63`: อ่านข้อมูลที่ผ่านสิทธิ์ระดับแถว คำนวณค่า กรอง Slice จากนั้นค้นหา/เรียง/แบ่งหน้า
- `lib/view-filter-options.ts`: ตัวเลือกและจำนวนนับใช้ขอบเขต Slice
- `lib/view-api.ts:62`: Inline ไม่อนุญาต Slice ใช้ Ref ของแม่กรองรายการลูก
- Slice เป็นมุมมองข้อมูล ไม่ใช่ขอบเขตความปลอดภัย ต้องใช้สิทธิ์ตารางและสิทธิ์ระดับแถวเพื่อจำกัดการเข้าถึงจริง การเลือกคอลัมน์ของ Slice ไม่ได้ลบคอลัมน์อื่นออกจาก API response
- การบันทึกฟอร์มใช้กฎของตาราง ไม่ได้ใช้เงื่อนไข Slice เป็น Valid_If จึงบันทึกค่าแล้วแถวนั้นออกจาก Slice ได้

## ผลทดสอบจริง

### ผ่าน

1. Existing integration `automationapi`: 2 tests / 2 passed / 0 failed
   - สูตรกรองที่ใช้คอลัมน์คำนวณและ USEREMAIL
   - ไม่ยอมรับชื่อคอลัมน์หรือสูตรไม่ถูกต้อง
   - ป้องกันใช้คอลัมน์นอก Slice ใน View และลบ Slice ที่มี View ใช้
   - Action condition, validation, rollback และกรองหลังเปลี่ยนสถานะ
   - เปลี่ยนชื่อคอลัมน์แล้วปรับสูตรอ้างอิง และล้าง metadata เมื่อลบตาราง
   - grouped actions และสิทธิ์ Action (ตามกรณีที่มีใน suite ไม่ใช่สิทธิ์ทุกแบบ)
   - หลักฐาน `.test-data/slices-existing-api.log`
2. Probe เพิ่มเติม `.test-data/slices-audit.cjs` ผ่าน:
   - กรอง 2 แถวเหลือ 1 ก่อนแบ่งหน้า total=1
   - dropdown options และ counts เหลือค่า open เพียงค่าเดียว
   - invalid formula / missing Slice ถูกปฏิเสธ
   - PUT เปลี่ยน open → closed แล้ว total ของ Slice เป็น 0
   - API ปฏิเสธผูก Slice กับ Inline ด้วย 400 ตามข้อจำกัดปัจจุบัน
   - ลบ Slice ที่ไม่ได้ใช้งานได้
   - หลักฐาน `.test-data/slices-audit-runtime.log`

### ยังไม่ผ่านครบ / Not Tested

- Existing browser suite `automation`: ไปถึงสร้างและบันทึก Slice พร้อมเปิดตัวช่วยสูตรได้ จากนั้น timeout รอ checkbox สถานะในหน้า Action (`tests/automation-browser.cjs:11`) จึงยังไม่ยืนยัน full E2E, mobile Action และกลับจากรายละเอียดใน suite นี้
- หลักฐาน `.test-data/slices-browser.log` ยังไม่ได้วิเคราะห์สาเหตุของ locator failure ว่า test ล้าสมัยหรือเป็น UI bug
- ไม่ได้ตรวจทุก combination ของ app scope, draft/publish, backup/restore, shared datasets, concurrent edit, realtime และ external data sources ด้วย runtime
- ไม่ได้ทำ load/concurrent-user test หรือ memory profiling

## SLICE-001 — Confirmed performance issue (P2)

**หลักฐาน:** `app/api/data/[table]/route.ts:48` ปิด SQL paging fast path เมื่อมี Slice; `:63–65` เรียก readRows เพื่อคำนวณทุกแถวก่อนกรอง; `lib/view-records.ts:8` อ่านทั้งหมดเมื่อไม่มี rawRows

**ทำซ้ำ:** สร้างตาราง name/status/amount/twice โดย twice เป็น virtual `[amount]*2`; เติมข้อมูลจำลองรวม 20,002 แถว; Slice `[status]="open"`; ขอหน้าแรก 25 แถว 3 รอบ เทียบตารางเดียวกันไม่ใส่ Slice

**Actual:** ตารางปกติ 6, 5, 4 ms; Slice 2404, 2301, 2395 ms รวม HTTP localhost

**Expected:** การกรองพื้นฐานบนคอลัมน์จริงควรใช้ SQL WHERE ก่อน pagination เพื่อหลีกเลี่ยงคำนวณทุกแถวต่อการเปิดหน้า

**Impact:** ตารางโตจะเปิด/ค้นหา/เปลี่ยนหน้าช้า และเพิ่ม CPU/memory ของ process ตัวเลขนี้เป็น fixture เฉพาะเครื่อง ไม่ใช่ SLA และห้ามคูณตรงเพื่อทำนาย 300,000 หรือ 1 ล้านแถว

**แนวแก้:** ใช้ expression → SQL สำหรับ subset ที่พิสูจน์ semantics ได้ พร้อม parameter binding; fallback สูตรทั่วไป; รักษา ACL และจำนวน total ให้ตรง; ค่อยพิจารณา index ตาม predicate จริง

**Regression:** เปรียบเทียบ SQL กับ evaluator สำหรับ null/boolean/date/ref/USEREMAIL และ AND/OR; virtual/cross-table ต้อง fallback; pagination/count/ACL ต้องเหมือนเดิม พร้อม performance test

## SLICE-002 — Confirmed scope mismatch / Design risk (P2)

**หลักฐาน:** `app/components/ExcelTransfer.tsx:23` ไม่ส่ง Slice; `app/api/excel/[table]/route.ts:18` ไม่รับ Slice; `lib/excel.ts:124` ไม่มี Slice parameter และ export ใช้แถวทั้งหมดที่ผ่านสิทธิ์ตาราง/แถว

**ทำซ้ำ:** ตารางมี open/closed อย่างละ 1 แถว; Slice open เลือก name/status; GET data ด้วย Slice ได้ 1 แถว; GET Excel ด้วย `?slice=audit_open` ได้ 2 แถว และ headers id/name/status/amount/twice

**Actual ที่ยืนยัน:** Excel ทำงานระดับตาราง แม้ส่ง Slice query ก็ถูกละเลย การส่งออกแบบกำหนดคอลัมน์ยังจำกัดคอลัมน์ตามที่ผู้ใช้เลือกได้ แต่ไม่ได้แก้ขอบเขตแถว

**Expected ที่เสนอ:** UI ต้องระบุขอบเขตชัดเจน หรือเพิ่มส่งออกตาม Slice และตัวกรองปัจจุบัน ไม่ควรให้ผู้ใช้เข้าใจว่าเป็นข้อมูลชุดเดียวกับหน้าจอโดยไม่มีคำอธิบาย

**Impact:** ได้ข้อมูลนอกชุดที่เห็นและอาจเกินขีดจำกัด 10,000 แถวของ export แม้ Slice เล็ก ไม่ได้ยืนยันว่าเป็น permission bypass เพราะ export ยังใช้ ACL ของตารางและแถว

**แนวแก้:** ส่ง View/Slice scope ให้ backend resolve ใหม่ ตรวจตารางและสิทธิ์ กรองก่อนจำกัดจำนวน พร้อมตัวเลือกขอบเขตที่ชัดเจน

**Regression:** open/closed, hidden columns, row ACL, reference labels, selected columns, >10,000 table rows แต่ Slice เล็ก, invalid Slice/table combination

## ลำดับเสนอ

1. แก้ SLICE-001 โดยเริ่มสูตรกรองคอลัมน์จริงที่พบบ่อย พร้อม parity tests
2. ตัดสินใจและทำขอบเขต Excel SLICE-002 ให้ชัดเจน
3. ปรับและรัน browser suite ให้ครบก่อนยืนยัน E2E
4. ค่อยเพิ่ม Inline Slice หากมี use case ที่ต้องกรองลูกเพิ่มเติม และตรวจ count/summary/pagination/draft children พร้อมกัน

ไม่ได้แก้ปัญหาใน source ระหว่าง Audit นี้
