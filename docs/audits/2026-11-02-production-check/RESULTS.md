# ผลตรวจเตรียม production — 2 พฤศจิกายน 2569

อัปเดตภายหลัง: แก้ dependency Critical/High แล้วตาม [รายงาน migration](../2026-11-02-dependency-security/RESULTS.md) และ [ตรวจ Docker Linux ARM64/Caddy local-CA HTTPS ผ่านจริง](../2026-11-02-deployment-verification/RESULTS.md) ด้านล่างเป็นผล ณ ก่อนอัปเกรด ยังต้องตรวจ VPS/DNS/public TLS และจัดการ finding สำเนารูปก่อน Go Live

**ผลตัดสิน: ยังไม่ควรเปิด production สู่ Internet** จนกว่าจะแก้ dependency ด้านความปลอดภัยและตรวจระบบบนเครื่องปลายทาง แม้การทดสอบการทำงานรอบนี้ผ่านทั้งหมด

ตรวจโค้ดใน workspace ปัจจุบันซึ่งรวมการแก้ที่ยังไม่ได้ commit ใช้ production build แยกที่ `.next-check` และฐานข้อมูลสังเคราะห์แยกทุกชุด ฐาน `data.db` กับ backup เดิมเปิดตรวจแบบ read-only ไม่ได้กู้คืน แก้บัญชี ลบรูป หรือ deploy ระบบจริง

## สิ่งที่ต้องจัดการก่อนเปิดจริง

| ระดับ | สิ่งที่พบ | การดำเนินการ |
|---|---|---|
| ต้องแก้ก่อนเปิดภายนอก | `npm audit --omit=dev` พบแพ็กเกจที่ได้รับผลกระทบ 10 รายการ: Critical 1 (`next`), High 1 (`postcss`), Moderate 8 รวม dependencies ของ ExcelJS โดยติดตั้ง Next.js 14.2.15 | อัปเกรดไปยังรุ่นที่แก้ advisory ปัจจุบัน แล้ว audit, build และรันทดสอบซ้ำ การตรวจนี้ไม่ได้อัปเกรด major version หรือใช้ `npm audit fix --force` |
| ต้องตรวจเครื่องปลายทาง | ตรวจ Compose HTTP/HTTPS config ผ่าน แต่ Docker daemon ในเครื่องไม่ได้เปิด จึงยังไม่ได้ build/run Linux container ตาม Dockerfile ซึ่งใช้ Node 22 ส่วนเครื่องตรวจใช้ Node 24.9.0 | ทดสอบ container แบบใช้ข้อมูลสังเคราะห์ พร้อม PDF, healthcheck, persistent volume และ restart บน staging ก่อนใช้จริง |
| ต้องเตรียมข้อมูลก่อนย้าย | รูป 90 รายการมี `storage_path` แต่หาไฟล์สำเนาบนดิสก์ไม่พบ 85 รายการ ในจำนวนนี้มี 10 รูปที่ยังมีการอ้างอิง | คืนหรือสร้างสำเนาจาก blob ในฐานข้อมูล หากต้องการให้โหมด `database_copy` ครบ แล้วสำรองข้อมูลทั้งชุดก่อนย้าย |
| ยังไม่ตรวจ | ไม่มีปลายทาง production/โดเมนให้ตรวจ จึงยังไม่ยืนยัน TLS, reverse proxy, Secure cookie, resource limits และแผนกู้คืนของเครื่องจริง | ตรวจ HTTPS และทดสอบสำรอง/กู้คืนบน staging ของเครื่องปลายทาง |

ผล dependency audit เป็นการยืนยันรุ่นที่อยู่ในช่วง affected ของ advisories ไม่ใช่หลักฐานว่าทุกช่องโหว่โจมตีแอปนี้ได้สำเร็จ ไม่ได้ทำ exploit test กับระบบจริง รายละเอียดทั้งหมดอยู่ใน [dependency audit](evidence/dependencies.json) ผู้พัฒนา Next.js เผยแพร่ [ประกาศความปลอดภัย 14 ตุลาคม 2569](https://nextjs.org/blog/nextjs-security-update-october-14-2026) และ [advisory middleware bypass](https://github.com/vercel/next.js/security/advisories/GHSA-f82v-jwr5-mffw) ไว้แล้ว ต้องพิจารณา advisory ล่าสุดทั้งหมดเมื่อเลือกรุ่นอัปเกรด

ไฟล์สำเนารูปที่หายไม่ทำให้รูปต้นฉบับหาย: endpoint รูปอ่าน blob จาก SQLite และตรวจพบว่า blob ของรูปทั้ง 96 รายการยังมีข้อมูล การสแกน references ทั้งตารางและ configuration พบรูปที่ถูกอ้างอิง 20 รายการและไฟล์ 4 รายการ ไม่มี reference ที่ชี้ไปยัง blob ที่หาย พบรูป 76 รายการไม่มี reference ปัจจุบัน ซึ่งอาจเป็นข้อมูลเก่าหรือเกี่ยวข้องกับงานร่าง/สำรอง จึงไม่ได้ลบ ดู [หลักฐานสื่อ](evidence/media.json)

## ผลทดสอบ

| รายการ | ผล |
|---|---|
| Unit/library tests | 392 ผ่าน, 0 ไม่ผ่าน |
| Production build รวม compile และ typecheck | ผ่าน หลังแก้ PWA branding |
| Production API tests | 15 ผ่าน, 0 ไม่ผ่าน |
| Production integration/browser suites | ผ่าน 15 ชุด ตามรายการด้านล่าง |
| SQLite ปัจจุบัน | `quick_check=ok`, foreign-key violations 0 |
| สุขภาพ configuration ของ 2 แอป | ตรวจ 145 จุด รวมสูตรกับข้อมูลตัวอย่างไม่เกิน 10 แถวต่อตาราง: errors 0, warnings 0 |
| Automation ปัจจุบัน | 5 jobs เป็น succeeded, ไม่พบ failed jobs |
| Backup เดิมล่าสุด | quick_check ผ่าน, foreign-key violations 0; สร้าง 1 พ.ย. 2569 เวลา 22:21 น. กรุงเทพฯ ยังต้องสำรองใหม่ก่อนปล่อยจริง |
| Docker Compose HTTP/HTTPS | ตรวจ config ผ่าน; container จริงยังไม่ทดสอบ |

15 ชุด production ที่ผ่าน: `api`, `attachmentboundary`, `buildersecurity`, `readiness`, `deferredimages`, `relatedexpression`, `workflows`, `auth`, `permissions`, `concurrentedit`, `readinessperf`, `safety`, `pwa`, `exceltext`, `exceloptions` ดู [ผลรวม](evidence/results.json) และ log แยกใน [evidence](evidence/)

ครอบคลุม authentication/CSRF/session expiry, สิทธิ์และการแยกไฟล์ข้ามแอป, ฉบับร่าง/เผยแพร่/ย้อน configuration, รูปฟอร์มแม่–ลูกและ rollback/retry, สูตร Related, PDF ภาษาไทย/รูป/ลายเซ็น, Excel import/export (preview, rollback, leading zeros, สิทธิ์ส่งออกและ row policies), webhook ไป fixture ภายใน, backup/download/restore/schema recovery, concurrent edit 409 และรักษาค่าฟอร์ม, PWA login/scope/update/offline/cache

ผล performance บน production build กับข้อมูลสังเคราะห์ 10,000 แถว: API page 9 ms, ค้นหาบน mobile viewport 295 ms, Dashboard เริ่มแสดง 163 ms และ render เริ่มต้น 200 แถว เป็นผลเครื่องพัฒนา ไม่ใช่ SLA หรือผลทดสอบโหลดหลายผู้ใช้บน VPS ทดสอบเครือข่ายขาดพบว่าค่าฟอร์มยังอยู่และไม่มี mutation retry อัตโนมัติ ดู [performance log](evidence/readinessperf.log)

## สิ่งที่แก้ระหว่างตรวจ

1. **PWA login แสดงชื่อแอปผิดหลัง hydration**: server ส่งชื่อ installation ถูกต้อง แต่ client โหลด branding ของแอปกลางมาทับ แก้ AppSettingsProvider ให้ guest PWA ใช้ branding ที่ server ส่งมา มี [ผลทดสอบก่อนแก้](evidence/pwa-before-fix.log) และ [หลังแก้](evidence/pwa.log) โดยผ่านการ login, reload, update และ offline ด้วย
2. **API tests ใช้ฐานข้อมูลร่วมและรบกวนกัน**: เมื่อรันไฟล์พร้อมกัน ชื่อ View ที่ลบอาจถูกอีกชุดนำไปใช้ใหม่ก่อน assertion จึงรัน API files ทีละชุดด้วย `--test-concurrency=1` ไม่ได้เปลี่ยนกฎสร้างชื่อ View ในแอป มี [ผลเดิม](evidence/api-initial-failure.log) และ [ผลรันทีละชุด 15/15](evidence/api.log)
3. **Safety browser test อ้าง UI เก่า**: ระบุ success banner ให้ชัดเจนแทน role status ที่มีสองรายการ ปรับ URL หลัง login จาก `/` เป็น `/data` ตาม redirect ปัจจุบัน และตรวจ sidebar ตารางในหน้า Data ก่อนกลับหน้าสำรอง ทดสอบจริงครบ backup/restore และสิทธิ์ session หลัง restore ดู [ผลผ่าน](evidence/safety.log)

ไม่ได้เปลี่ยน dependencies หรือข้อมูลจริงระหว่างตรวจ การทดสอบ browser ใช้ Chrome/Chromium desktop และ touch mobile emulation; iPhone/Safari/PWA บนอุปกรณ์จริงยังไม่ได้ตรวจ การตรวจสูตรข้อมูลตัวอย่างไม่ยืนยันว่าทุกแถวในฐานข้อมูลผ่านเงื่อนไข

## ลำดับดำเนินการก่อน release

1. แก้ dependency security findings และตรวจซ้ำกับโค้ดรุ่นที่จะปล่อย
2. เตรียมสำเนารูปที่ขาด สำรอง SQLite อย่างถูกต้องพร้อม uploads และงานร่างที่ต้องย้าย แล้วทดลองกู้คืนบน staging
3. ทดสอบ Linux/Docker และ HTTPS บนเครื่องปลายทาง ตรวจสิทธิ์ผู้ใช้จริงตามบทบาทโดยใช้บัญชีทดสอบ
4. ตรวจกล้อง/อัปโหลด/บันทึก/ยกเลิกบนอุปกรณ์จริง จึงตัดสินใจปล่อยและเตรียม rollback ของ release นั้น
