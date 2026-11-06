# เปลี่ยนตำแหน่งนำทางของ View แล้วเห็นผลทันที

## สาเหตุและการแก้ไข

Sidebar ของหน้า View อ่าน registry ที่บันทึกแล้ว ขณะที่ค่าตำแหน่ง/ชื่อกลุ่ม/ลำดับที่แก้ไขอยู่ใน draft จึงต้องบันทึกก่อนจึงย้ายหมวด Sidebar ได้

เพิ่ม `withViewDraft` เป็นการรวม draft กับ registry แบบไม่ mutate และเรียงตาม pos/name ใช้ใน Sidebar และรายการเลือก View ของ Preview เปลี่ยน Primary/Menu/Reference/Inline, ชื่อกลุ่ม และเลขลำดับแล้วสะท้อน draft ทันที รวม View ใหม่โดยไม่ซ้ำรายการเดิม เมนูที่เลือกยังถูก highlight และคลิก View เดิมไม่รีเซ็ต draft

การเปลี่ยนนี้ไม่ Auto-save ไม่เขียนฐานข้อมูลก่อนกดบันทึก ปุ่มย้อนกลับคืนตำแหน่งเดิม Preview ของแอปยังใช้ validation และ message ที่ตรวจ origin/source เดิม (debounce 250ms) จึงไม่ข้าม validation เพื่อให้แสดงสูตรหรือ configuration ที่ผิด

## หลักฐาน

- `.test-data/navigation-draft-unit.log`: 528 tests รวม 521 pass / 7 skipped / 0 failed; nonmutation, draft replace/insert, category, sorting และ reset
- `.test-data/navigation-draft-browser.log`: dev API/browser ผ่าน: instant Sidebar/category/group, Preview Menu/Reference, no-write-before-save, reset, save/reload
- `.test-data/navigation-draft-build.log`: Production build
- `.test-data/navigation-draft-production.log`: ผล browser บน production build
- `.test-data/navigation-draft-menuorder.log`: Regression dialog ลากจัดลำดับเมนู

ไม่แก้ข้อมูลจริง ไม่ติดตั้ง dependency และไม่ Deploy
