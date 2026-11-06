# หัวตาราง Inline ให้ตรงกับหน้า View

## สาเหตุ

หัวคอลัมน์หน้า View ใช้ sort-button ขนาด 12px พร้อม min-height 24px แต่ Inline render label ลง th โดยตรงจึงรับ font 13px และไม่มีความสูงเนื้อหาขั้นต่ำ

หลักฐาน `.test-data/inline-header-before.log`: comfortable/mobile, padding 13px หัวหน้า View สูง 51px แต่ Inline สูง 46.5px (font 12px เทียบกับ 13px)

## การแก้ไข

- ใช้ CSS รูปแบบร่วมระหว่าง sort-button กับ table-column-heading ให้ font, line-height และความสูงข้อความเท่ากัน
- Inline ใช้ span ไม่เพิ่มปุ่มหรือพฤติกรรม sorting ที่ยังไม่รองรับ
- คง padding/density/line-height ที่กำหนดแยกในแต่ละ View และ app defaults เดิม เมื่อ config เท่ากันหัวจะมีขนาดเท่ากัน
- ไม่เปลี่ยนหัวกลุ่มข้อมูล, sticky behavior, ข้อมูลแถว หรือสิทธิ์

## หลักฐานทดสอบ

- `tests/inline-table-header-browser.cjs`: สร้างตารางแม่/ลูกแยกในฐานข้อมูลทดสอบ เปรียบเทียบ computed font size/weight/color/line-height, padding 4 ด้าน และ bounding height ของหัวคอลัมน์ในหน้า View กับ Inline ในรายละเอียด
- ครอบคลุม mobile 390px / desktop 1440px, comfortable / compact / custom padding 9px และ line-height 2.2
- `.test-data/inline-header-after.log`: ผ่าน
- `.test-data/inline-table-header-metrics.json`: ค่าที่วัดจริง
- `.test-data/inline-header-build.log`: ผล Production build
- `.test-data/inline-header-production.log`: ผลทดสอบบน production build

ไม่มี migration, dependency ใหม่, การแก้ข้อมูลจริง หรือ Deploy
