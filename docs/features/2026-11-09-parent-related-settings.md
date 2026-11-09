# ตั้งค่ารายการลูกจากตารางแม่

- Data → ตารางแม่ → คอลัมน์และการตั้งค่า → รายการที่เกี่ยวข้อง → ตั้งค่ารายการลูก
- ย้าย Is a part of และสูตร Valid_If / Show_If / Add_If จาก ColumnEditor ของ Ref มาไว้ที่นี่
- ตัวช่วยสูตรและ autocomplete ใช้คอลัมน์ตารางแม่ และ Valid_If ใช้ [_THIS] เป็นรายการลูกเช่นเดิม
- เอา dropdown “การกรอกข้อมูล” ออก จำนวนรายการต่อหน้ายังคงอยู่
- ฝั่ง Ref แสดงลิงก์ไปการตั้งค่าตารางแม่ และยังตั้ง “ลบลูกตามแม่” แยกได้

ใช้ metadata ของ Ref และ PATCH edit_column เดิม ไม่เพิ่ม Action/validation engine ไม่เปลี่ยนธุรกรรมแม่–ลูกหรือสิทธิ์ของ API

## ค่าตั้งบังคับแบบเดิม

เมื่อเปิดการตั้งค่า จะรวมเงื่อนไขอย่างน้อย 1 รายการไว้ในร่าง Valid_If โดยไม่แก้ฐานข้อมูล และไม่เปิด Is a part of อัตโนมัติ หากมี Valid_If ที่ทำงานอยู่แล้วจะรวมด้วย AND เพื่อเก็บเงื่อนไขทั้งสองไว้

หน้าต่างแจ้งชัดเจนว่าเปิด Is a part of เพื่อใช้เงื่อนไขที่ย้ายมา หรือบันทึกขณะปิดเพื่อยกเลิกการบังคับเดิม เมื่อกดบันทึกจึงล้าง related_required ที่ซ้ำกันและบันทึกค่าร่าง ผู้ใช้กดยกเลิกได้โดยค่าเดิมไม่เปลี่ยน การเปิด Is a part of ยังคงมีผลลบลูกตามแม่ตาม semantics เดิม จึงไม่เปิดให้โดยอัตโนมัติ

## Validation

- TypeScript ผ่าน
- Unit 537 ข้อ: ผ่าน 530, ข้าม 7, ล้มเหลว 0 (`.test-data/related-parent-unit.log`)
- `partof` browser ผ่าน: ตั้งค่าที่แม่, สูตรอ้างคอลัมน์แม่, ตัวช่วยสูตร, จำนวนลูก, บันทึก/rollback, ป้องกัน API โดยตรง, ฟอร์มซ้อนบน mobile viewport, cascade (`.test-data/related-parent-partof.log`)
- `relatedrequired` browser ผ่าน: ยกเลิกแล้วคง legacy rule, บันทึกรวม rule, empty API/form ถูกปฏิเสธ, บันทึกลูกพร้อมแม่, ห้ามลบลูกสุดท้ายเมื่อไม่ผ่าน Valid_If, ปิดเงื่อนไขแล้วบันทึกแม่ว่างได้, mobile viewport (`.test-data/related-parent-required.log`)
- Production build: `.test-data/related-parent-build.log`
- ทดสอบ `relatedrequired` ซ้ำบน production build ผ่าน (`.test-data/related-parent-required-production.log`)

ไม่แก้ฐานข้อมูล production หรือ Deploy; ไม่ได้ทดสอบ iPhone จริง และไม่ได้ยืนยันทุกกรณีของการตั้งค่า Ref ข้ามแอปผ่าน shared tables สิทธิ์เดิมของ backend ยังคงใช้ตามปกติ
