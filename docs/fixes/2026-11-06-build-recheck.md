# ตรวจ Build หลังคืนพื้นที่ดิสก์ — 6 พฤศจิกายน 2026

## ผล

- `npm.cmd run build` ผ่าน exit 0 (Next webpack, TypeScript, page generation และ build traces)
- Unit รวม 526 ข้อ: ผ่าน 519, skipped 7, failed 0
- Production API/browser integration ผ่าน 4/4 ชุด: `menuorder`, `booleanlabels`, `selectrelated`, `permissions`
- `git diff --check` ผ่าน ไม่มีการ Deploy หรือเปลี่ยนฐานข้อมูลจริง

## ขอบเขตที่ตรวจ

- จัดลำดับเมนู: pointer drag จริง, ย้ายทั้งกลุ่ม, บันทึกเลข pos ตรงกับช่องตั้งค่า View, ยกเลิกไม่เขียนข้อมูล, เปิดใหม่คงลำดับ, stale snapshot ตอบ 409 และหัวกลุ่ม Sidebar/Runtime
- True/False labels: ตั้งชื่อผ่าน ColumnEditor แล้วบันทึก, mobile/desktop form และรายละเอียด, reload คงชื่อ, ค่าจริงยังเป็น 1/0 และปฏิเสธ metadata ผิดรูปแบบ
- SELECT Related: ข้อมูลจำลอง 300,000 ลูก, indexed parent lookup, สูตรและ permissions, scoped preview และ metadata persistence
- Regression permissions ตามชุด `tests/permissions-browser.cjs`

## หลักฐาน

- `.test-data/build-recheck.log`
- `.test-data/build-recheck-unit.log`
- `.test-data/build-recheck-summary.json`
- `.test-data/build-recheck-menuorder.log`
- `.test-data/build-recheck-booleanlabels.log`
- `.test-data/build-recheck-selectrelated.log`
- `.test-data/build-recheck-permissions.log`

ใช้ `.next-check` แยกจาก dev server และฐานข้อมูลชื่อ integration ใน `.test-data` ทุกการรัน ปัญหา ENOSPC รอบก่อนหายหลังผู้ใช้เคลียร์พื้นที่ เหลือว่างประมาณ 26.6 GiB หลังตรวจ

ไม่ได้รันทุกรายการ E2E ของระบบ และไม่ได้ตรวจ Docker/Linux/production server หรือ iPhone จริงในรอบนี้ ข้อผิดพลาดเก่าในชุด formulaeditor เรื่องเกณฑ์ความสูงช่องสูตรไม่ได้ตรวจซ้ำหรือแก้ในรอบนี้
