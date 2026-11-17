# แก้สูตร Related ใน Action บันทึกลงคอลัมน์จริง

วันที่: 17 พฤศจิกายน 2026

## สาเหตุที่ยืนยันได้

executeAction สร้างบริบทสูตรโดยไม่ระบุ tableName ของ Action ต่างจาก calculateRow ที่เติมชื่อตารางจากข้อมูลคอลัมน์เอง ทำให้ Related เลือก Ref จากรายการลูกโดยไม่กรองตารางแม่ โดยเฉพาะตารางลูกที่มี Ref ไปหลายตาราง ระบบจะเลือกความสัมพันธ์ไม่ได้ ตัวช่วยสูตรใน RuleManager ยังไม่ได้ส่ง tables ให้ ExpressionAssistant จึงไม่มีรายการ Related ให้เลือก

## การแก้ไข

- lib/automation.ts: ระบุ tableName ของตาราง Action ในบริบทสูตรร่วม โดยใช้ตัวประมวลผลและการตรวจสิทธิ์เดิม
- app/components/RuleManager.tsx: ส่งข้อมูลตารางให้ตัวช่วยสูตรเพื่อแสดง Related
- tests/related-expression-browser.cjs: เพิ่มกรณี Ref หลายตาราง การบันทึก COUNT ทั้ง snapshot/sequential และสูตร IF/SUM/SELECT แบบคะแนนของผู้ใช้ เปรียบเทียบค่าคอลัมน์จริงกับคอลัมน์คำนวณ ตรวจแยกแถวแม่ กรณีไม่มีลูก และแท็บ Related ในตัวช่วยสูตร

## หลักฐาน

- ก่อนแก้: .test-data/action-related-red.log — Action คืน 400 เมื่อรายการลูกมี Ref ไปหลายตาราง ทั้งที่คอลัมน์คำนวณอ่านได้
- หลังแก้: .test-data/action-related-final.log — ผ่าน API และเบราว์เซอร์ รวมการตรวจสิทธิ์เดิมในชุด Related
- .test-data/action-related-unit.log — 644 ข้อ ผ่าน 637 ข้าม 7 ล้มเหลว 0
- .test-data/action-related-types.log — TypeScript ผ่าน
- ตรวจ Action เดิมเพิ่มเติมใน .test-data/action-related-order.log

## ข้อจำกัด

ทดสอบกับฐานข้อมูลจำลองแยก ไม่ได้เปลี่ยนฐานข้อมูลจริงหรือ Deploy และยังไม่ได้ทดสอบ Automation ที่ตั้งค่าจริงของผู้ใช้บน production คอลัมน์จริงจะเปลี่ยนเมื่อ Action ทำงาน ไม่ได้คำนวณใหม่อัตโนมัติทุกครั้งที่รายการลูกเปลี่ยน
