> อัปเดต 14 พฤศจิกายน 2026: ปลดเพดาน 10,000 แถวสำหรับ Related และ SELECT ที่ผูก Ref กับแถวแม่ รวมถึง snapshot และ SUM/ORDERBY ของรายการลูกแล้ว ยังคงขอได้ครั้งละไม่เกิน 500 แถวแม่ ตรวจสิทธิ์ตามเดิม และมีงบการคำนวณสูตรเพื่อป้องกันสูตรหนักเกินไป อัปเดตเพิ่มเติม: ปลดเพดานอ่านทั้งตารางสำหรับสูตร SELECT และรายการ List ที่คำนวณด้วย เพื่อรองรับ Automation ที่นับลูกจาก Ref เดียวกัน รายละเอียดเพดานด้านล่างเป็นพฤติกรรมก่อนการอัปเดตนี้

# SELECT Related และการอ่านลูกเฉพาะแถวแม่ — 6 พฤศจิกายน 2026

## ผลลัพธ์

รองรับสูตรเดิมของผู้ใช้โดยไม่ใส่ comma หลังเงื่อนไขสุดท้าย:

```text
SUM(
  SELECT(
    [Related_list_inspection][groups_score],
    [inspection_categories_id] = 1
  )
)
```

เงื่อนไข SELECT อ่านคอลัมน์ของตารางลูก ส่วน `[_THISROW].[column]` อ่านแถวแม่ รองรับ distinct และการนำผลไปใช้กับ ORDERBY ตามชนิดข้อมูลเดิม เพิ่มตัวอย่างในคู่มือสูตรและ autocomplete คอลัมน์ลูกในเงื่อนไข

## ขอบเขตการปรับประสิทธิภาพ

- Related projection และ SELECT Related อ่านลูกผ่าน Ref ของแถวแม่ โดยใช้ดัชนี Ref ที่ระบบมีอยู่แล้ว
- Native SELECT เช่น `SELECT(child[score], AND([parent_id] = [_THISROW].[id], [category] = 1))` สามารถจำกัดการอ่านตาม Ref ได้เมื่อ equality อยู่เป็นเงื่อนไขแรกและ Ref เป็นคอลัมน์จริงที่อ้างอิงตารางแม่จริง
- จำกัดเฉพาะ root SELECT ที่พิสูจน์ owner ได้ การใช้ OR, NOT, คอลัมน์ที่ไม่ใช่ Ref, nested row scope หรือ equality ที่ไม่ได้อยู่ต้นเงื่อนไข ยังคงใช้เส้นทางเดิม เพื่อรักษา short-circuit และข้อผิดพลาดเดิม
- SQL ใช้เพียงตัวกรอง Ref แบบ parameterized เงื่อนไขที่เหลือยังประเมินด้วย evaluator เดิม ไม่ใช่การแปลงสูตรทั่วไปหรือ SUM/COUNT เป็น SQL
- ตรวจสิทธิ์ตารางและระดับแถวก่อนคำนวณ ไม่ส่งข้อมูลที่ไม่มีสิทธิ์ให้ browser
- Snapshot ระบุ owner, parent IDs และ Ref ที่ครอบคลุม เพื่อไม่ใช้ข้อมูลบางส่วนแทนทั้งตาราง หรือใช้ผิด Ref
- Related ของแถวใหม่ไม่มีลูก แต่ native SELECT ที่เทียบกับ ID ว่างรักษาพฤติกรรมเดิมของ null/blank Ref ไม่เปลี่ยนเป็นศูนย์โดยอัตโนมัติ
- เพดานยังเป็น 10,000 raw child rows ต่อ scoped read; snapshot รับไม่เกิน 500 parent IDs และไม่เกิน 10,000 child rows ไม่เพิ่มเพดานอ่านทั้งตาราง
- Cache เฉพาะ request จำกัด 256 entries และ 20,000 retained visible rows ไม่มี cache ข้ามผู้ใช้

## ตัวช่วยทดสอบสูตร

ตัวช่วยสูตรเพิ่ม ID แถวแม่สำหรับทดสอบเมื่อมี table context: กรอก ID เพื่ออ่านลูกเฉพาะแถวนั้น หรือปล่อยว่างเพื่อจำลองแถวใหม่ API ตรวจ ID และสิทธิ์แถวแม่จากฐานข้อมูล ไม่ใช้ sample row จาก browser เป็นหลักฐานสิทธิ์ ID ไม่ถูกต้องได้ 400; แถวที่ไม่มีหรือไม่มีสิทธิ์ได้ 403 แบบไม่เปิดเผยรายละเอียด

## ไฟล์และจุดเชื่อมต่อ

- `lib/expression.ts`: parser, child scope, SELECT evaluator, safe parent prefilter, ORDERBY composition
- `lib/expression-context.ts`: scoped SQL, Ref validation, permission filtering, snapshot completeness, bounded cache
- `app/api/expression-data/route.ts`: scoped preview และ validation
- `app/components/ExpressionAssistant.tsx`: sample parent ID และ preview context
- `lib/formula-completion.ts`, `lib/formula-guide.ts`: completion และตัวอย่าง
- `tests/related-expression.test.cjs`, `tests/select-related-scale-browser.cjs`: regressions และ isolated scale/browser checks
- งาน RuntimeTable และ `tests/related-scale-browser.cjs` เป็นส่วนต่อเนื่องจากระยะ 1

## หลักฐานทดสอบ

- ก่อนแก้: `.test-data/select-related-before.log` มี regression ที่ fail สำหรับ Related SELECT และการอ่านตารางใหญ่
- Unit รอบสุดท้าย: `.test-data/select-final-unit.log` รวม 524 ข้อ ผ่าน 517 ข้ามตามแพลตฟอร์ม 7 ล้มเหลว 0
- Production build รวม TypeScript: `.test-data/select-final-build.log` ผ่าน
- Production integration/browser: 19 ชุด ผ่าน 18 ไม่ผ่าน 1 (`formulaeditor` ตามรายละเอียดด้านล่าง) หลักฐาน `.test-data/select-final-summary.json` และ `.test-data/select-final-<mode>.log`
- Scale fixture มี 300,000 children / 42,858 parents; parent เป้าหมายมี 7 ลูก ผลรวม 28 และ filtered category ผลรวม 16; การแก้ค่าแม่เปลี่ยนผลกรองทันทีเป็น 12
- Row permissions จำกัดคะแนน <=3 ให้ผลรวม 6 และ filtered total 4; preview ไม่คืนลูกของแม่ที่ไม่มีสิทธิ์
- Browser ตรวจ table/detail/form/save, mobile viewport, completion, preview ด้วย sample ID และ metadata persistence
- Query plan: `.test-data/select-related-scale-query-plan.json`; timing: `.test-data/select-related-scale-benchmark.json` เป็นผลเครื่องทดสอบและฐานข้อมูลจำลอง ไม่ใช่ production SLA หรือ speed-up ratio

## ข้อที่ยังไม่ผ่าน / ข้อจำกัด

ชุด `formulaeditor` ไม่ผ่าน assertion `height < 150` ที่ `tests/formula-editor-browser.cjs:17` ช่องสูตร 7 บรรทัดสูง 152px และตัว editor สูงเท่ากัน 152px ตาม `.test-data/select-related-editor-metrics.json` จึงยังไม่ยืนยันว่าเป็น gutter ขยายความสูงตามข้อความ assertion ตัว FormulaEditor และ CSS ไม่ได้แก้ในงานนี้; HEAD เดิมตั้ง textarea rows ตามจำนวนบรรทัด ต้องตรวจความคาดหวัง UX และแก้เป็นงานแยก ไม่เปลี่ยน expected เพื่อทำให้ผ่าน

ยังไม่ทดสอบ physical iPhone, Linux container และ production load จริง ไม่มี migration, dependencies ใหม่, การแก้ข้อมูลจริง, credentials, Docker volumes หรือ Deploy
