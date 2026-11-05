# Bulk Delete — 2026-11-05

## ใช้งาน
สร้าง Action ชนิดลบแถวของตารางเดิม แล้วเลือกใน View > รูปแบบหน้าจอ > Bulk Actions > Actions ที่อนุญาต บันทึก View ก่อนใช้ เลือกแถวได้ตามสิทธิ์แก้ไขหรือลบ และเลือก Action ลบใน Toolbar

## ขอบเขต
- ใช้ executeAction และ deleteRecord เดิม ไม่สร้างกลไกลบใหม่
- ตรวจสิทธิ์ลบรายแถวและรายการลูกตาม Ref, Slice, Condition, Row Version อีกครั้ง
- บังคับยืนยัน พร้อมข้อความเตือนลบถาวร/รายการลูก และข้อความยืนยันของ Action
- ไม่เปิด Composite, Create, Navigation หรือ External Actions เป็น Bulk โดยตรง
- คง Automation ของการลบตามกลไกเดิม Queue และ Audit อยู่ใน Transaction ของแต่ละแถว
- Partial success: แถวที่ลบไม่ได้ยังอยู่และคงเลือกไว้สำหรับตรวจ/ลองใหม่ ต้องเลือกใหม่เมื่อ Version เปลี่ยน
- Idempotency เดิมป้องกันคำขอเดียวกันลบซ้ำ; metadata ของ cascade และ delete hooks รวมใน signature ตรวจการเปลี่ยนแปลงระหว่างชุด
- สูงสุด 100 แถวแม่ต่อคำขอ จำนวนลูกขึ้นกับ Ref เดิม; cascade graph สูงสุด 100 ตารางและข้อจำกัดความลึกเดิม 16 ชั้น
- ไม่ใช่ถังขยะหรือ Undo; ไฟล์ที่เคยอ้างอิงไม่ถูกลบออกจากคลังโดย Bulk Delete

## หลักฐาน
- .test-data/bulk-delete-unit.log: 490 passed, 0 failed, 7 platform skips
- .test-data/bulk-delete-focused.log: 22 passed, รวมการเก็บ delete workflow events และไม่สร้างซ้ำเมื่อ replay
- .test-data/bulk-delete-browser.log: HTTP + Browser passed บนฐานข้อมูล integration แยก รวมยกเลิกก่อนลบ, ลบ 2 แถว, double click, replay, refresh, audit และ regression ของ Bulk Update เดิม
- TypeScript --noEmit ผ่าน
- ไม่เปลี่ยน Production หรือ Deploy; ไม่ส่ง Webhook จริงในการทดสอบ
