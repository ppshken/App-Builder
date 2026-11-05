# Image URL จากสูตร

Data > คอลัมน์ชนิดรูปภาพ > สูตรคำนวณ หรือ ค่าเริ่มต้น

ตัวอย่าง:
- "https://example.com/photo.jpg"
- [image_url]
- CONCATENATE("https://example.com/photos/", [id], ".jpg")

สูตรคำนวณเปลี่ยนภาพตามค่าคอลัมน์ได้ทันที; ค่าเริ่มต้นใช้วงจรเติมค่าครั้งแรกเดิม ไม่เพิ่มการรีเซ็ตอัตโนมัติให้คอลัมน์ รูปภาพที่บันทึกจริงรับ URL เช่นเดียวกัน สูตรคำนวณยังไม่สร้างคอลัมน์จริง

รับ HTTP/HTTPS ความยาวไม่เกิน 2,000 ตัวอักษร ไม่มี credentials/control characters/backslash; ไม่รับ javascript:, data:, file: หรือ URL แบบ //host ลิงก์ต้องคืนรูปภาพโดยตรงและเปิดให้เบราว์เซอร์ผู้ใช้เข้าถึงได้

เบราว์เซอร์แสดงรูปโดยตรงและไม่ส่ง referrer ไม่ Proxy/ดาวน์โหลดจากเซิร์ฟเวอร์ ไม่สร้าง _images/สำเนาไฟล์จาก URL และไม่เปลี่ยนสถานะ upload ภายในจาก URL ภายนอกที่มีข้อความ /api/images/ อยู่ใน path การอัปโหลดและการตรวจสิทธิ์รูปในระบบคงเดิม ลายเซ็นยังรับเฉพาะไฟล์ในระบบ

รองรับ normalize ค่าจากสูตร/ค่าเริ่มต้น, ตรวจบันทึก API/Action และ preview แปลงชนิดข้อมูล แสดงได้ในฟอร์ม รายการ/ตาราง รายละเอียดและภาพขยาย โดยใช้ตัวแสดงเดิม

ข้อจำกัด: PDF เดิมยังแสดงข้อความแทนรูปภายนอก ไม่เพิ่มการ fetch ภายนอกฝั่งเซิร์ฟเวอร์ รูปภายนอกไม่ได้รวม bytes ใน backup/offline และขึ้นกับต้นทาง รูปแบบ/ขนาดใช้ค่าตั้ง View เดิม ไม่มีการเพิ่มตัวเลือกรูปแบบไฟล์ในงานนี้

หลักฐานทดสอบ isolated database: .test-data/image-formula-url-unit.log — 501 passed / 0 failed / 7 platform skips; .test-data/image-formula-url-browser.log — สูตร/ค่าเริ่มต้น/ปฏิเสธ URL ไม่ปลอดภัย/แสดงภาพจริงในเบราว์เซอร์ผ่าน mock/รายละเอียด/ภาพขยาย/คำนวณในฟอร์ม/บันทึกผ่าน; .test-data/image-formula-url-upload-regression.log — การถ่าย/อัปโหลดในฟอร์มลูกและกลับแม่ผ่าน; TypeScript ผ่าน ไม่มี Production migration หรือ Deploy

## เก็บงานครบวงจร

พบและยืนยันว่า LabelThumbnail เดิมปฏิเสธ URL ภายนอก ทำให้รูปข้างชื่อหายแม้รายละเอียดแสดงได้ หลักฐานก่อนแก้: .test-data/image-url-label-before-fix.log แก้เฉพาะตัวตรวจ thumbnail ให้รับ URL รูปที่ตรวจแล้วและคงการรองรับรูปอัปโหลด/preview เดิม

- .test-data/image-formula-url-complete-browser.log: ผ่านการอัปเดต Image ผ่าน Action, ปฏิเสธ URL อันตรายพร้อม rollback, Label ในตาราง/รายการ/Inline, ฟอร์ม/รายละเอียด/ภาพขยาย
- .test-data/image-formula-url-complete-build.log: production webpack build ผ่าน แยก output .next-check และ database path ทดสอบ
- .test-data/image-formula-url-production.log: ชุดข้างต้นผ่านกับ production build บน integration DB แยก และรูป Label ที่อัปโหลดจริงใน fixture ยังโหลดได้
- ชุด imagelabels เก่า (.test-data/image-formula-url-label-regression.log) ไม่ผ่านที่ selector .choice-list .row-label-image ซึ่งไม่ตรง EnumList UI ปัจจุบัน จึงไม่ถือว่าทั้งชุดผ่าน ไม่มีการเปลี่ยน Expected Result เพื่อข้ามปัญหา; การแสดง thumbnail รูปอัปโหลดตรวจแยกใน production integration ข้างต้นแล้ว
- รูปภายนอกในการทดสอบเบราว์เซอร์ใช้ mock response ไม่มีการส่งคำขอไปผู้ให้บริการจริง และยังไม่ได้ทดสอบเครื่อง iPhone จริง
