# จำนวนตำแหน่งทศนิยม Decimal

Data → แก้ไขคอลัมน์ → Decimal → จำนวนตำแหน่งทศนิยม เลือกอัตโนมัติ (ค่าเดิม) หรือจำนวนเต็ม 0–10 ตำแหน่ง ใช้ได้ทั้งคอลัมน์จริงและคำนวณ ตัวเลือกเดียวกันอยู่ในหน้าตรวจการแปลงชนิดข้อมูลปลายทาง Decimal

เช่น 2 ตำแหน่ง: 12.5 → 12.50 และ 1.239 → 1.24 เฉพาะชื่อที่แสดง ค่าจริงและผลคำนวณยังเป็น 12.5 / 1.239 ไม่มีการปัดค่าเมื่อกรอกหรือบันทึก ฟอร์มคงรับตัวเลขเต็มความละเอียดเดิม

ใช้ formatter เดียวกันใน Runtime table/list/detail/group, computed output, Inline, filter/tab labels และ PDF ส่วน Excel คงเซลล์เป็นตัวเลขจริงและกำหนด numFmt เช่น 0.00 ไม่แปลงเป็นข้อความหรือปัดค่าจริง

ใช้ options metadata เดิม `{ "decimal_places": 2 }` เฉพาะ Decimal; server ตรวจชนิดและช่วง ห้ามชื่อ field ที่ไม่รองรับ ไม่มี migration หรือ dependencies ใหม่ การเปลี่ยนชนิดใน editor ล้าง options เมื่อเข้า/ออกชนิด Decimal/YesNo เพื่อไม่ปะปนกับ Enum

การตั้งค่าของ physical shared-table column มาจากตารางต้นทางตามนโยบายเดิม Recipient ไม่ได้เพิ่ม override รูปแบบใหม่ ส่วน virtual columns เฉพาะแอปตั้งได้เอง

## หลักฐาน

- `.test-data/decimal-format-unit.log`: 527 tests, 520 pass, 7 skipped, 0 failed รวม display precision/blank/zero/negative/auto และ metadata validation โดย normalizeValue ไม่ปัดข้อมูล
- `.test-data/decimal-format-build.log`: Production build ผ่าน
- `.test-data/decimal-production-decimalformat.log`: Production API/browser ตรวจตั้งค่าจาก ColumnEditor, computed decimal, table/detail, mobile form save, ค่าจริงคงเดิม, Excel value/format, auto/0, invalid options และ conversion preview
- `.test-data/decimal-production-booleanlabels.log`: Regression ของ Boolean options metadata

ทดสอบฐานข้อมูลจำลองและ viewport มือถือ ไม่ได้ทดสอบ iPhone จริง ไม่เปลี่ยนฐานข้อมูลจริงหรือ Deploy
