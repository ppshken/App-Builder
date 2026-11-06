# รูปแนวตั้งในรายการไม่ล้นกรอบ

## Reproduce / Root cause

กรอบ `.record-avatar` ใช้ CSS Grid ที่มี implicit auto track และ `place-items:center` ส่วนรูปมี width/height 100% ทำให้ intrinsic aspect ratio ของรูปแนวตั้งขยายแถว Grid เกินความสูงกรอบได้ แม้ตั้ง object-fit cover แล้ว

หลักฐานก่อนแก้ `.test-data/list-image-cover-before.log`: Chromium กรอบ square/small 36×36px แต่รูปแนวตั้ง 80×1200px ถูกวางเป็น 36×540px, overflow visible

## การแก้ไข

- กำหนดแถว/คอลัมน์ Grid เป็น minmax(0,1fr) และ min-width/min-height 0 ที่กรอบ ปิด overflow
- รูปภายในการ์ดรายการเต็มพื้นที่ที่มีจริง ใช้ cover/center พร้อมขอบเขต min/max
- รองรับ wrapper ของ decoration โดยให้ยืดเต็มกรอบและไม่เพิ่ม padding
- เพิ่ม specificity เฉพาะรูปใน record-card-main ให้ชนะกฎ configured-detail ที่ตั้ง max-width 180px/height auto ซึ่งรั่วเข้ามาถึง Inline ในหน้ารายละเอียด
- ไม่เปลี่ยนขนาดกรอบที่ตั้งไว้ รูปร่าง square/round/wide หรือโหมดภาพเต็มในรายละเอียด/ตัวดูภาพ

## Verification

- `tests/list-image-cover-browser.cjs` ตรวจ Chromium และ WebKit, runtime/inline, square/round/wide, small/medium/large, wrapper/no wrapper, portrait/landscape/square sources
- ตรวจ bounding boxes ว่ารูปเติม content viewport ของกรอบและอยู่ภายในกรอบเดิม โดยเคารพ border ของ wrapper และความสูงการ์ดไม่ขึ้นกับอัตราส่วนรูปต้นฉบับ
- `.test-data/list-image-cover-after.log`: ผ่าน
- `.test-data/list-image-cover-metrics.json`: ขนาดที่วัดจริง
- `.test-data/list-image-cover-build.log`: Production build ผ่าน exit 0
- `.test-data/list-image-cover-runtime.log`: Production browser ผ่าน ภาพอัปโหลดแนวตั้ง/แนวนอนจริงใน list grid และ Inline detail ที่ความกว้าง mobile/desktop และกรอบ square/round/wide
- `.test-data/list-image-cover-inline.log`: ชุดเก่า inlinevisual ไม่ผ่าน: timeout หา `#data-part-iv_photos-angle` ใน dialog เพิ่มรายการลูก ไม่ได้เปลี่ยน expected เพื่อทำให้ผ่าน และยังไม่ได้ยืนยันสาเหตุ/แก้ฟอร์มลูกในงาน CSS นี้

ไม่แก้ข้อมูลจริง ไม่ติดตั้ง dependencies ไม่ Deploy ทดสอบ WebKit บน Windows ไม่ใช่ iPhone จริง
