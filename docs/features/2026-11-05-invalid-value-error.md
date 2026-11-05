# Invalid value error

Data > แก้ไขคอลัมน์ > การตรวจข้อมูล > Invalid value error อยู่ใต้ Valid_If

กรอกข้อความปกติไม่เกิน 1,000 ตัวอักษร ไม่ใช่สูตร; เว้นว่างใช้ข้อความระบบ รองรับทั้ง Valid_If แบบ boolean/รายการ และ Enum/EnumList ที่เลือกค่านอกตัวเลือก ไม่แทนที่ข้อผิดพลาดช่องบังคับ ชนิดข้อมูล หรือสูตรผิด

ฟอร์มและการเขียนผ่าน API/Action ใช้ตัวตรวจเดิม เก็บ metadata invalid_value_error บน _columns และคอลัมน์คำนวณเฉพาะแอป คงค่าไว้ระหว่างแปลงชนิด/คัดลอกคอลัมน์ Shared snapshot เก่าที่ไม่มีค่านี้ยังเข้ากันได้

ตัวอย่าง: Valid_If = AND([_THIS] >= 1, [_THIS] <= 100), Invalid value error = กรุณาระบุจำนวนระหว่าง 1–100

ผลทดสอบบนฐานข้อมูลจำลอง: .test-data/invalid-value-error-unit.log — 496 passed / 0 failed / 7 platform skips; .test-data/invalid-value-error-browser.log — HTTP + Browser passed ครอบคลุมตั้งค่า/บันทึกข้อความภาษาอังกฤษ, API ปฏิเสธค่าผิดด้วยข้อความที่กำหนด, ฟอร์มแสดงข้อความและบันทึกค่าถูกต้อง, Enum regression; TypeScript ผ่าน

เปลี่ยนเฉพาะ source และทดสอบ isolated database ไม่ได้ migrate Production หรือ Deploy
