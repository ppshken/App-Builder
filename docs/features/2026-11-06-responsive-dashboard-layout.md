# Dashboard Layout ตามพื้นที่หน้าจอ

## ความสามารถ

View → Dashboard → รูปแบบหน้าจอ → จัดหน้าแดชบอร์ด:

- อัตโนมัติตามพื้นที่หน้าจอ: คำนวณคอลัมน์จากความกว้าง container จริง จึงรองรับ sidebar และ Builder Preview โดยไม่ผูกกับ viewport อย่างเดียว
- กำหนดความกว้างขั้นต่ำ 240–640px (เริ่ม 320) และคอลัมน์สูงสุด 1–3
- ขนาดช่องแต่ละ View: เล็ก 1×1, กว้าง 2×1, สูง 1×2, ใหญ่ 2×2; clamp ไม่ให้ล้นจำนวนคอลัมน์ที่มี
- ใช้แท็บบนมือถือ: เมื่อพื้นที่ Dashboard <=600px ใช้แท็บ; ถ้าปิดแสดงหนึ่งคอลัมน์ โดยไม่ใช้ความสูง/ความกว้างเพิ่มของ presets บนมือถือ
- คงตัวเลือก stack/grid/tabs เดิม ช่องว่าง ความสูงพื้นฐาน ชื่อ View ปุ่มเปิดเต็มหน้า และการค้นหารวม
- ค่า layout/min width/mobile tabs/gap/height ตั้งค่าเริ่มต้นระดับแอปได้ และ override ราย View; ขนาดแต่ละ child อยู่ใน Dashboard View นั้น

แนวคิด sizes และ mobile tabs อ้างอิง [Google AppSheet Dashboard view type](https://support.google.com/appsheet/answer/10106384?hl=en) ตรวจ 6 พฤศจิกายน 2026 ระบบนี้รักษาลำดับของ View ใน grid (ไม่ใช้ dense packing) การจัดวางเป็นการกำหนดใน Builder ไม่ได้เพิ่ม runtime drag/resize หรือ Interactive Mode

## Architecture / compatibility

- Metadata ใหม่ใน display_json: `dashboard_min_width`, `dashboard_mobile_tabs`, `dashboard_panel_sizes` ไม่มี migration/dependency
- layout `auto` เป็นตัวเลือกเพิ่ม ไม่เปลี่ยน default stack ของ Dashboard ที่ไม่มีค่าหรือค่าที่บันทึกไว้เดิม
- `lib/dashboard-layout.ts`: pure layout/span calculations และ validation
- `useDashboardLayout.ts`: ResizeObserver จัดการ width และ cleanup เมื่อ unmount ไม่สร้าง resize listeners ต่อ widget
- ใช้ renderer และ permission/Show_If filtering เดิม ไม่เปลี่ยน query, actions, row context หรือเพิ่มสิทธิ์ให้ widget
- ป้องกัน malformed config, invalid size/name, จำนวนเกิน 8, และ size metadata ที่ชี้ child ซึ่งไม่ได้เลือก; เมื่อนำ child ออก UI ลบ size metadata ของ child นั้นด้วย
- เปลี่ยนเป็น tabs ใช้พฤติกรรม mount เฉพาะแท็บที่เลือกแบบเดิม จึงอาจโหลด widget ใหม่เมื่อเปลี่ยนแท็บ/ขนาดหน้าจอ
- Responsive preview ใน App defaults ใช้ helper เดียวกัน

## Validation

- `.test-data/dashboard-layout-unit.log`: 529 tests, 522 passed, 7 skipped, 0 failed รวม layout breakpoints, size spans, clamping, legacy modes, invalid metadata และ app defaults
- `.test-data/dashboard-layout-browser.log`: dev browser ผ่าน mixed sizes, resize desktop/tablet/mobile, global search, tabs, no overflow, builder setting/save/reload และ invalid API requests
- `.test-data/dashboard-layout-build.log`: Production build ผ่าน exit 0
- `.test-data/dashboard-layout-production.log`: Production browser ผ่านทั้ง feature และผู้ใช้จำกัดสิทธิ์: Show_If ซ่อน panel/tab และ row rules ไม่เปิดเผยแถวที่ไม่มีสิทธิ์
- `.test-data/dashboard-layout-permissions.log`: Regression permissions ผ่าน
- `.test-data/dashboard-layout-search-regression.log`: ชุด dashboardsearch ไม่ผ่านที่ breadcrumb หลังเปิดแถว: expected `dash_table`, actual `Global dashboardrow 0`; ไม่เปลี่ยน expected หรือแก้ routing ในงาน layout นี้ ยังไม่ได้รัน baseline แยกเพื่อยืนยันว่าเป็นปัญหาก่อนหน้าหรือ regression
- `.test-data/dashboard-layout-metrics.json` และ screenshots `.test-data/dashboard-layout-*.png`

ทดสอบฐานข้อมูลจำลองและ Chromium viewport ไม่ใช่ iPhone จริง ไม่แก้ฐานข้อมูลจริงหรือ Deploy
