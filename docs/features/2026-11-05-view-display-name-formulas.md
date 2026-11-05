# View Display Name สูตร

View > การตั้งค่า View > การแสดงผล > ชื่อที่แสดง (Display Name) > สูตร

มี FormulaEditor, ตัวช่วยสูตร และทดสอบผลก่อนบันทึก ข้อความเดิมยังเลือกใช้ได้ สลับโหมดโดยเก็บทั้งข้อความและสูตรไว้ ชื่อภายในและ URL ไม่เปลี่ยน

ตัวอย่าง:
- CONCATENATE("งานของฉัน (", COUNT(tasks[id]), ")")
- CONCATENATE("สวัสดี ", USERNAME())
- IF(USERROLEKEY() = "admin", "จัดการงาน", "รายการงาน")

View ไม่มีแถวปัจจุบัน ไม่รองรับ [คอลัมน์] ตรง ๆ; SELECT มี candidate row ของตนเองได้ ใช้สิทธิ์ผู้ใช้และแอปเดียวกับ expressionContext เดิม จำกัด snapshot สูตรเดิม 10,000 แถว ไม่ใช้ SQL อิสระ

Metadata อยู่ใน display_json: display_name_mode=text|formula, display_name_expr และ display_name เป็นข้อความ/ชื่อสำรอง ไม่มี schema migration

ผลลัพธ์ข้อความหรือตัวเลขไม่เกิน 100 ตัวอักษร ถ้าว่างใช้ display_name หรือ label เดิม ถ้าสูตรผิด/ไม่มีสิทธิ์/เกินขนาด ใช้ชื่อสำรองพร้อมส่งข้อผิดพลาดใน runtime views API เมนู/หัวหน้า/Related ใช้ผลที่ server คำนวณ ไม่ประเมินด้วยสิทธิ์อื่นใน client

ชื่อคำนวณเมื่อโหลดหรือ refresh metadata ตามวงจรเดิม ไม่ใช่นาฬิกาอัปเดตทุกวินาที รองรับ Preview ก่อนบันทึก การตรวจชื่อคอลัมน์ การเปลี่ยนชื่อคอลัมน์ และการตรวจ dependency ก่อนลบ การ Clone/Restore ใช้ remap สูตรเดิมของแอป

ทดสอบฐานข้อมูลแยก: .test-data/view-title-unit.log — 499 passed / 0 failed / 7 platform skips; .test-data/view-title-browser.log — สูตร/ตัวช่วย/ทดสอบ/บันทึก/หัวหน้า/เมนู/จำนวน/ชื่อสำรองผ่าน; .test-data/view-title-regression.log — ข้อความเดิม ชื่อซ้ำ ชื่อในระบบ และ Preview ผ่าน; TypeScript ผ่าน ไม่แก้ Production หรือ Deploy
