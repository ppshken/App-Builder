# แก้ dependency Critical/High — 2 พฤศจิกายน 2569

อัปเดตการตรวจ deployment ภายหลัง: Docker build/smoke บน Linux ARM64 / Node 22 ผ่านแล้ว รวม backup/restore helpers และ Caddy local-CA HTTPS ดู [ผลล่าสุดและขอบเขตที่ยังไม่ยืนยันบน VPS](../2026-11-02-deployment-verification/RESULTS.md) ส่วนข้อจำกัดในรายงานด้านล่างเป็นสถานะ ณ จบการแก้ dependency รอบนั้น

**แก้และติดตั้งในโปรเจกต์หลักแล้ว: Critical 0, High 0** ทั้ง production dependencies และ audit รวม dev dependencies ยังมี Moderate 8 แพ็กเกจใน dependency chain ของ ExcelJS ไม่ได้ใช้ `npm audit fix --force` หรือ downgrade ExcelJS เพื่อให้ตัวเลขหาย

ผู้ใช้อนุญาตให้ลงมือแก้ในวันที่ 2 พฤศจิกายน 2569 ต่อจากการตรวจ production จึงดำเนินงาน AUD-003 ที่เคยพักไว้ เริ่มอัปเกรดและทดสอบในสำเนาโค้ดแยกโดยไม่คัดลอกฐานข้อมูล/ข้อมูลลับจริง แล้วนำชุดที่ผ่านกลับเข้า workspace และติดตั้งด้วย `npm ci` อีกครั้ง ไม่มีการ deploy หรือเปลี่ยน business schema

## รุ่นที่ติดตั้ง

| แพ็กเกจ | ก่อน | หลัง |
|---|---|---|
| Next.js | 14.2.15 | 16.4.3 |
| React / React DOM | 18.3.1 | 19.3.1 ทั้งคู่ |
| PostCSS ที่ Next.js ใช้ | 8.4.31 | 8.5.23 |
| React / React DOM types | React types 18 | 19.3.0 ทั้งคู่ |

pin รุ่นหลักและอัปเดต `package-lock.json` แล้ว `npm audit --omit=dev --audit-level=high` คืน exit code 0 ดู [audit รวม](evidence/audit-all.json), [high gate](evidence/audit-high-gate.log) และ [ผลรวมพร้อม hash ของ lockfile](evidence/results.json)

## โค้ดที่ปรับให้รองรับ

- อ่าน `headers()`, `cookies()`, page `searchParams` และ public route `params` แบบ async
- รอ route parameters ใน `withAuth` ก่อนตรวจสิทธิ์และส่งต่อให้ handler เดิม ครอบคลุม data, images/files, Excel, lists และ table APIs โดยใช้เส้นทางตรวจสิทธิ์เดิม
- ย้าย `middleware.ts` เป็น `proxy.ts` ตาม Next.js 16 โดยรักษาการล้าง routing headers และการตรวจ same-origin เดิม
- ใช้ `serverExternalPackages` สำหรับ SQLite/Playwright และ instrumentation ที่รองรับโดยตรง เลือก webpack ใน dev/build/test server เพื่อคงวิธี build เดิมสำหรับ native dependencies
- ปรับ React 19 types ของ refs และ dropdown children โดยไม่เปลี่ยนกฎข้อมูล
- Next.js 16 proxy ตัด body ที่เกิน 10 MB ตามค่าเริ่มต้น ทำให้ไฟล์แนบถูกปฏิเสธผิดรูปแบบ จึงตั้ง `proxyClientMaxBodySize` เป็น 513 MB เพื่อรองรับขีดจำกัด backup เดิม 512 MB รวม multipart headers ขีดจำกัดของแต่ละ endpoint ยังคงบังคับใช้อยู่ เช่นไฟล์ 20 MB และรูปในฟอร์มรวม 50 MB ไม่มีการเพิ่มขีดจำกัดข้อมูลของแอป
- ปรับ cache browser test ให้เลือก combobox แทน label ที่ซ้ำกับปุ่มเมนู และตรวจค่าที่บันทึกใน API แทน success banner เก่าที่ไม่มีแล้ว
- เพิ่ม regression test: อัปโหลดและดาวน์โหลดไฟล์ 11 MB ต้องได้ bytes ครบ, upload/inspect backup ที่ใหญ่กว่า 10 MB ต้องผ่าน และไฟล์เกิน 20 MB ยังต้องได้ 413
- ปรับ README, system spec, Node engine และ TypeScript JSX runtime ให้ตรงรุ่นใหม่

## ผลตรวจ

| รายการ | ผล |
|---|---|
| `npm ci` ใน workspace หลัก | ผ่าน |
| Strict library compilation และ unit tests | 392 ผ่าน, 0 ไม่ผ่าน |
| TypeScript application typecheck | ผ่าน |
| Production build ใน `.next-check` และ build ปกติ `.next` | ผ่าน compile, typecheck และ static pages 23 หน้า |
| Production API suite | 15 ผ่าน, 0 ไม่ผ่าน |
| Production integration/browser | ผ่าน 21 ชุดตามรายการด้านล่าง |
| Workspace หลักหลังติดตั้ง | รัน API, attachments, deferred images และ PWA ซ้ำ ผ่านทั้ง 4 ชุด |
| Critical/High audit gate | ผ่าน, ยังเหลือ Moderate 8 |

21 ชุดที่ผ่าน: `api`, `auth`, `attachmentboundary`, `permissions`, `buildersecurity`, `readiness`, `deferredimages`, `relatedexpression`, `concurrentedit`, `workflows`, `exceltext`, `exceloptions`, `pwa`, `cache`, `navcontract`, `browser`, `columnssettings`, `refcreate`, `attachments`, `readinessperf`, `safety`

ครอบคลุม login/CSRF/session, การแยกสิทธิ์ข้ามแอป, form image แม่–ลูกและ retry/rollback, สูตร Related, conflict 409, PDF ภาษาไทย/รูป/ลายเซ็น, Automation/webhook fixture ภายใน, Excel import/export/สิทธิ์, backup/restore, PWA update/offline/login, cache และ navigation ดู [หลักฐานแยกชุด](evidence/)

## ขอบเขตที่ยังไม่ยืนยัน

การทดสอบนี้รันบน macOS / Node 24.9.0 และ Chrome/Chromium รวม mobile touch emulation การติดตั้ง native SQLite รอบแรกพบ SDK/linker ของเครื่องไม่เข้ากัน จึงใช้ SDK จาก Xcode 26.5 เฉพาะคำสั่งติดตั้งและ `npm ci` ผ่าน โดยไม่แก้การตั้งค่า SDK ส่วนกลาง

**Linux/Docker ตาม Dockerfile ที่ใช้ Node 22 ยังไม่ได้ build/run** เพราะ Docker daemon ไม่พร้อมใช้งาน รวมถึงยังไม่ได้ตรวจ HTTPS ของเครื่อง production หรือ iPhone/Safari เครื่องจริง จึงยืนยันได้ว่าการแก้ dependency และ regression tests ในเครื่องผ่าน ไม่ใช่การรับรอง production deployment ทั้งระบบ

ข้อค้นพบเรื่องไฟล์สำเนารูปที่ขาดและการเตรียม backup ก่อนย้ายระบบใน [รายงาน production ก่อนอัปเกรด](../2026-11-02-production-check/RESULTS.md) ยังต้องจัดการแยก ไม่ได้ลบหรือสร้างไฟล์จริงเหล่านั้นระหว่างงาน dependency นี้

## แหล่งอ้างอิง

- [คู่มืออัปเกรด Next.js 16](https://nextjs.org/docs/app/guides/upgrading/version-16)
- [ประกาศ security update ของ Next.js](https://nextjs.org/blog/nextjs-security-update-october-14-2026)
- เอกสาร `proxyClientMaxBodySize` ที่มากับ Next.js 16.4.3 ใน `node_modules/next/dist/docs/` และ regression tests ในหลักฐาน

หากต้องย้อนโค้ด ให้ย้อนการเปลี่ยนแปลงชุด migration พร้อม package/lockfile แล้วติดตั้งและ build ใหม่ทั้งชุด ห้ามย้อนเฉพาะ Next.js โดยทิ้ง React/config/API compatibility คนละรุ่นไว้ การเปลี่ยนแปลงนี้ไม่มี database migration ที่ต้องย้อน
