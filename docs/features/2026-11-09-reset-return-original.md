# Reset on edit เมื่อเลือกกลับค่าเดิม

## ปัญหาที่ยืนยัน

RuntimeTable เรียก applyEditResets โดยเทียบกับ initialForm เสมอ กรณีเปิดฟอร์มด้วยตัวเลือก A → เลือก B → เลือก A จึงไม่ถือว่าเป็นการเปลี่ยนค่าในครั้งสุดท้าย ทำให้ค่าจาก B ค้างอยู่

Reproduction ใน `tests/reset-on-edit-browser.cjs`: เปิดด้วย product 2 → เลือก 1 → เลือก 2 คาด price=40 แต่ก่อนแก้ได้ 20 (`.test-data/reset-return-before.log`)

## แก้ไข

เพิ่ม `applyFormEditResets` ใน columns.ts ใช้ executor เดิมตรวจการเปลี่ยนจากค่าฟอร์มครั้งก่อน จากนั้นใช้ opening snapshot ตามกฎเดิมของการบันทึก เพื่อเก็บพฤติกรรมการคำนวณที่ server บังคับไว้

ใช้ helper ในการเปลี่ยนช่องฟอร์มและหลังสร้างข้อมูล Ref ใหม่ ใช้ RuntimeTable ร่วมกันกับฟอร์มหลักและฟอร์มซ้อน ไม่เปลี่ยน applyEditResets เดิม, API, Action executor, schema หรือสิทธิ์ readonly

## หลักฐานทดสอบ

- Browser: เลือกกลับแล้ว price=40, total=120 และตรวจฐานข้อมูลหลังบันทึกว่าเป็นค่าที่คาด
- Existing suite ยังผ่าน: normalized no-op, validation rollback, readonly protection, chained reset, mobile viewport, การตั้งค่า reset, rename/drop dependency, existing Action update
- Unit: เพิ่มกรณีเปลี่ยนค่ากลับต้นฉบับ คำนวณแบบลูกโซ่ ชนิดค่าที่เท่ากันหลัง normalize ไม่ reset และคง snapshot semantics ของ manual value
- Full unit: 538 ข้อ ผ่าน 531 ข้าม 7 ไม่ผ่าน 0 (`.test-data/reset-return-unit.log`)
- Browser dev log: `.test-data/reset-return-after.log`
- Production build: `.test-data/reset-return-build.log`
- Production regression: `.test-data/reset-return-production.log`

ใช้ข้อมูลจำลอง/ฐานข้อมูลแยก ไม่ได้แก้ข้อมูล production หรือ Deploy และไม่ใช่การทดสอบ iPhone จริง
