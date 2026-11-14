# Automation: SELECT และ List เกิน 10,000 แถว

สูตร SELECT(list_inspection[id], [inspection_id] = [_THISROW].[inspection_id]) เป็นการอ่านรายการที่มี Ref เดียวกัน ไม่ใช่ Related ที่ผูก id ของแถวแม่โดยตรง จึงยังติดเพดานอ่านทั้งตารางหลังปลดลิมิต Related

ปลด LIMIT 10001 และการปฏิเสธเกิน 10,000 แถวใน expression context/evaluator รวมถึง List normalization เพื่อให้คอลัมน์รายการและ COUNT ที่อ้างรายการนั้นคำนวณผ่าน Automation และ snapshot ได้ครบ ไม่ตัดผลลัพธ์เงียบ ๆ

ยังใช้ projection เฉพาะคอลัมน์ที่สูตรต้องการ ตรวจสิทธิ์ตารางและแถว ตรวจสูตรวนกัน และงบการคำนวณสูตรเดิม การแบ่งหน้ารายการและโควตางาน Automation ตามเวลาไม่ได้เปลี่ยน

Regression ใช้ SQLite แยกในหน่วยความจำ 12,005 แถว: รายการ inspection 7 มี 12,004 แถว ส่วน inspection 8 มี 1 แถว ตรวจ workflowRow, workflowMatches, snapshot และ row permissions ไม่เรียก Action จริงหรือแก้ฐานข้อมูล Production
