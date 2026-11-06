# ชื่อแสดงผล True/False

ตั้งค่าที่ Data → แก้ไขคอลัมน์ → ชนิด ใช่/ไม่ใช่ → ชื่อแสดงผล True และ False เช่น ผ่าน/ไม่ผ่าน เว้นว่างใช้ ใช่/ไม่ใช่ ตามเดิม จำกัดชื่อด้านละ 100 ตัวอักษร

ใช้กับ form checkbox (แสดงชื่อของสถานะปัจจุบัน), ตาราง/รายการ/รายละเอียด, Inline, ตัวกรองและแท็บที่ใช้ filter options, ตัวช่วยทดสอบสูตร และ PDF โดย escape ข้อความก่อนสร้าง PDF

ใช้ options metadata เดิมเก็บ JSON `{ "true": "ผ่าน", "false": "ไม่ผ่าน" }` เฉพาะชนิด yesno ผ่าน normalization ฝั่ง server ไม่เพิ่มคอลัมน์ฐานข้อมูล ค่าจริงยังเป็น 1/0 สูตรและเงื่อนไขไม่เปลี่ยน ค่าว่างในรายละเอียดไม่กลายเป็น False ชื่อไม่ใช่สูตรหรือ HTML

Excel แบบรหัสยังคงส่งค่าจริง ไม่เปลี่ยนรูปแบบไฟล์นำเข้าหรือความหมายข้อมูล User settings yesno เป็นระบบแยก ไม่ได้เพิ่มการตั้งค่าชื่อในงานนี้

## Verification

- `.test-data/boolean-label-unit.log`: 525 tests, ผ่าน 518, skipped 7, failed 0 รวม validation ชื่อ, fallback, false/blank, normalize metadata และค่าจริง
- `.test-data/boolean-label-browser.log`: isolated API/browser ผ่าน desktop/mobile form, detail, เปิด ColumnEditor ตั้งชื่อและบันทึกจริง, reload แสดงชื่อใหม่, ค่าจริงไม่เปลี่ยน, malformed metadata ถูกปฏิเสธ
- `.test-data/boolean-label-build.log`: ผล production build / TypeScript
- ไม่เปลี่ยนข้อมูลจริงหรือ Deploy
