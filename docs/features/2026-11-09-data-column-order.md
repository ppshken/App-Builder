# ลำดับคอลัมน์ใน Data

- Data แสดงคอลัมน์จริงก่อนคอลัมน์คำนวณเสมอ รวมตารางเดิมที่เคยมีคอลัมน์สลับกัน โดยรักษาลำดับภายในแต่ละกลุ่ม
- เมื่อเพิ่มคอลัมน์จริง ใช้ตำแหน่งต่อจากคอลัมน์จริงล่าสุด แล้วขยับคอลัมน์คำนวณลงด้านล่างใน transaction เดิม
- เมื่อเพิ่มคอลัมน์คำนวณ ต่อท้ายตามเดิมโดยไม่เปลี่ยนตำแหน่งคอลัมน์จริง เพื่อไม่ให้ shared-table snapshots เปลี่ยนเพราะเพิ่มเฉพาะ virtual
- ไม่แก้ physical storage order ของ SQLite และไม่แก้ลำดับ columns ที่ผู้ใช้กำหนดเองใน View

ไฟล์หลัก: `lib/data-column-order.ts`, Data column editor page และ add_column ของ Tables API

ทดสอบ: unit stable partition / ไม่แก้ input; browser ทดสอบตารางเก่าที่มีคอลัมน์สลับกัน เพิ่มคอลัมน์จริงผ่าน UI ตำแหน่งที่บันทึก โหลดหน้าใหม่ เพิ่ม virtual และ real ซ้ำ ค้นหาคอลัมน์ ตรวจ custom View order และข้อมูล/สูตรเดิม

Logs: `.test-data/data-column-order-types.log`, `data-column-order-unit.log`, `data-column-order-browser.log`, `data-column-order-build.log`, `data-column-order-production.log`

ใช้ฐานข้อมูลทดสอบแยก ไม่ได้แก้ production database หรือ Deploy
