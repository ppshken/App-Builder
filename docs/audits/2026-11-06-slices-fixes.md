# Slices: ผลการแก้ไขตาม Audit

วันที่ 2026-11-06 อ้างอิง `2026-11-06-slices-audit.md` และการอนุมัติให้แก้ตามลำดับ

## SLICE-001 — Passed

**Root cause:** Data API ปิด SQL pagination เมื่อมี Slice แล้วอ่าน/คำนวณทั้งตารางก่อนกรองและแบ่งหน้า แม้สูตรเป็นเพียงการเทียบค่าคอลัมน์จริง

**แก้:** เพิ่ม `lib/slice-sql.ts` ใช้ AST จาก parser เดิม แปลงเฉพาะ predicate ที่รองรับเป็น SQL มี parameter binding สำหรับค่าจากสูตร/ผู้ใช้ และตรวจชื่อคอลัมน์จาก metadata ก่อนสร้าง SQL

- รองรับ equality/inequality, numeric comparisons, AND/OR/NOT, blank checks, yes/no, USEREMAIL และคอลัมน์จริงแบบ text/enum/numeric/ref/user
- รักษา empty/null, boolean 0/1, strict numeric/string equality และ tolerant normalization ของ enum/yesno/ref/rating/percent
- สูตรที่ใช้ virtual, date/datetime, dereference, SELECT และฟังก์ชันที่ไม่รองรับกลับไปใช้ interpreter เดิมทั้งสูตร ไม่ตัดแปลงเพียงบางเงื่อนไข
- Data API ใช้ SQL predicate ร่วมกับ filter/paging/count เดิม ยังตรวจสิทธิ์ระดับแถว และยังประเมิน Slice กับแถวที่คืนมา
- ไม่เปลี่ยน Action executor หรือ single-row semantics ไม่เพิ่ม index/migration

**หลักฐานก่อนแก้:** audit fixture 20,002 แถวใช้ 2301–2404 ms ต่อการเปิด Slice หน้าแรก (`.test-data/slices-audit-runtime.log`) ขณะที่ตารางปกติ 4–6 ms

**หลังแก้:** integration fixture 20,003 แถว มี virtual column เปิด Slice หน้าแรก 25 แถว ประมาณ 10–20 ms (`.test-data/slices-integration-final.log`; ให้ถือค่าจาก log เป็นหลัก) จำนวนแถวตรง 10,002 ข้อมูลจำลองต่างกันเล็กน้อยและเป็น localhost จึงใช้เป็นหลักฐานความเร็วใน fixture ไม่ใช่ SLA หรือการทดสอบ concurrent users

**Regression:** `tests/slice-sql.test.cjs` เทียบผล SQL กับ interpreter รวม blank/boolean/USEREMAIL/ค่าที่มี quote, fallback, enum normalization; `tests/slices-integration.cjs` ตรวจ paging, สูตร virtual fallback และ row ACL

## SLICE-002 — Passed

**Root cause:** Excel UI ส่งแค่ table, reference mode และ columns; API/exporter ไม่รับ Slice จึงอ่านทุกแถวที่ผ่าน ACL ของตาราง

**Reproduce ก่อนแก้:** regression export คาด open 2 แถวจากตาราง 3 แถว แต่ actual=3 (`.test-data/slices-export-before.log`) ส่วน audit เดิมคาด 1 ได้ 2

**แก้:**

- `ExcelTransfer` รับขอบเขต Slice/คำค้น/ตัวกรอง/Map scope จาก RuntimeTable และแสดงคำอธิบายว่ารวมทุกหน้าที่ตรงเงื่อนไข
- API ส่ง scope ให้ exporter resolve Slice กับตารางและสิทธิ์ใหม่ ไม่เชื่อแถวจาก frontend
- จำกัดค่าเริ่มต้นและรายการคอลัมน์ที่เลือกตาม Slice พร้อม internal id สำหรับนำกลับเข้าไฟล์เดิม
- ใช้ filter evaluator, reference labels และ map scope เดิมในการกรอง
- ตรวจเพดาน 10,000 แถวหลังกรอง Slice จึงส่งออก Slice เล็กจากตารางใหญ่ได้
- ยังตรวจ read/export/row ACL และคำนวณคอลัมน์ที่ส่งออกด้วย strict path เดิม เพื่อไม่กลบ formula errors เป็นค่าว่าง
- เรียก export โดยไม่ระบุ scope ยังคงส่งออกทั้งตารางตามสิทธิ์เหมือนเดิม Template/import ไม่เปลี่ยน

**Regression/E2E:**

1. Slice open ได้แถว/คอลัมน์ตรงกัน
2. คำค้น/filters จำกัดข้อมูลที่ส่งออก
3. ปฏิเสธ Slice ไม่มีอยู่ และการเลือกคอลัมน์นอก Slice
4. No-scope export ยังได้ทั้งตาราง
5. ตาราง >10,000 แต่ Slice=3 ส่งออกได้
6. Row ACL ตัดแถวในทั้ง SQL paging และ Excel และ export=false ยังคง 403
7. Browser เปิด View ตาราง → ค้นหา → เปิด Excel modal → ดาวน์โหลด → อ่าน XLSX จริง ตรวจเหลือ 1 แถวและ headers ถูกต้อง

หลักฐาน `.test-data/slices-integration-final.log`

## E2E และ Regression ที่เกี่ยวข้อง

- ปรับ `tests/automation-browser.cjs` ให้เลือกคอลัมน์ผ่าน ActionValueEditor ปัจจุบัน แทน checkbox ที่ถูกถอดไปแล้ว
- ตรวจการบันทึก Slice ลง View จากค่าที่ API บันทึกจริง แทนจับข้อความ status แบบเก่าที่ชน toast ใหม่
- เตรียมสถานะกลุ่ม Action ก่อนทดสอบปิด/เปิด เนื่องจากหน้าใหม่เปิดกลุ่มของ Action ที่เลือกให้อัตโนมัติ
- ไม่ลด expected behavior ของ Slice/Action และไม่แก้ production UI เพื่อให้ suite ผ่าน
- Existing automation browser ผ่าน: syntax errors, formula assistant, save guard, Slice in View, Action confirm/cancel, filtered refresh, mobile CRUD, dark theme และ preview stability
- Existing automation API 2/2 ผ่าน
- Existing permissions browser ผ่าน รวม CRUD, Ref/formulas/images, Action grants, direct API denial และ session revocation
- Full unit suite: 533 tests, passed 526, skipped 7, failed 0
- Production build ผ่าน

Logs: `.test-data/slices-unit-final.log`, `slices-build-final.log`, `slices-actions-final.log`, `slices-browser-final.log`, `slices-permissions-final.log`

## Files และจุดเชื่อมต่อ

เพิ่ม `lib/slice-sql.ts`, `tests/slice-sql.test.cjs`, `tests/slices-integration.cjs` และรายงานนี้

แก้ Data GET API, Excel GET API, `lib/excel.ts`, `RuntimeTable.tsx`, `ExcelTransfer.tsx`, test runners และ automation browser test ตามรายละเอียดข้างบน มีงานเดิมที่ยังไม่ commit ใน repository จึงไม่ควรใช้ working-tree diff ทั้งหมดเป็น diff ของงานนี้

## Remaining risks / ขอบเขต

- สูตรซับซ้อนและคำค้นที่ต้องอ่าน virtual/ref labels ยังใช้ fallback จึงยังอาจช้าบนตารางใหญ่
- SQL translation ไม่ครอบคลุมสูตรทุกชนิด และยังไม่ได้วัด RAM/concurrent users/1 ล้านแถว
- Excel export แบบสูตรซับซ้อนยังอาจอ่านและคำนวณหลายแถวก่อนรู้จำนวนผลลัพธ์ ไม่ใช่ streaming export
- การจัดกลุ่ม/เจาะกลุ่มใน UI ไม่ใช่ตัวกรองใหม่ที่ export ตีความเอง; scope ที่ส่งคือ Slice, search, filters และ Map scope ไม่รวมลำดับ sort ของหน้าจอ
- Inline ยังคงใช้ Ref และไม่อนุญาต Slice ตามข้อจำกัดเดิม แผน Audit ระบุให้เพิ่มเมื่อมี use case จึงยังไม่ได้เปิดใช้โดยอัตโนมัติ
- ไม่ได้ทดสอบ iPhone จริง หรือข้อมูล production ไม่ได้ Deploy ไม่เปลี่ยน credentials/production database/volumes
