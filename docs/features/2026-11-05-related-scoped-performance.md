> อัปเดต 14 พฤศจิกายน 2026: ปลดเพดาน 10,000 แถวสำหรับ Related และ SELECT ที่ผูก Ref กับแถวแม่ รวมถึง snapshot และ SUM/ORDERBY ของรายการลูกแล้ว ยังคงขอได้ครั้งละไม่เกิน 500 แถวแม่ ตรวจสิทธิ์ตามเดิม และมีงบการคำนวณสูตรเพื่อป้องกันสูตรหนักเกินไป อัปเดตเพิ่มเติม: ปลดเพดานอ่านทั้งตารางสำหรับสูตร SELECT และรายการ List ที่คำนวณด้วย เพื่อรองรับ Automation ที่นับลูกจาก Ref เดียวกัน รายละเอียดเพดานด้านล่างเป็นพฤติกรรมก่อนการอัปเดตนี้

# Related performance — ระยะ 1

## เปลี่ยนอะไร

Related บน server ส่งตารางแม่, ID แถวแม่ และชื่อ Ref (ถ้าระบุ) ให้ตัวอ่านข้อมูล แทนการอ่านตารางลูกทั้งหมดก่อนกรอง ตัวอ่านใช้ metadata ของระบบเพื่อเลือก Ref จริง และ SQL แบบ bind parameters:

```sql
SELECT * FROM t_child
WHERE parent_ref IN (SELECT value FROM json_each(?))
ORDER BY id
LIMIT 10001;
```

ใช้ Index `_ref_<table>_<column>` ที่ระบบสร้างให้ Ref อยู่แล้ว งานนี้ไม่เพิ่ม migration หรือสร้าง index จากระหว่างการอ่านสูตร

รองรับ Related projection, COUNT, SUM, INDEX และ ORDERBY ที่มี Related เป็นรายการต้นทาง คงการ normalize ค่า, ลำดับ ID, การแยก Ref หลายช่อง, การตรวจสูตรวนกัน และการตรวจสิทธิ์ตาราง/แถวเดิม ไม่มีการแปลงสูตร arbitrary เป็น SQL

ตัวอย่างที่ได้รับประโยชน์:

```text
COUNT([Related_list_inspection])
SUM([Related_list_inspection][groups_score])
ORDERBY([Related_list_inspection], [groups_score], TRUE)
```

## Browser snapshots และฟอร์ม

- GET `/api/expression-data` รับ `related_parent_ids` เป็น JSON array ของ ID ไม่เกิน 500 รายการ ใช้ร่วมกับ `table` เท่านั้น
- Server อ่าน parent จากฐานข้อมูลและกรองสิทธิ์ก่อนใช้ ID; ไม่เชื่อ row data จาก browser
- Table ขอ snapshot เฉพาะแถวในหน้าปัจจุบัน; detail/edit form ขอแถวที่เปิด; new form ใช้ scope ว่างเพื่อไม่ให้ดึง orphan children
- Snapshot ระบุ `related_scope` เพื่อให้ evaluator ปฏิเสธการใช้ข้อมูลบางส่วนแทนทั้งตาราง หรือใช้กับ parent ที่ไม่ได้โหลด ห้ามคืนผลรวมบางส่วนแบบเงียบ ๆ
- หากสูตรเดียวกันต้องอ่านทั้งตารางด้วย SELECT/การ dereference จะใช้ข้อมูลเต็มตามสัญญาเดิม ไม่แอบเปลี่ยนให้เป็น subset
- เก็บ snapshot ของหน้ารายการแยกเพื่อคืนเมื่อยกเลิก form/detail
- Scoped cache อยู่ใน context ของ request เท่านั้น จำกัด 256 projections ไม่แชร์ข้อมูลข้ามผู้ใช้

พบ regression ในชุดทดสอบ pending children ตอนรัน production build: หลังเพิ่ม parent จากอีกช่องทาง ฟอร์มอ่าน Ref choices จาก runtime cache 15 วินาที ทำให้ไม่เห็น parent ใหม่ จึงเปลี่ยนเฉพาะ `loadFormRefs` ให้ fetch ใหม่ตอนเปิดฟอร์ม ไม่เปลี่ยน global cache policy หรือ validation สูตรเดิม หลักฐานก่อนแก้ `.test-data/related-scoped-pendingchildren.log`; หลังแก้ `.test-data/related-scoped-pendingchildren-recheck.log`

## ข้อจำกัดที่ยังคงมี

- ตารางลูกรวมเกิน 10,000 แถวได้ แต่ผลอ่านใน Related scope หนึ่งยังต้องไม่เกิน 10,000 แถว **ก่อน**กรองสิทธิ์ ห้ามตัดยอดรวมให้เงียบ ๆ
- Snapshot ของหน้าแสดงผลรวมลูกของ parent ที่ขอไม่เกิน 10,000 แถว; ขอได้ไม่เกิน 500 parents ต่อครั้ง
- `SELECT(ตาราง[คอลัมน์], ...)`, Ref dereference และ preview ที่ไม่ระบุ parent scope ยังมีเพดานทั้งตารางเดิม
- `SELECT([Related_...][column], condition)` ยังไม่รองรับในระยะนี้
- Related ภายในเงื่อนไข SELECT ที่ browser ต้อง preload หลาย candidate owners ยัง fallback ไปสัญญา snapshot เดิม ไม่อ้างว่า optimized ทุกสูตรซ้อน
- SUM/COUNT ยังใช้ evaluator เดิมกับแถวลูกที่กรองมาแล้ว ยังไม่ใช่ SQL aggregation
- สูตรบน virtual fields ที่ไปอ่านตารางอื่นยังอยู่ภายใต้ข้อจำกัดของการอ่านข้ามตารางนั้น
- ไม่มีการยกเพดานเป็นหนึ่งล้านหรือยกเลิก row permissions

## หลักฐานทดสอบ

ผลสุดท้าย: Production Build รวม TypeScript **ผ่าน**; Unit 515 ข้อ **ผ่าน 508 / ข้ามตามแพลตฟอร์ม 7 / ล้มเหลว 0**; API/Browser integration บน production build **ผ่าน 16/16 ชุด** (`relatedscale`, `relatedexpression`, `pendingchildren`, `partof`, `formrelated`, `orderby`, `permissions`, `imageurls`, `workflows`, `api`, `tableactions`, `refcreate`, `returnstability`, `inlinemotion`, `deferredimages`, `sharedtables`).

HTTP อ่าน parent หนึ่งรายการพร้อม COUNT/SUM ใน fixture 300,000 children รอบสุดท้ายมี median ประมาณ **7.4 ms จาก 8 ครั้ง** บนเครื่องทดสอบนี้ โปรดดู samples ทั้งหมดใน JSON; ไม่ใช่เวลาที่รับประกันบน VPS

- Regression ก่อนแก้: `.test-data/related-scoped-before.log` — ทดสอบ Related กับ child table >10,000 แถว fail แม้ parent เป้าหมายมีลูกเพียงแถวเดียว
- Unit ล่าสุด: `.test-data/related-scoped-unit.log` รวม scoped reads/snapshots, permission filtering, empty/unknown parent, per-parent limit, legacy whole-table limit, mixed snapshot completeness, ORDERBY, cache bounds และ Ref disambiguation
- Production Build สุดท้าย: `.test-data/related-scoped-final-build.log`
- Integration suites บน build สุดท้าย: `.test-data/related-final-summary.json`; รายชุด `.test-data/related-final-<mode>.log`
- ข้อมูลสังเคราะห์: 300,000 children / 42,858 parents; parent เป้าหมายมี 7 children, COUNT=7 และ SUM=28; ผู้ใช้ถูกจำกัดให้เห็นคะแนน <=3 ได้ COUNT=3 และ SUM=6
- เปิด table/detail/edit form, แก้ชื่อและบันทึก, mobile viewport และ permission-bound snapshot ใน `tests/related-scale-browser.cjs`
- Query Plan จริง: `.test-data/related-scale-query-plan.json` ยืนยัน `SEARCH ... USING INDEX _ref_scale_lines_parent_id`
- Timing samples/median: `.test-data/related-scale-benchmark.json`; เป็น HTTP บนเครื่องทดสอบและ SQLite สังเคราะห์ รวม warm-up ไม่ใช่ SLA หรือการรับประกันเวลาบน production และไม่อ้าง speed-up ratio เพราะ implementation เดิมหยุดที่ limit

ไม่มีการแก้ฐานข้อมูลจริง, credentials, Docker volumes หรือ Deploy ทดสอบ physical iPhone, Linux container และ production load จริงไม่รวมอยู่ในผลนี้


## ระยะถัดไป — 6 พฤศจิกายน 2026

รองรับ SELECT Related และ parent-bound native SELECT แล้ว ดูรายละเอียด ขอบเขต และผลทดสอบล่าสุดใน [รายงานระยะ 2](2026-11-06-select-related-performance.md) ข้อจำกัดในรายงานนี้เป็นสถานะของระยะ 1
