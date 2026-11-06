# ความสม่ำเสมอของตัวอักษรบน iPhone

## การเปลี่ยนแปลง

ย้ายการตั้งค่า text inflation ไปที่ต้น CSS ของเอกสาร และกำหนด `-webkit-text-size-adjust: none; text-size-adjust: none` ที่ html/body แทนค่า 100% เดิม เพื่อปิดการปรับข้อความอัตโนมัติของ browser โดยเฉพาะส่วนตารางกว้างและการสลับแนวหน้าจอ

ไม่ได้เปลี่ยนขนาดฟอนต์ของแต่ละองค์ประกอบ, font-scale ของแอป, CSS zoom หรือ viewport ไม่ตั้ง user-scalable=no / maximum-scale ส่วนช่องกรอกบน touch device ยังคงกฎขั้นต่ำ 16px เดิมเพื่อป้องกัน focus zoom

อ้างอิง: [MDN text-size-adjust](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/text-size-adjust), [Apple Safari Customizing Style Sheets](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/AdjustingtheTextSize/AdjustingtheTextSize.html) ตรวจ 6 พฤศจิกายน 2026

## สิ่งที่ยืนยันได้และข้อจำกัด

- โค้ดเดิมมีเพียง html text-size-adjust 100% และไม่มี rule ที่ปิด inflation
- การขยายข้อความของ iOS เป็นสาเหตุที่เป็นไปได้ ยังไม่ยืนยันว่าเป็นสาเหตุเดียวของอาการบนเครื่องผู้ใช้ เพราะไม่มี iPhone จริงให้ reproduce
- WebKit บน Windows ไม่รองรับ text-size-adjust แบบ iOS ใน runtime นี้ ส่วน Chromium normalize computed none เป็น 100% จึงห้ามสรุปจาก computed property ค่าเดียวว่า browser ยังเปิด inflation หรือแก้ได้จริงบน iOS
- Test ตรวจ declaration ใน source, computed font sizes และ layout ใน browser ที่มีอยู่ แยกจาก physical iOS ซึ่งยัง Not Tested

## หลักฐาน

- `tests/mobile-text-sizing-browser.cjs`: เอกสาร responsive ที่มี wide grouped table, header/detail/Inline, input, portrait-landscape-portrait และ font scale 0.8 / 1 / 1.5 ทั้ง Chromium และ WebKit พร้อม desktop baseline
- `.test-data/mobile-text-before.log`: regression ของนโยบาย CSS ที่ fail ก่อนแก้ (100% เทียบกับ explicit none) ไม่ใช่หลักฐาน reproduce การ inflate จริงบน iPhone
- `.test-data/mobile-text-after.log`: fixture test ผ่าน
- `.test-data/mobile-text-sizing-metrics.json`, `.test-data/mobile-text-chromium.png`, `.test-data/mobile-text-webkit.png`: ขนาดและ screenshot ของ fixture หลังแก้
- `.test-data/mobile-text-input-regression.log`: ชุดเดิมตรวจขนาด input portrait/landscape, touch, scale, formula overlay และ desktop ผ่าน
- `.test-data/mobile-text-build.log`: Production build ผ่าน exit 0
- `.test-data/mobile-text-runtime.log`: mobilecontrols บน Production build ผ่าน ทั้ง WebKit และ Chromium: ตาราง/หัวกลุ่ม, รายการ, sticky controls, touch focus, dropdown และ desktop baseline

ไม่แก้ข้อมูลจริง ไม่ติดตั้ง dependencies และไม่ Deploy ต้องเปิด app ใหม่หลังอัปเดตเพื่อรับ CSS แล้วตรวจซ้ำบน iPhone จริง
