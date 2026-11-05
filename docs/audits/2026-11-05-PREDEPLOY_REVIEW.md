# ตรวจซ้ำก่อน Deploy — 5 พฤศจิกายน 2026

> ข้อกำหนดใหม่หลังรายงาน: ผู้ใช้ยืนยันให้ Login เป็นหน้ากลาง ไม่มีชื่อหรือโลโก้ทั้ง Builder และแอป เพราะใช้บัญชีร่วมหลายแอป ดังนั้น PREDEPLOY-01 เรื่องไม่มี app branding ไม่ใช่บัคตามข้อกำหนดล่าสุดแล้ว การแก้ถัดมาลบ Builder branding ออกจาก Login และปรับ assertions ของ PWA/ธีมให้ตรวจว่าหน้า Login ไม่มี branding โดยยังคงทดสอบ login/logout/redirect เดิม ผลตัวเลขด้านล่างเป็นผลรอบตรวจเดิม ไม่ใช่ผลรอบทดสอบหลังเปลี่ยนข้อกำหนด

ผลหลังเปลี่ยนข้อกำหนด Login กลาง:
- Production Build รวม TypeScript ผ่าน: `.test-data/shared-login-build.log`
- PWA suite บน production build **ผ่านครบ** รวม login/logout/redirect และการไม่แสดง branding: `.test-data/shared-login-production-pwa.log`
- `loginflash` บน production build **ยังไม่ผ่าน** ที่ assertion theme samples (ได้ light ในกรณีที่ test คาด dark): `.test-data/shared-login-production-loginflash.log` ต้องตรวจแยกว่าสัญญาการเลือกธีมของ Login กลางกับ app setting ควรเป็นอย่างไร ห้ามถือว่าการตรวจธีมผ่าน และยังไม่แก้ theme logic ในงานลบ branding นี้
- การรัน dev ก่อนหน้าเจอ aborted navigation ใน PWA และการตรวจ type ขณะ dev กำลังสร้างไฟล์เจอ generated route types หาย จึงยืนยันด้วย production build ที่ผ่านและ PWA suite บน build นั้นแทน

## ข้อสรุป

**ยังไม่แนะนำให้ Deploy ทันที**: build ผ่านและเส้นทางหลักที่ทดสอบผ่าน แต่พบการแสดงชื่อ/รูปแอปในหน้า PWA Login หายจริง และมี regression suites เก่าสองชุดที่ยังไม่ผ่าน ต้องแก้และทดสอบซ้ำให้ครบก่อนปิดรอบตรวจ

ตรวจ working tree ปัจจุบันใน `C:/xampp/htdocs/App-Builder` ซึ่งรวมงานวันนี้และงานที่ยังไม่ commit ก่อนหน้านี้ ไม่สามารถแยกทั้งหมดด้วย commit ได้ และไม่ใช่การ audit ทุกโมดูลอย่างสมบูรณ์

ไม่มีการแก้ source code, credentials, ฐานข้อมูลจริง, Docker volumes หรือ Deploy ในรอบตรวจนี้ มีเฉพาะหลักฐานทดสอบและรายงาน

## ผลตรวจจริง

| การตรวจ | ผล | หลักฐาน |
|---|---|---|
| Unit suite | 510 ข้อ: ผ่าน 503, ข้ามตามแพลตฟอร์ม 7, ล้มเหลว 0 | `.test-data/predeploy-unit.log` |
| Production build + TypeScript | ผ่าน `next build --webpack` ลง `.next-check` | `.test-data/predeploy-build.log` |
| API/Browser integration บน production build | 25 ชุด: ผ่าน 22, ไม่ผ่าน 3 | `.test-data/predeploy-summary.json` |
| Compose syntax | ผ่าน `docker compose -f compose.yaml -f compose.nginx.yaml config --no-interpolate --quiet` | command exit 0 |
| Linux Docker image build/start | **Not Tested**: Docker Engine ไม่ทำงานในเครื่องนี้ | Docker API named pipe unavailable |
| Package/lockfile | Next, React, React DOM, sharp, web-push รุ่นตรงกัน; มี sharp Linux x64 optional package | อ่าน package/lockfile โดยไม่เปลี่ยน dependencies |
| Diff whitespace | พบ trailing whitespace เดิมที่ `app/views/page.tsx:94` | `.test-data/predeploy-diff-check.log` |

ทุก integration ใช้ SQLite fixture แยกใน `.test-data/run-*/integration-*.db` ไม่ใช้ `data.db` จริง

ชุดที่ผ่าน: `api`, `tableactions`, `imageurls`, `viewtitle`, `modernicons`, `pwaicons`, `push`, `customimage`, `designerinteractions`, `filebrowser`, `bulk`, `permissions`, `workflows`, `workflowdesigner`, `profile`, `deferredimages`, `rawdata`, `approles`, `appoperations`, `mobilecontrols`, `viewundo`, `inlinehorizontal`.

ไฟล์หลักฐานรายชุด: `.test-data/predeploy-<ชื่อชุด>.log` การผ่านของ `tableactions` รวมพื้นผิวตารางทั้งสี่แบบ ความกระชับ ปุ่มทั้งสามแบบ เมนูใน Inline/native dialog และสิทธิ์รายแถว

## Findings

### PREDEPLOY-01 — Confirmed Bug — P2 — PWA Login ไม่แสดงเอกลักษณ์แอป

- **Confidence:** สูง ยืนยันทั้ง browser assertion, DOM probe และ screenshot
- **Source:** `app/login/page.tsx:11`
- **Root cause:** ส่วนแสดงโลโก้ Builder ถูก render เฉพาะเมื่อไม่ใช่ PWA แต่ไม่มีส่วนแสดงชื่อ/รูปของแอปสำหรับสาขา PWA
- **Reproduce:** สร้างแอป fixture ตั้งชื่อแอปเป็น `Alpha Installed` แล้วเปิด `/app/<id>/login` แบบ guest
- **Expected:** เห็นชื่อ/โลโก้ของแอปตามบริบทการติดตั้ง
- **Actual:** เห็นเพียงหัวข้อเข้าสู่ระบบ ไม่มีชื่อแอปหรือภาพเอกลักษณ์ใน login card
- **Evidence:** `tests/pwa-browser.cjs:26`, `.test-data/predeploy-pwa.log`, `.test-data/predeploy-pwa-login-probe.log`, `.test-data/predeploy-pwa-login.png`
- **Probe:** `hasAppName=false`, `hasAnyBrandImage=false`, `hasLegacyBrand=false`; เปิดดู screenshot ยืนยันแล้ว
- **Impact:** ผู้ใช้หลายแอปไม่เห็นว่าเข้าสู่แอปใด; ไม่ได้ยืนยันว่าการตรวจรหัสผ่านเสีย เพราะ suite หยุดก่อนขั้นตอนนั้น
- **Recommended fix:** คืน app-specific brand สำหรับเส้นทาง PWA และเก็บ Builder brand เฉพาะหน้า Builder โดยใช้ public app branding ที่ผ่าน boundary เดิม
- **Regression:** PWA A/B ต้องแสดงคนละชื่อและโลโก้ตามแอป, Builder Login ยังคงโลโก้ Builder, login/logout และการกลับเข้า app route ต้องผ่าน; ห้ามลบ assertion เรื่องชื่อแอปเพื่อให้ suite ผ่าน

### PREDEPLOY-02 — Confirmed Test Maintenance Issue — Copy View suite ยังไม่เปิดส่วนเพิ่มเติม

- **Source:** `tests/view-tools-browser.cjs:7`; UI ปัจจุบัน `app/views/page.tsx:114`
- **Evidence:** `.test-data/predeploy-viewtools.log`: timeout รอปุ่ม `Copy View`
- ปุ่มถูกย้ายตามคำขอไปใน `<details>` “การตั้งค่าเพิ่มเติม” แต่ test ยังคลิกโดยไม่เปิดส่วนนี้
- **Recommended fix:** ให้ test เปิดส่วนเพิ่มเติมก่อนกดปุ่ม แล้วรัน assertions เดิมเรื่อง copy/config, Show_If และ decorations ให้ครบ
- **Status:** ไม่ถือว่าฟีเจอร์ Copy View เสียจาก log นี้ และยังไม่ถือว่า flow หลังจุดหยุดผ่าน

### PREDEPLOY-03 — Confirmed Test Selector Mismatch — Image Label suite ยังอ้าง DOM แบบเก่า

- **Source:** `tests/image-labels-browser.cjs:8`; UI `app/components/ChoiceInput.tsx` ใช้ EnumList chips
- **Evidence:** `.test-data/predeploy-imagelabels.log`: `.choice-list .row-label-image` คาด 2 แต่ได้ 0
- **Recommended fix:** ทดสอบรูปใน selected chips และ dropdown options ปัจจุบัน โดยรักษาความหมายเดิมเรื่องรูป/สิทธิ์และตรวจแต่ละจุดแยก ไม่ลดจำนวนที่คาดเพื่อปิดบังข้อผิดพลาด
- **Status:** suite นี้ไม่ผ่าน; ขั้นตอนหลัง assertion ยังไม่ได้ทดสอบในรอบนี้ ชุด `imageurls` ผ่านและมี local-upload label regression ด้วย แต่ไม่ใช่หลักฐานแทน coverage ทั้งชุดเดิม

## ข้อจำกัดและ Release Gates

1. แก้ PREDEPLOY-01 และรัน PWA suite จนผ่าน flow Login จริงครบ
2. ปรับขั้นตอน/selector ของ PREDEPLOY-02 และ 03 แล้วรันใหม่โดยไม่ลด expected behavior
3. ทำ Linux image build และ start/healthcheck ใน staging; ยังไม่ผ่านการตรวจ native dependencies ใน container จริง
4. ทดสอบ Push ถึง provider/เครื่องจริงหลังตั้งค่า VAPID: รอบนี้ใช้ transport mock และห้ามตีความว่าแจ้งเตือนถึงอุปกรณ์จริงแล้ว
5. iPhone จริง, iOS text autosizing, external image hosts จริง และ load test ขนาด production: **Not Tested** ในรอบนี้
6. Schema เปลี่ยนแบบ additive เช่น usage error detail, invalid-value metadata, media catalog, auto grants และ push tables: fixtures/migration tests ผ่าน แต่ยังไม่ได้ซ้อมย้ายกับสำเนา backup จริงของ production
7. Working tree มีไฟล์ใหม่ที่ยัง untracked รวม API Push, components และ libraries ต้องนำไฟล์ runtime และ lockfile ที่เกี่ยวข้องเข้า release ให้ครบ การ push เฉพาะไฟล์ tracked อาจทำให้ build บน server ไม่เหมือนที่ทดสอบ
8. สำรองข้อมูลแบบ consistent ก่อนอัปเกรด; หากต้อง rollback ให้ใช้คู่ version ของแอปกับ backup ที่เข้ากัน อย่าคาดว่า rollback image อย่างเดียวจะย้อน schema ให้

ไม่พบความล้มเหลวของ core write/permissions ในชุดที่ผ่าน แต่ผลนี้ไม่ใช่คำรับรองว่าไม่มีบัคหรือช่องโหว่ในส่วนที่ไม่ได้ทดสอบ
