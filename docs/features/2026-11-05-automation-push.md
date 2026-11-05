# Push Notification ใน Automation

เพิ่มขั้นตอน Push Notification ในคิว Automation เดิม พร้อมการสมัครรับแยกผู้ใช้/แอป/เซสชัน/อุปกรณ์ ไม่ต้องใช้บัญชี Firebase เพิ่ม แต่ต้องตั้งค่า VAPID และเปิดผ่าน HTTPS (localhost ใช้พัฒนาได้)

## ตั้งค่าเซิร์ฟเวอร์

สร้างคีย์เพียงครั้งเดียวจาก checkout นี้ โดยไม่พิมพ์ private key ลง console และไม่เขียนทับไฟล์เดิม:

```sh
node scripts/push-keys.cjs .env.push
```

ถ้า VPS มีเฉพาะ Docker และยังไม่มี Node:

```sh
docker run --rm -v "$PWD:/work" -w /work node:22-bookworm-slim node scripts/push-keys.cjs .env.push
```

แก้ `NOCODE_PUSH_SUBJECT` ในไฟล์ให้เป็นอีเมลติดต่อจริง เช่น `mailto:admin@your-domain.com` เก็บไฟล์นี้เป็นความลับและสำรองอย่างปลอดภัย อย่าสร้างคีย์ใหม่ทุกครั้งที่ deploy คีย์ทั้งคู่ต้องอยู่ชุดเดียวกัน และ private key ต้องไม่ใช้ชื่อที่ขึ้นต้นด้วย NEXT_PUBLIC

`compose.yaml` ส่งตัวแปรต่อไปนี้เข้า container แล้ว:

```text
NOCODE_PUSH_SUBJECT
NOCODE_PUSH_PUBLIC_KEY
NOCODE_PUSH_PRIVATE_KEY
```

เมื่อพร้อม deploy ด้วยตัวเอง ให้ใช้ไฟล์ Compose ชุดเดิมและเพิ่ม env file ของ Push ตัวอย่างสำหรับชุด Nginx เดิม:

```sh
docker compose --env-file .env.docker --env-file .env.push -f compose.yaml -f compose.nginx.yaml up -d --build app
```

ตัวอย่างนี้เป็นคำแนะนำ ไม่ได้รัน deploy หรือแก้ credentials/ฐานข้อมูลจริงระหว่างพัฒนา ไฟล์ `.env.push` ถูก ignore ใน Git และ `.env*` ถูกตัดออกจาก Docker build context อยู่แล้ว

พัฒนาในเครื่องโดยโหลด env file แยกได้:

```sh
node --env-file=.env.push node_modules/next/dist/bin/next dev
```

## เปิดรับบนอุปกรณ์

1. เข้าสู่แอปและเปิด **โปรไฟล์ของฉัน > Push Notification**
2. กด **เปิดรับแจ้งเตือนบนอุปกรณ์นี้** แล้วอนุญาตสิทธิ์ของเบราว์เซอร์/ระบบปฏิบัติการ
3. iPhone/iPad ต้อง Add to Home Screen และเปิดจากไอคอนแอปก่อน (รองรับตั้งแต่ iOS/iPadOS 16.4)

ต้องเปิดรับแยกแต่ละอุปกรณ์ การออกจากระบบ/ออกจากระบบทุกอุปกรณ์/เพิกถอนเซสชันทำให้ subscription ของเซสชันนั้นถูกลบด้วย foreign-key cascade เซสชันหมดอายุหรือผู้ใช้ถูกปิดใช้งานจะไม่ถูกส่ง การกลับมา login ต้องเปิดรับใหม่หากสิทธิ์ฝั่งเซิร์ฟเวอร์ถูกยกเลิกไปแล้ว

การเปิดรับตรวจ/เปิดใช้งาน Service Worker รุ่นใหม่โดยไม่สั่ง reload หน้า เพื่อไม่ทิ้งฟอร์มที่กำลังกรอก ไม่มีการขอสิทธิ์แจ้งเตือนอัตโนมัติเมื่อเปิดหน้า

## ตั้งค่า Automation

ใช้ **การทำงานเบื้องหลัง** แล้วเพิ่มขั้นตอน **Push Notification** รองรับ manual/create/update/delete/schedule; ยังไม่รองรับ Sync trigger และไม่ส่งภายในธุรกรรมบันทึกแถว

ตัวอย่าง:

```text
ผู้รับ: LIST(USERID())
หัวข้อ: "มีรายการตรวจใหม่"
ข้อความ: CONCATENATE("เลขที่ ", [inspection_no])
```

ส่งให้ผู้รับจากคอลัมน์ชนิด User:

```text
LIST([assigned_user])
```

ผู้รับต้องเป็น User ID หรือ LIST ของ User IDs ไม่ใช่อีเมล เลือก View ของตารางเดียวกันเพื่อเปิดเมื่อกดแจ้งเตือน หรือเว้นว่างให้เปิดหน้าแรก การแจ้งเตือนลบข้อมูลจะไม่แนบ row ที่ถูกลบ

สูตรผู้รับคำนวณในบริบทผู้สั่งงาน ส่วนหัวข้อ/ข้อความคำนวณตามสิทธิ์ของผู้รับ โดยตรวจ app membership, active account, session, table read และ row policy ใหม่ก่อนส่ง สูตรข้ามตารางจึงไม่ข้ามสิทธิ์ผู้รับ หาก View ถูกซ่อนสำหรับผู้รับ ลิงก์จะกลับหน้าแรกของแอป

ข้อความอาจปรากฏบนหน้าจอล็อก อย่าใส่ความลับที่ไม่ควรแสดงบนอุปกรณ์ ส่วน Simulation เป็นเพียงตัวอย่างตามบริบทผู้ทดสอบ และไม่ส่งเครือข่ายจริง

## ผลการทำงานและขอบเขต

- ประวัติ Automation แสดงจำนวนอุปกรณ์ที่ส่ง ข้าม และหมดอายุ การรับคำขอของ Push provider ไม่ยืนยันว่า OS แสดงหรือผู้ใช้อ่านแล้ว
- ไม่มีอุปกรณ์ที่สมัครไว้: สำเร็จ 0 พร้อมจำนวนข้าม ไม่มี VAPID: งานล้มเหลวพร้อมข้อความให้ตั้งค่า
- ส่งสูงสุด 100 ผู้ใช้ / 500 อุปกรณ์ต่อขั้นตอน, 10 อุปกรณ์ต่อผู้ใช้ต่อแอป, concurrency 4, timeout 10 วินาที, provider TTL 1 ชั่วโมง
- ข้อมูลรวมไม่เกิน 3 KB; หัวข้อไม่เกิน 120 และข้อความไม่เกิน 1,000 ตัวอักษร
- HTTP 404/410 ลบ subscription ที่หมดอายุ อุปกรณ์อื่นยังดำเนินการต่อได้
- Receipt แยก job/step/subscription ป้องกันส่งซ้ำในการ resume งานเดิม เก็บ 30 วันและล้างเป็นชุดพร้อมดัชนีตามเวลา
- หากเริ่มส่งแล้วแต่ผลไม่แน่นอน จะไม่ลองส่งอุปกรณ์นั้นซ้ำอัตโนมัติ การเริ่มงานใหม่อาจทำให้ผู้รับได้รับซ้ำหากคำขอเดิมสำเร็จแล้ว จึงไม่อ้าง exactly-once delivery
- จำกัด endpoint เฉพาะ HTTPS ของบริการ Chrome/Edge, Firefox และ Apple ที่รองรับ ไม่รับ URL ภายในเครือข่ายหรือ provider ที่ตั้งเองในรุ่นนี้
- Service Worker เปิดลิงก์เฉพาะ origin และ app scope เดิม และเปิดหน้าต่างใหม่เมื่อไม่มีหน้าที่ตรงลิงก์ เพื่อหลีกเลี่ยงการ navigate ทิ้งฟอร์มอื่น

## สถาปัตยกรรม / ความปลอดภัย / สำรองข้อมูล

- ใช้ WorkflowStep/validation/formula engine/worker/checkpoint เดิม มีเพียง step `push` เพิ่มขึ้น ไม่มี Action engine ใหม่
- `_push_subscriptions` และ `_push_deliveries` เป็น platform tables แต่ระบุ app ID ชัดเจน API `/api/push` ให้จัดการเฉพาะของผู้ใช้ที่ login ในแอปปัจจุบัน ไม่ส่ง endpoint/keys ของอุปกรณ์อื่นออกมา
- subscription ผูก session hash ไม่เก็บ session token โดยตรง VAPID private key อยู่ใน environment และถูกห้ามนำไปใช้เป็น Webhook bearer
- ไม่เก็บข้อความแจ้งเตือนหรือข้อมูล provider error ที่อาจมี endpoint/token ใน delivery ledger หรือ Automation output
- สำรองแยกแอป/clone ไม่ย้าย subscriptions ไปด้วย Full backup เป็นข้อมูลอ่อนไหวและอาจมี device capabilities; การ restore ไม่ติดตั้ง subscriptions/receipts จากไฟล์และเพิกถอนเซสชันเดิม
- ใช้ `web-push` 3.6.7 (MPL-2.0) และ `@types/web-push` 3.6.4 ไม่มีการเปลี่ยนแปลงซอร์สของแพ็กเกจ

## หลักฐานการตรวจสอบ

- `.test-data/push-unit.log`: **481 passed, 0 failed, 7 platform skips** รวม encryption request generation, endpoint validation, ownership, session cascade, actual recipient row-policy checks, duplicate/ambiguous attempts, worker push/click handlers และ key-file helper
- `.test-data/push-build.log`: production webpack build **passed**
- `.test-data/push-push.log`: **passed** — Automation/Profile UI, queue แบบไม่มีอุปกรณ์, subscription API ของ owner/ผู้ใช้ที่ไม่ใช่ builder, การแยกเจ้าของ, Service Worker registration จริงในเบราว์เซอร์, เปิด/ปิดผ่านโปรไฟล์ (mock เฉพาะ permission/PushManager เพื่อไม่ติดต่อ provider) และ logout cascade
- `.test-data/push-workflows.log`, `push-workflowdesigner.log`, `push-profile.log`: regression ของระบบเดิม **ผ่านทั้งสามชุด**
- Integration Push บล็อก HTTPS ออกภายนอกด้วย test-only guard เพื่อไม่ส่งจริงไปยัง provider
- **Not Tested:** ส่งผ่าน provider จริงถึงมือถือ/หน้าจอล็อกจริงและ permission prompt บนอุปกรณ์จริง ต้องตั้งค่าเซิร์ฟเวอร์และเปิดรับบนอุปกรณ์ก่อนตรวจขั้นสุดท้าย
- ชุด PWA browser เก่า (`.test-data/push-pwa.log`) หยุดที่ selector `.auth-brand` ซึ่งไม่พบในหน้า Login ปัจจุบัน จึงไม่ถือว่าชุดนั้นผ่าน ส่วน scope/registration และ push/click handler ตรวจแยกตามรายการข้างต้น

ไม่มีการแก้ฐานข้อมูล Production, credentials จริง หรือ deploy ในงานนี้

## เอกสารอ้างอิง

ตรวจสอบวันที่ 2026-11-05:

- [Apple: Sending web push notifications](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers)
- [WebKit: Web Push for iOS and iPadOS](https://webkit.org/blog/13878/)
- [web-push official README](https://github.com/web-push-libs/web-push/blob/master/README.md)
- [Docker Compose: multiple env files and interpolation](https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/)
