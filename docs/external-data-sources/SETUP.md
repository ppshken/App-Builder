# Server setup — External REST API sources

ตรวจสอบ 30 ตุลาคม 2026 · เอกสารตัวอย่างเท่านั้น ไม่มีการแก้ environment หรือ deploy อัตโนมัติ

## Origin policy

ตั้งค่าใน process/container ฝั่ง backend:

~~~dotenv
NOCODE_API_ORIGINS=https://api.example.com
NOCODE_API_WORKSPACE_ORIGINS={"app_id_here":["https://api.example.com"]}
NOCODE_API_READ_QUERY_PATHS={"https://api.example.com":["/v1/read-query"]}
~~~

- Allowlist เป็น **Origin แบบ exact match** ไม่มี wildcard, pathname หรือ trailing slash; HTTPS port 443 เท่านั้น
- Workspace override จะใช้แทน global list สำหรับแอปนั้น (array ว่าง = ไม่อนุญาตทุกปลายทาง)
- ไม่ตั้ง allowlist = ไม่สามารถเรียก API ภายนอกได้ ไม่เปิดปลายทาง default
- POST ต้องผ่านทั้ง read-only checkbox และ exact-path policy ด้านบน; อย่าอนุญาต endpoint ที่มีคำสั่งเขียนข้อมูล ใช้บัญชี remote ที่อ่านได้อย่างเดียว
- DNS ต้องคืน public IP ทุก address; private VPN/LAN API ยังไม่รองรับ นโยบายนี้ใช้กับ redirect และ next link ด้วย

## Server-managed credential references

ตั้ง NOCODE_API_CREDENTIALS เป็น JSON array ผ่าน secret manager หรือ server environment ตัวอย่างโครงสร้าง (ค่าในวงเล็บมุมเป็น placeholder):

~~~json
[
  {"id":"inventory_read","label":"Inventory read only","type":"bearer","value":"<server-managed-token>","apps":["default"],"origins":["https://api.example.com"]},
  {"id":"inventory_key","label":"Inventory API key","type":"api_key","header":"X-API-Key","value":"<server-managed-key>","apps":["default"],"origins":["https://api.example.com"]},
  {"id":"inventory_basic","label":"Inventory Basic","type":"basic","username":"<service-account>","password":"<server-managed-password>","apps":["default"],"origins":["https://api.example.com"]}
]
~~~

- Builder ได้รับเฉพาะ id, label, type; config เก็บ credential_id ไม่เก็บ value/password
- ไม่ใส่ token ใน URL/query/body/header editor; API key รองรับ header ฝั่ง backend เท่านั้น
- apps/origins จำกัดขอบเขตของ credential แยกจาก allowlist; ต้องผ่านทั้งสองรายการ
- ไม่ commit environment file หรือ registry จริง ไม่วาง secret ใน frontend NEXT_PUBLIC_* variables
- Rotate โดยเปลี่ยน environment ผ่านระบบจัดการ secret และ restart process/container โดยใช้ credential id เดิม
- ปรับตามระบบ Docker Compose เดิมให้ส่ง environment เหล่านี้เข้า **app container**; task นี้ไม่ได้เปลี่ยน Compose, volumes, domain หรือ TLS proxy เดิม
- Clone/restore แอปแล้ว source จะถูกพักไว้ ต้องเพิ่ม app ID ใหม่ใน credential scope และตรวจปลายทางก่อนเปิดใช้งาน

## Before production

ทดสอบ API จริงใน staging: data path, required keys, unique string IDs, pagination completion, quotas, timestamp timezone, failure/429, read-only credential และเวลา sync บนขนาดข้อมูลจริงก่อนเปิด schedule

Full application backup/restore ใช้กระบวนการเดิม; สำรอง server secrets แยกตามนโยบายองค์กร เพราะไฟล์สำรองแอปไม่ได้บรรจุ credential values
