# ตัวช่วยสูตรเงื่อนไขตกแต่งข้อมูล

เพิ่มปุ่ม “ตัวช่วยเขียนสูตรเงื่อนไข” ในแต่ละกฎ ใช้ ExpressionAssistant และ FormulaEditor เดิม พร้อมส่งคอลัมน์จริงของตารางให้ autocomplete ทั้งในช่องหลักและ modal

## การใช้

```text
AND([_THIS] = "done", IF([amount] >= 100, TRUE, FALSE))
```

`[_THIS]` คือค่าของคอลัมน์ที่กำลังตกแต่ง ส่วน `[amount]` คือคอลัมน์อื่นในแถวเดียวกัน รองรับฟังก์ชันของ evaluator เดิม เช่น AND, OR, IF, ISBLANK, TODAY, DATE และสูตรผู้ใช้/บทบาทตาม context ที่มีอยู่ ไม่เปลี่ยนลำดับกฎ (กฎแรกที่ตรงใช้รูปแบบนั้น) หรือข้อมูลจริง

ปุ่มยกเลิกไม่แก้สูตร กดใช้สูตรจึงส่งค่ากลับ draft และต้องกดบันทึกการตกแต่งเพื่อ persist ลองคำนวณใช้ข้อมูลตัวอย่างโดยไม่บันทึกลงตาราง

คอลัมน์และสูตรแถวเดียวกันรองรับเดิมอยู่แล้ว แต่ UI ไม่ส่ง schema ให้ autocomplete และไม่มีตัวช่วย ในงานนี้ไม่ปลดข้อจำกัดสูตรข้ามตาราง/Ref dereference: validator เดิมยังปฏิเสธ เพื่อไม่ให้ UI รับสูตรที่ Runtime ไม่มี dataset หรือสิทธิ์รองรับ ตัวเลือก localOnly ซ่อนชื่อ/ฟังก์ชันสำหรับดึงตารางอื่นจาก autocomplete โดยไม่เปลี่ยนพฤติกรรม editor ที่อื่น

แก้โครงสร้าง label ของช่องเงื่อนไขให้ใช้ htmlFor/id แทนการครอบ FormulaEditor ทั้งตัว เพื่อไม่ให้ label ครอบปุ่ม autocomplete และรบกวน accessible name

## ไฟล์

- `DecorationConditionEditor.tsx`: inline formula, modal และ validator กฎ
- `DataStylesEditor.tsx`: เชื่อม editor กับแต่ละกฎ
- `ExpressionAssistant.tsx`: optional validator/localOnly และรองรับ _THIS ใน context Valid_If
- `FormulaEditor.tsx`: optional localOnly; ค่าเริ่มต้นของที่อื่นคงเดิม
- `tests/decoration-condition-browser.cjs`: isolated browser regression

## ผลตรวจ

- Production build ผ่าน: `.test-data/decoration-condition-build.log`
- Unit 526 tests: 519 pass, 7 skipped, 0 failed: `.test-data/decoration-condition-unit.log`
- Production browser ผ่าน: completion, cancel/apply, sample TRUE/FALSE, invalid column/cross-table rejection, save/reload, runtime style และ mobile modal: `.test-data/decoration-condition-production.log`
- Regression SELECT Related / formula assistant: `.test-data/decoration-regression-selectrelated.log`
- Regression permissions: `.test-data/decoration-regression-permissions.log`

ไม่เปลี่ยนฐานข้อมูลจริง ไม่ติดตั้ง dependency และไม่ Deploy; mobile ใช้ viewport จำลอง ไม่ใช่ iPhone จริง
