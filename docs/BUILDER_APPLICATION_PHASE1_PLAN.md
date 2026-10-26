# แผนระยะ 1: แยก Builder และ Application

สถานะ: แผนพัฒนา ยังไม่มีการเปลี่ยนระบบล็อกอินหรือย้ายฐานข้อมูลจริงในงานวางแผนนี้
วันที่: 26 ตุลาคม 2026

## เป้าหมายและข้อสรุป

ใช้โดเมนเดียว บัญชีผู้ใช้กลางชุดเดียว แยก session และสิทธิ์ Builder/Application ผู้ใช้ Application ล็อกอินครั้งเดียวและเข้าได้เฉพาะแอปที่ได้รับอนุญาต ผู้พัฒนาเห็นและแก้ไขได้เฉพาะแอปที่ได้รับมอบหมาย

URL ระบุแอปโดยตรง การเปิดแอป A และ B คนละแท็บไม่เปลี่ยนบริบทของกันและกัน การใช้ cookie เป็นตัวเลือกแอปกลางจะเลิกเป็นแหล่งอ้างอิงหลักของเส้นทางใหม่

## สิ่งที่พบในโค้ดปัจจุบัน

- lib/auth.ts ใช้ nocode_session และตาราง _sessions ร่วมกัน ยังไม่มีชนิดของ session
- _users.role เป็นบทบาทส่วนกลางหนึ่งค่าต่อคน และ _roles.builder เป็นสิทธิ์ผู้พัฒนาส่วนกลาง
- lib/permissions.ts ให้ owner/builder มีสิทธิ์ข้อมูลกว้าง จึงต้องแยกการคำนวณสิทธิ์ runtime จากสิทธิ์การแก้ไขแอป
- _application_roles กำหนดสิทธิ์เข้าแอปและ builder ตามบทบาท ยังไม่มีการมอบหมายผู้พัฒนารายบุคคลแยกต่างหาก
- lib/application-context.ts และ lib/auth-api.ts มีขอบเขตข้อมูลรายแอปแล้ว นำมาต่อยอดได้
- nocode_app เป็นแอปที่เลือกทั้งเบราว์เซอร์ ปัจจุบันตรวจแท็บเก่าด้วย 409 แทนการรองรับหลายบริบทอิสระ
- app/layout.tsx และ AuthProvider รวมหน้าจอ Builder/runtime และมีข้อมูล session/cache ที่ต้องแยก
- middleware.ts ส่ง pathname ให้ server layout และไม่เข้าถึง SQLite คงการค้นหา slug ใน server runtime
- createSession ใช้ INSERT INTO _sessions VALUES แบบเรียงคอลัมน์ ต้องเปลี่ยนเป็นระบุชื่อคอลัมน์ก่อนเพิ่ม schema

## URL ที่กำหนดใช้

| URL | ผู้ใช้/หน้าที่ |
| --- | --- |
| /builder/login | เข้าสู่ระบบ Builder |
| /builder/apps | แอปที่มีสิทธิ์จัดการ |
| /builder/apps/[appId]/settings | ตั้งค่าแอปที่เลือก |
| /builder/apps/[appId]/data | ตารางของแอป |
| /builder/apps/[appId]/views | Views ของแอป |
| /builder/apps/[appId]/actions | Actions ของแอป |
| /builder/apps/[appId]/workflows | Automation ของแอป |
| /builder/users | ผู้ใช้และการมอบหมายแอปส่วนกลาง สำหรับ Admin |
| /builder/backups | ข้อมูลสำรองส่วนกลาง สำหรับ Admin |
| /apps | แอปที่มีสิทธิ์ใช้งาน หลังล็อกอิน Application |
| /inspection/login | ล็อกอิน Application แล้วกลับแอป Inspection |
| /inspection | หน้าหลักของแอป Inspection |
| /inspection?view=...&row=... | ลิงก์เข้า View/แถวโดยตรง ใช้รูปแบบพารามิเตอร์เดิมเท่าที่ทำได้ |

หน้า / ส่งไป /builder/apps เมื่อมี Builder session ที่ใช้ได้ มิฉะนั้นไป /builder/login ผู้ใช้ Application เข้าจาก URL ของแอปหรือ /apps

ใช้เส้นทางแอปแบบ /[slug] ตามคำขอ โดยสงวนชื่อ builder, apps, api, login, run, settings, data, views และเส้นทางเดิม/ระบบทั้งหมด ตรวจชนกับเส้นทางย่อยและ public assets ก่อนบันทึก หากมี base path เช่น /app-builder ให้ใช้ helper สร้าง URL ทุกแห่งและทดสอบ base path แยก ไม่เขียน origin หรือ prefix ตายตัว

## รหัสแอปและ slug

- เก็บ appId ภายในเดิมไว้ ผูก Ref, ตาราง, Views, Automation, releases และ grants กับ ID เดิม
- เพิ่ม slug ที่ unique แบบไม่แยกตัวพิมพ์ใหญ่เล็ก ใช้อักษรอังกฤษตัวเล็ก ตัวเลข และขีดกลาง จำกัดความยาวและป้องกันชื่อสงวน
- ชื่อแสดงเปลี่ยนได้โดยไม่เปลี่ยน slug ระยะ 1 ยังไม่เปิดเปลี่ยน slug หลังใช้งาน เพื่อลดลิงก์เสีย
- แอปเดิมได้ slug จากการย้ายข้อมูลแบบตรวจชน ใช้ app-ID ที่ปลอดภัยเป็น fallback หากแปลงชื่อไม่ได้
- ค้น slug -> appId ฝั่ง server ก่อนตรวจสมาชิกและอ่านการตั้งค่า ระบุแอปผิด/ไม่มีสิทธิ์ต้องไม่หล่นไปใช้ default

## บัญชีและ session

บัญชีและรหัสผ่านใช้ _users เดิม ไม่มีการคัดลอกหรือแยกรหัสผ่านต่อแอป

- Builder session: cookie nocode_builder_session
- Application session: cookie nocode_runtime_session ใช้ร่วมกันได้ระหว่างแอปบนโดเมนเดียว
- เพิ่ม purpose ใน _sessions และบังคับตรวจ purpose ฝั่ง server ทุกครั้ง session ฝั่งหนึ่งแทนอีกฝั่งไม่ได้
- เส้นทาง API แยกฝั่งเป็นตัวตัดสินว่าจะใช้ session ไหน ไม่มีการเลือก cookie ตามลำดับว่าอันไหนมีสิทธิ์มากกว่า
- HttpOnly, SameSite, Secure บน HTTPS, อายุ session, idle timeout, CSRF/same-origin และการจำกัดความถี่ล็อกอินยังต้องครบ
- ล็อกเอาต์ Builder กระทบ Builder session ปัจจุบันเท่านั้น ล็อกเอาต์ Application กระทบ Application session ปัจจุบันและทุกแอปใน session นั้น
- ปุ่มออกจากทุกอุปกรณ์ต้องระบุขอบเขตให้ชัดเจน การปิดบัญชีหรือเปลี่ยนรหัสผ่านเพิกถอน session ทั้งสองฝั่งตามนโยบายเดิมที่ตรวจแล้ว
- อนุญาตให้ Builder และ Application ล็อกอินคนละบัญชีในเบราว์เซอร์เดียวกัน UI ต้องแสดงบัญชีของแต่ละฝั่งอย่างถูกต้อง
- next/returnTo รับเฉพาะ URL ภายในที่อนุญาตและตรวจสิทธิ์ปลายทาง ป้องกันวนกลับ login และการข้ามไป Builder ด้วย runtime session

## แบบสิทธิ์เป้าหมาย

| ประเภท | สิทธิ์ |
| --- | --- |
| Platform Admin | จัดการแพลตฟอร์ม บัญชี การมอบหมาย และทุกแอปผ่าน Builder |
| Builder User | แก้ไขเฉพาะแอปที่ Admin มอบหมาย ไม่จัดการบัญชีหรือข้อมูลสำรองส่วนกลาง |
| Application User | เข้าแอปที่เป็นสมาชิก ใช้ข้อมูลตามบทบาทของแอปนั้น |

แยกสิทธิ์ can_manage_app และ can_use_app ออกจากกัน การจัดการแอปไม่สร้าง runtime membership อัตโนมัติ Admin ต้องกำหนดสิทธิ์ใช้งานด้วยหากต้องการใช้งานฝั่ง Application

เพิ่มการมอบหมายผู้พัฒนารายคนต่อแอป และ membership/role ของผู้ใช้รายแอป คนเดียวกันมีบทบาทต่างกันในแอป A/B ได้ บทบาท runtime กำหนดสิทธิ์ตาราง/แถว/Action/Excel แยกตาม appId ไม่ใช้ global builder หรือ owner เป็นทางข้ามสิทธิ์ runtime

ชื่อ App Admin หากเพิ่มในอนาคตต้องเป็นบทบาทการใช้งานของแอปที่มีขอบเขตชัดเจน ไม่เท่ากับ Platform Admin ระยะ 1 ใช้ชื่อ Platform Admin / Builder User และบทบาทใช้งานเดิมที่ย้ายมารายแอป

ขอบเขตตารางที่แอปเชื่อมไว้ยังเป็นเพดานสูงสุดของสิทธิ์ แม้ runtime role อนุญาตตาราง ก็ใช้ไม่ได้หากแอปไม่เชื่อมตารางนั้น

## ขอบเขต API และการใช้งานหลายแท็บ

- เส้นทางใหม่ใช้ /api/builder/apps/[appId]/... สำหรับ metadata/configuration และ /api/apps/[appId]/... สำหรับ runtime
- Runtime API ตรวจ runtime session + membership + role/row grants + dataset ceiling ส่วน Builder API ตรวจ Builder session + assignment + สิทธิ์เมนู
- การอ่าน Views/settings ที่จำเป็นต่อ runtime ต้องคืนเฉพาะข้อมูลสำหรับแสดงผล ไม่เปิดให้แก้ configuration
- appId ใน URL เป็นบริบทหลัก ตรวจให้ตรงกับ appId/slug ที่ render ไว้ใน client ไม่เชื่อ header จาก client เป็นหลักฐานสิทธิ์
- appId ที่ไม่มีอยู่/ไม่มีสิทธิ์ต้องปฏิเสธ ไม่ fallback default ไม่ใช้ cookie แอปจากแท็บอื่น
- แยก cache ตาม purpose, user, appId, workspace และสิทธิ์ รวม IndexedDB, pending upload, realtime, drafts และรายการที่ค้างบันทึก
- การเปลี่ยนแอปฝั่งหนึ่งไม่เปลี่ยนบริบทอีกฝั่ง เปิดสองแอปพร้อมกันได้โดยไม่ต้องใช้การแจ้งเตือนเปลี่ยนแอปแท็บอื่นแบบเดิม
- ผูก draft กับ appId และผู้พัฒนา ไม่ให้ draft cookie ของแอป A ทำให้แอป B เปลี่ยน workspace
- Audit ระบุ actor, appId, purpose และ operation งาน Automation ตรวจสมาชิก/สิทธิ์ actor ตามขอบเขตการเรียก ไม่ใช้ session ฝั่ง Builder เป็นทางลัดของ runtime

## ลำดับการพัฒนาและเงื่อนไขผ่าน

| ขั้น | งาน | ผ่านเมื่อ |
| --- | --- | --- |
| 1 | ทำแผนผังเส้นทาง/API เดิม จัดประเภท builder/runtime/platform/shared และนิยามสิทธิ์ | มีรายการทุก endpoint รวมไฟล์ รูปภาพ SSE โปรไฟล์ สูตร Excel และ preview พร้อมวิธีตรวจสิทธิ์ |
| 2 | เพิ่ม schema slug, session purpose, builder assignments, memberships และ app roles | migration บนสำเนาทดสอบซ้ำได้ ไม่มี ID/Ref เปลี่ยน ไม่มีสิทธิ์เพิ่มโดยไม่ได้กำหนด |
| 3 | แยก auth service/API/cookie/login/logout/session providers | runtime session ใช้ Builder ไม่ได้ และสองบัญชีต่างฝั่งอยู่ร่วมกันได้ |
| 4 | เพิ่ม app-aware routes และ API; สร้าง URL helper | /inspection/login กลับแอปถูกต้อง เปิด A/B พร้อมกันได้ และ next ปลายทางถูกตรวจ |
| 5 | แยก layouts/menus และหน้ามอบหมายสิทธิ์ | Builder เห็นแอปที่จัดการได้ Application เห็นแอปที่ใช้ได้ เมนูส่วนกลางเฉพาะ Admin |
| 6 | ผูก runtime navigation, Ref/inline/form, files, Excel, realtime, caches, worker และ releases | เปิด/กลับ/บันทึกใน inline ถูกแอป แชร์ตารางตาม grants โดยไม่รั่ว configuration |
| 7 | Compatibility routes และทดสอบ migration/regression/security/performance | ลิงก์เก่าเข้าปลายทางที่ถูกต้อง ลิงก์กำกวมพาเลือกแอป การปิดสิทธิ์มีผลกับ API/SSE |
| 8 | ทดลองกับสำเนาข้อมูลจริงและตรวจรับ แล้วเตรียม release | มี migration report, backup ที่ตรวจไฟล์ได้, rollback ที่ทดลองแล้ว และรายการตรวจรับผ่าน |

ขั้น 1–2 เป็นงานเริ่มต้นของการลงมือพัฒนา ขั้น 3–6 ทำเป็นชุดย่อยที่ทดสอบได้ เปิดใช้งานเส้นทางใหม่เมื่อชุดควบคุมสิทธิ์ครบ ไม่เปิดใช้หน้า login ใหม่ก่อนที่ API จะแยกขอบเขตจริง

## ย้ายจากระบบเดิมและการเปิดใช้งาน

1. สำรองไฟล์ฐานข้อมูลและรายงาน app/role/user ก่อน migration ทดสอบบน .test-data หรือสำเนาที่ระบุชัดเท่านั้น
2. ย้าย owner เดิมเป็น Platform Admin และแปลงสิทธิ์ Builder เดิมเป็น assignment รายแอป
3. ย้าย runtime rights เดิมเป็นบทบาท/สมาชิกต่อแอปที่แต่ละคนเข้าได้ รวม default app โดยเก็บพฤติกรรมเดิมให้ตรวจรับได้ ไม่อนุมานว่า Builder User เข้า runtime ได้ทุกแอปใหม่
4. ออกรายงานสิทธิ์ก่อน–หลัง โดยเฉพาะ owner/builder ที่เดิมข้าม data grants และ default app ที่เดิมเข้าถึงได้ตาม role ส่วนกลาง
5. ไม่ยกระดับ cookie เก่าเป็น Builder session อัตโนมัติ การย้ายบังคับลงชื่อเข้าใช้ใหม่ แสดงข้อความอธิบายและไม่ทำขณะมีฟอร์มค้างบันทึก
6. /login, /run?app=..., /settings, /data, /views และลิงก์ View/แถวเก่าใช้ adapter ไปเส้นทางใหม่ แต่ยังตรวจ session purpose และสิทธิ์ ไม่ใช้ fallback ที่ข้ามการตรวจ
7. API เดิมที่รับข้อมูลค้างจาก client เก่าต้องปฏิเสธอย่างปลอดภัยหรือรองรับแบบมีขอบเขต ห้ามรับ session เก่าเป็นสิทธิ์จัดการโดยปริยาย
8. ยังไม่เปลี่ยน/ลบตารางธุรกิจหรือสร้างแถวทดสอบในฐานข้อมูลจริง การ deploy/migrate จริงแยกจากการพัฒนาและตรวจโค้ด

## ชุดตรวจรับหลัก

- Runtime-only user เปิดหน้าและ API ของ Builder ไม่ได้ แม้พิมพ์ URL เอง
- Builder User จัดการแอป A ได้ แต่จัดการแอป B หรือแพลตฟอร์มไม่ได้
- คนเดียวกันแก้ข้อมูล A ได้ และอ่าน B ได้อย่างเดียว ตรวจทั้งตาราง แถว Ref Action Excel และไฟล์
- คนที่จัดการ A ได้แต่ไม่มี runtime membership เข้า Application A ไม่ได้
- เปิด A/B คนละแท็บ บันทึกในแต่ละแอปไม่สลับข้อมูล ไม่ล้าง cache/draft ของอีกแอป
- Builder บัญชีหนึ่งและ Application อีกบัญชีในเบราว์เซอร์เดียว แสดงบัญชี/สิทธิ์/โปรไฟล์ถูกต้อง
- หน้า /inspection/login ใช้ branding ที่อนุญาตเผยแพร่เท่านั้น ล็อกอินแล้วกลับ View/row ปลายทางที่ได้รับสิทธิ์
- slug ซ้ำ ชื่อสงวน slug ไม่ถูกต้อง appId ปลอม next ภายนอก และ session ผิด purpose ถูกปฏิเสธ
- ลบสมาชิก เปลี่ยนสิทธิ์ ปิดบัญชี session หมดอายุ และ logout แต่ละขอบเขตมีผลตรงกันใน API/realtime/worker
- ทดสอบ Regression เดิมของ inline forms, Ref create, navigation, durations, formulas, PDF, Automation, Excel และ releases
- ตรวจ desktop/mobile และ iPhone จริงเรื่อง keyboard/header/back navigation โดยไม่อ้างผลจำลองแทนอุปกรณ์จริง
- วัดก่อน–หลังเรื่องจำนวน request, API latency และจำนวน query ตรวจสิทธิ์ ไม่สแกนทุกแอปต่อ request

## การกู้กลับและข้อจำกัดที่ยังคงอยู่

ทดสอบ rollback บนสำเนาให้ครบทั้ง schema และ app build ห้ามสลับกลับโค้ดเก่าที่จะตีความสิทธิ์ใหม่ผิด หลังเปิดจริงแล้วมีข้อมูลเขียนเพิ่ม ห้ามกู้ไฟล์เก่าทับเพื่อ rollback โดยไม่วางแผนรักษาข้อมูลที่เพิ่มขึ้น

การพัฒนานี้ไม่รวมการทำ multi-app restore ซึ่งยังติดข้อจำกัดที่บันทึกใน MULTI_APP_IMPLEMENTATION.md และไม่อนุญาตให้ทดลอง restore ฐานข้อมูลจริง ระบบสำรอง/ตรวจไฟล์และ guard เดิมต้องยังทำงาน การ restore ต้องตรวจ schema ใหม่ก่อนแตะข้อมูล

## งานที่เลื่อนไประยะถัดไป

- SSO ข้ามโดเมนและผู้ให้บริการภายนอกผ่าน OpenID Connect
- บัญชีผู้ใช้แยกองค์กร/tenant, แยกฐานข้อมูล/เซิร์ฟเวอร์ และระบบคิดค่าบริการ
- เลือกบังคับยืนยันตัวตนใหม่เฉพาะแอป, MFA และนโยบาย login ต่อองค์กร
- เปลี่ยน slug พร้อม aliases และ redirects สำหรับลิงก์เก่า
- App Admin ที่จัดการสมาชิกได้เฉพาะแอป โดยไม่มีสิทธิ์แก้โครงสร้าง Builder

## ผลส่งมอบระยะ 1

หน้า Builder login/apps/assignment, หน้า Application login/runtime/launcher, สิทธิ์และ session แยกกัน, URL รายแอป, migration/report/compatibility adapters, ชุดทดสอบและคู่มือการใช้งาน โดยใช้บัญชีกลางและโดเมนเดิม
