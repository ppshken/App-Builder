# รวมการเลือก View / ขนาด / จัดลำดับ Dashboard

## ปัญหาเดิม

รายการเลือก View และรายการขนาดแยกกัน แถวลำดับใช้ Flex แต่ style อ้าง `.search-select` ทั้งที่ SearchSelect render เป็น `.search-select-trigger` ซึ่งกว้าง 100% ทำให้ dropdown กินทั้งแถวและผลักลูกศรออกด้านขวา

## เปลี่ยนแปลง

- ใช้รายการเดียว: drag handle หน้าแถว → checkbox/ชื่อ View/ชื่อตาราง → ปุ่มขึ้น/ลง → ขนาดด้านขวา
- ติ๊กเลือกแล้วแสดงขนาดในแถวนั้นทันที แสดงลำดับของที่เลือก และไม่มี dropdown ของรายการที่ไม่เลือก
- เรียงรายการที่เลือกตาม dashboard_views ก่อนรายการที่ยังไม่เลือก
- ลากด้วย ColumnDragHandle เดิม ใช้ ID ของ View ย้ายรายการ ไม่สร้างระบบ drag ใหม่ พร้อม ghost/placeholder ที่คงรูปแบบแถว Grid
- เก็บปุ่มขึ้น/ลงไว้สำหรับ keyboard และกำหนด Grid tracks ให้ปุ่ม/ชื่อ/ขนาดอยู่ในความกว้างแถวทั้ง desktop/mobile ชื่อยาวใช้ ellipsis
- รายการเลื่อนแนวตั้งได้ ไม่เพิ่ม horizontal overflow
- คงขีดจำกัด 8 View และลบ size metadata เมื่อเอา View ออกจากรายการ บันทึกผ่าน View draft/save เดิม ไม่มีการเขียนข้อมูลก่อนบันทึก

## หลักฐาน

- `.test-data/dashboard-picker-types.log`: TypeScript noEmit ผ่าน
- `tests/dashboard-picker-browser.cjs`: ติ๊กเลือก/ขนาดในแถวเดียวกัน, pointer drag, ghost display grid, arrows, ตรวจ bounding controls อยู่ในขอบที่ 390/760/1100/1440px, no-premature-write, save/reload และ cleanup หลังเอาออก
- `.test-data/dashboard-picker-browser.log`: dev ผ่าน (ก่อนเพิ่ม assertion ของ ghost)
- `.test-data/dashboard-picker-build.log`: Production build
- `.test-data/dashboard-picker-production.log`: Production browser ของ UI
- `.test-data/dashboard-picker-layout-regression.log`: Regression responsive layout และ restricted user

ไม่มี migration หรือ dependency ใหม่ ไม่แตะฐานข้อมูลจริงและไม่ Deploy
