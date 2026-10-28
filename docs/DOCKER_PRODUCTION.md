# Docker Compose บน Linux VPS

ชุดนี้รันแอพ 1 container/process พร้อม Chromium สำหรับ PDF, SQLite บน local named volume และ Caddy ด้านหน้า ไม่ใช้ PM2 และไม่เปิดพอร์ตแอพ 3000 สู่ภายนอก

## ไฟล์

- `Dockerfile`: Node 22 Debian, build แบบ production, runtime เป็น user `node` (UID 1000), Chromium/ฟอนต์ไทยสำหรับ PDF
- `compose.yaml`: HTTP บน `127.0.0.1:8080` สำหรับทดสอบ/SSH tunnel, restart policy, resource limits, log rotation
- `compose.https.yaml`: ใช้ร่วมไฟล์หลักเพื่อเปิด HTTPS จริง, ต้องการ Docker Compose >= 2.24.4
- `.env.docker.example`: ตัวอย่าง config ไม่มีข้อมูลบัญชีหรือข้อมูลจริง
- `deploy/backup.sh`: สำรอง data volume ทั้งชุดแบบหยุดแอพชั่วคราว
- `scripts/docker-smoke.cjs`: ทดสอบแยก project/volume อัตโนมัติ ไม่แตะ deployment เดิม

## 1. เตรียม VPS และ config

ติดตั้ง Docker Engine + Compose plugin ให้เรียบร้อย ตรวจด้วย `docker version` และ `docker compose version` จากนั้นนำ source repository ไปไว้บน VPS

```sh
cp .env.docker.example .env.docker
chmod 600 .env.docker
```

แก้ `.env.docker` ให้เป็นค่าจริง โดยเฉพาะ:

```dotenv
COMPOSE_PROJECT_NAME=nocode
APP_IMAGE=nocode-builder:release-20261028
APP_DOMAIN=your-vps-domain.example.com
ACME_EMAIL=your-real-admin@example.com
APP_MEMORY_LIMIT=2g
APP_CPUS=2.0
```

`APP_DOMAIN` เป็น hostname เท่านั้น ไม่มี `https://` หรือ path โดเมนที่ VPS ให้มาใช้ได้เมื่อ A/AAAA ชี้เข้าเครื่องนี้และผู้ให้บริการอนุญาตการใช้งานนั้น เปิด inbound TCP 80/443; UDP 443 เป็นทางเลือกสำหรับ HTTP/3 อย่าเปิดพอร์ต 3000 สู่ internet หากมี reverse proxy เดิมใช้ 80/443 อยู่ ต้องเลือกให้ proxy เดิมส่งเข้า app หรือให้ Caddy เป็นตัวรับ ไม่ให้แย่งพอร์ตกัน

ค่าเริ่มต้น RAM 2 GB เป็นเพดาน runtime ของแอพ ไม่รวม Caddy, Docker, OS และหน่วยความจำขณะ build ควรเผื่อ RAM สำหรับ build และ Chromium ปรับตาม RAM จริงของ VPS (งาน PDF หลายงานอาจต้องเพิ่มเพดาน) รายงาน RAM ในแอพยังแยก host/process ไม่ใช่ cgroup quota

ไฟล์ `.env.local`, ฐานข้อมูล, uploads, releases, backups, test artifacts และ secrets ไม่ถูกส่งเข้า build context/image ค่า runtime ที่ต้องใช้ให้กำหนดใน `compose.yaml`/`.env.docker` โดยตรง ถ้ามี Automation เรียก webhook ให้ตั้ง `NOCODE_WEBHOOK_ORIGINS` และเพิ่มเฉพาะชื่อ environment ของ token ที่ Action ใช้งานใน service app อย่าใส่ token ใน Dockerfile หรือ build args

## 2. Build และทดสอบแบบ local HTTP

```sh
docker compose --env-file .env.docker config --quiet
docker compose --env-file .env.docker build app
docker compose --env-file .env.docker up -d --wait
docker compose --env-file .env.docker ps
curl -fsS http://127.0.0.1:8080/api/health
```

คาดหวัง `{"status":"ok"}` Healthcheck ตรวจ HTTP และการเปิด/อ่าน DB ด้วย SELECT 1 ไม่มีข้อมูลบัญชี schema หรือ path เปิดเผย ไม่ได้ตรวจทุกตาราง, เขียนดิสก์ หรือทำ integrity check เต็มฐานข้อมูล

## 3. สร้างเจ้าของ Builder ครั้งแรก

แอพยอมให้สร้างเจ้าของครั้งแรกผ่าน localhost เท่านั้น จึงเตรียมคำสั่งภายใน container ให้แล้ว:

```sh
docker compose --env-file .env.docker exec app node deploy/setup-owner.cjs
```

กรอกชื่อเล่น ชื่อ แผนก บัญชี อีเมล (ไม่บังคับ) และรหัสผ่าน รหัสผ่านจะไม่แสดงใน terminal เมื่อสร้างสำเร็จให้ล็อกอินด้วย URL ปกติ ไม่มีการเปิด public setup bypass หากเป็นข้อมูลที่ย้ายมาซึ่งมีผู้ใช้อยู่แล้ว ไม่ต้องรันคำสั่งนี้

กรณีต้องทำผ่านเว็บช่วงทดสอบ ใช้ SSH tunnel จากเครื่องตัวเองไป loopback บน VPS:

```sh
ssh -L 8080:127.0.0.1:8080 your-user@your-vps
```

แล้วเปิด `http://localhost:8080` (สำหรับชุด HTTP เท่านั้น)

## 4. เปิด HTTPS จริง

เมื่อ DNS และพอร์ตพร้อม:

```sh
docker compose --env-file .env.docker -f compose.yaml -f compose.https.yaml config --quiet
docker compose --env-file .env.docker -f compose.yaml -f compose.https.yaml up -d --wait
docker compose --env-file .env.docker -f compose.yaml -f compose.https.yaml logs --tail=100 proxy
curl -fsS https://your-domain.example.com/api/health
```

Caddy ขอและต่ออายุใบรับรองอัตโนมัติ ข้อมูลใบรับรองอยู่ใน volume ของ Caddy ส่วน `/api/realtime` ส่ง SSE ผ่าน proxy โดยไม่ buffer ทดสอบ login/บันทึก/PWA/Realtime/PDF บนโดเมนจริงหลัง DNS พร้อม

ใช้ไฟล์ Compose ทั้งสองทุกครั้งที่สั่ง `up` ใน Production มิฉะนั้น service proxy จะกลับไปใช้ HTTP config ค่า `Host` และ protocol ต้องส่งต่อถูกต้องเพื่อให้ CSRF check, Secure cookie และ PWA ทำงาน Caddy ที่ให้มาจัดการส่วนนี้ไว้แล้ว

## 5. ข้อมูลถาวรและการย้ายข้อมูล

volume `<project>_app_data` mount ที่ `/data` เก็บทั้งหมดต่อไปนี้:

- `/data/data.db` และ SQLite WAL/SHM เมื่อมี
- `/data/uploads/` (ไฟล์/รูปที่ตั้งให้เก็บลงโฟลเดอร์)
- `/data/backups/`
- `/data/.app-releases/` (ฉบับร่างและ release)

การ recreate/rebuild/container restart ไม่ลบข้อมูล volume แต่การสั่ง `down --volumes` หรือ `volume prune` อาจลบข้อมูล ให้ใช้ `down` โดยไม่เพิ่ม `--volumes` สำหรับระบบจริง

ย้ายจากระบบปัจจุบัน: หยุดแอพต้นทางก่อนคัดลอก DB และไฟล์ทั้งชุด อย่าคัดลอกเฉพาะ `data.db` ขณะต้นทางกำลังเขียน WAL หรือให้สองเครื่องเขียนชุดเดียวกัน นำชุดข้อมูลเข้า volume ปลายทางที่ยังว่างขณะแอพหยุด แล้วกำหนดเจ้าของไฟล์เป็น UID/GID 1000:1000 ก่อน start อีกทางเลือกคือใช้หน้าสำรองและกู้คืนของระบบตามขอบเขตที่ต้องการ

ใช้ storage บนดิสก์เครื่องเดียว ไม่วาง SQLite WAL บน NFS/SMB และไม่ scale app เพิ่มหลาย replicas ในชุดนี้ เพราะ SQLite/Automation/ตัวนับรายงานบางส่วนออกแบบเป็น process เดียว หากเพิ่มหลาย VPS ให้แยกแผนฐานข้อมูลและ worker ก่อน

## 6. สำรองข้อมูลทั้งชุด

บน Linux จาก root ของ repository:

```sh
sh deploy/backup.sh .env.docker ./server-backups
```

สคริปต์หยุด app ชั่วคราว เก็บ archive ทั้ง `/data` ตรวจว่า archive อ่านได้ แล้วเปิด app กลับถ้าเดิมกำลังรันอยู่ งานระหว่างช่วงหยุดเข้าใช้งานไม่ได้ จัดช่วง maintenance สำหรับงานนี้ และคัดลอก archive ออกจาก VPS ไปอีกที่หนึ่ง การมี named volume อย่างเดียวไม่ใช่ backup งาน Automation ที่ถูกตัดระหว่างทำงานต้องตรวจประวัติก่อน retry เพื่อไม่ให้ส่งงานซ้ำ

ทดสอบกู้คืนใน project/volume ใหม่ก่อนใช้งานจริง อย่าแตก archive ทับ volume ที่กำลังใช้งาน รหัสผ่านและ session เป็นข้อมูลลับอยู่ใน DB จึงต้องจำกัดสิทธิ์ archive ด้วย

## 7. อัปเดต / rollback

สร้าง tag ใหม่สำหรับแต่ละรุ่น เก็บ tag เก่าไว้ ก่อนอัปเดตให้สำรองทั้งชุด เปลี่ยน `APP_IMAGE` แล้ว:

```sh
docker compose --env-file .env.docker -f compose.yaml -f compose.https.yaml build app
docker compose --env-file .env.docker -f compose.yaml -f compose.https.yaml up -d --wait
```

ไม่ใช่ zero-downtime deployment มีช่วงหยุดสั้น ๆ และ connection Realtime จะเชื่อมใหม่ การย้อน tag image ไม่ได้ย้อน schema/data ที่ migrate ไปแล้ว หาก schema ไม่เข้ากัน ต้องกู้คืน snapshot ที่ตรงรุ่นด้วย

## 8. Health / เหตุฉุกเฉิน / อีเมล

- `restart: unless-stopped` เริ่มใหม่เมื่อ process จบ/ล้ม และหลัง Docker เริ่มใหม่ ยกเว้น container ที่หยุดด้วยตนเอง
- สถานะ `unhealthy` เพียงอย่างเดียวไม่ทำให้ Compose restart แอพอัตโนมัติ ให้ตรวจ logs/สาเหตุก่อนรีสตาร์ท หลีกเลี่ยง restart loop เมื่อ DB หรือดิสก์มีปัญหา
- ตั้ง monitoring ภายนอก VPS เช่น Better Stack ให้ตรวจ `https://DOMAIN/api/health` คาดหวัง HTTP 200 และ JSON status ok แล้วตั้งผู้รับอีเมล แจ้งทั้ง outage/recovery ด้วยการยืนยันหลายครั้งก่อนเตือน
- RAM/CPU/disk/OOM ต้องใช้ agent บน host หรือระบบ monitoring ของผู้ให้บริการเพิ่ม ตรวจนอก container ด้วย เพราะ container/เครื่องล่มไม่สามารถส่งอีเมลเองได้
- โค้ดชุดนี้เตรียม health endpoint เท่านั้น ยังไม่ได้สร้างบัญชีบริการ monitoring ตั้ง SMTP หรือส่งอีเมลจริง ต้องกำหนดผู้รับและบริการก่อนเปิดใช้

คำสั่งตรวจทั่วไป:

```sh
docker compose --env-file .env.docker -f compose.yaml -f compose.https.yaml ps
docker compose --env-file .env.docker -f compose.yaml -f compose.https.yaml logs --tail=100 app
docker stats
```

## Validation

```sh
docker build -t nocode-builder:compose-smoke .
node scripts/docker-smoke.cjs
```

Smoke test สร้าง project `nocode-smoke-<timestamp>` และ volume ใหม่ ทดสอบ non-root/read-only, Healthcheck, localhost owner setup, login/CSRF, อัปโหลด/PDF, persistence หลัง recreate, restart หลัง process crash, HTTPS แบบ local CA, Secure cookie และ PWA ผ่าน Caddy แล้วลบเฉพาะ project ทดสอบ ไม่ใช้โดเมนสาธารณะและไม่ส่งอีเมล/ขอ ACME จริง

เอกสารอ้างอิง: [Docker restart policy](https://docs.docker.com/engine/containers/start-containers-automatically/), [Compose services](https://docs.docker.com/reference/compose-file/services/), [Caddy reverse proxy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy), [Playwright Docker](https://playwright.dev/docs/docker).
