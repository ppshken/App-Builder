# Docker Compose บน Linux VPS

ชุดนี้รันแอพ 1 container/process พร้อม Chromium สำหรับ PDF, SQLite บน local named volume และ Caddy ด้านหน้า ไม่ใช้ PM2 และไม่เปิดพอร์ตแอพ 3000 สู่ภายนอก

สถานะตรวจ 2 พฤศจิกายน 2569: build/startup ในเครื่อง และ **Docker build/smoke บน Linux ARM64 / Node 22.23.4 ผ่านแล้ว** รวม UID/permissions, read-only root, SQLite/WAL persistence, PDF, backup/restore helpers และ Caddy HTTPS แบบ local CA ใน project/volumes ทดสอบใหม่เท่านั้น ยังไม่อนุญาต Go Live จนตรวจ VPS architecture/config, DNS และ public TLS certificate ของโดเมนจริง ดู [ผลตรวจและ Go Live blockers](audits/2026-11-02-deployment-verification/RESULTS.md) คำสั่ง `up`, `stop`, backup และ restore ด้านล่างเป็น runbook สำหรับผู้ดูแลในช่วงที่อนุมัติแล้ว ไม่มีการรันกับ production ในการตรวจครั้งนี้

## ไฟล์

- `Dockerfile`: Node 22 Debian, build แบบ production, runtime เป็น user `node` (UID 1000), Chromium/ฟอนต์ไทยสำหรับ PDF
- `compose.yaml`: HTTP บน `127.0.0.1:8080` สำหรับทดสอบ/SSH tunnel, restart policy, resource limits, log rotation
- `compose.https.yaml`: ใช้ร่วมไฟล์หลักเพื่อเปิด HTTPS จริง, ต้องการ Docker Compose >= 2.24.4
- `.env.docker.example`: ตัวอย่าง config ไม่มีข้อมูลบัญชีหรือข้อมูลจริง
- `deploy/backup.sh`: สำรอง data volume ทั้งชุดแบบหยุดแอพชั่วคราว
- `deploy/start-app.sh`: ตั้ง umask 077 แล้ว exec Next production server; ค่าเริ่มต้น 0.0.0.0:3000
- `deploy/restore-drill.sh`: ตรวจ archive ด้วย volume ใหม่ชื่อที่สคริปต์สร้างเอง ไม่รับ volume เป้าหมายจริง ไม่เริ่มแอป และลบเฉพาะ volume ทดสอบเมื่อเสร็จ
- `scripts/verify-deployment-config.cjs`: ตรวจ Compose ตัวอย่าง/source และสแกน secrets แบบจำกัดขอบเขต โดยไม่ start/stop service
- `scripts/deployment-runtime-check.cjs`: ทดสอบ production CLI บน loopback ด้วย DB สังเคราะห์ใน `.test-data` เท่านั้น
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
APP_IMAGE=nocode-builder:release-20261102
APP_DOMAIN=your-vps-domain.example.com
ACME_EMAIL=your-real-admin@example.com
APP_MEMORY_LIMIT=2g
APP_CPUS=2.0
```

`APP_DOMAIN` เป็น hostname เท่านั้น ไม่มี `https://` หรือ path โดเมนที่ VPS ให้มาใช้ได้เมื่อ A/AAAA ชี้เข้าเครื่องนี้และผู้ให้บริการอนุญาตการใช้งานนั้น เปิด inbound TCP 80/443; UDP 443 เป็นทางเลือกสำหรับ HTTP/3 อย่าเปิดพอร์ต 3000 สู่ internet หากมี reverse proxy เดิมใช้ 80/443 อยู่ ต้องเลือกให้ proxy เดิมส่งเข้า app หรือให้ Caddy เป็นตัวรับ ไม่ให้แย่งพอร์ตกัน

ค่าเริ่มต้น RAM 2 GB เป็นเพดาน runtime ของแอพ ไม่รวม Caddy, Docker, OS และหน่วยความจำขณะ build ควรเผื่อ RAM สำหรับ build และ Chromium ปรับตาม RAM จริงของ VPS (งาน PDF หลายงานอาจต้องเพิ่มเพดาน) รายงาน RAM ในแอพยังแยก host/process ไม่ใช่ cgroup quota

ไฟล์ `.env.local`, ฐานข้อมูล, uploads, releases, backups, test artifacts และ secrets ไม่ถูกส่งเข้า build context/image ค่า runtime ที่ต้องใช้ให้กำหนดใน `compose.yaml`/`.env.docker` โดยตรง ถ้ามี Automation เรียก webhook ให้ตั้ง `NOCODE_WEBHOOK_ORIGINS` และเพิ่มเฉพาะชื่อ environment ของ token ที่ Action ใช้งานใน service app อย่าใส่ token ใน Dockerfile หรือ build args

Compose อ่าน `.env.docker` เพื่อแทนค่า `${...}` ไม่ได้ส่งทุกตัวแปรเข้า container อัตโนมัติ ตัวแปรที่โค้ดอ่านและส่งไว้ใน service app แล้วมีดังนี้:

| ตัวแปร | การตั้งค่า |
|---|---|
| `NOCODE_DB_PATH` | กำหนดคงที่ `/data/data.db` ต้องอยู่ใน persistent volume |
| `HOSTNAME`, `PORT` | Compose กำหนด `0.0.0.0`, `3000` ให้ตรงกับ `expose` และ `reverse_proxy app:3000` |
| `NODE_OPTIONS` | รับจาก `APP_NODE_OPTIONS`; เป็นเพดาน heap ไม่ใช่เพดาน RAM รวมของ Chromium/SQLite |
| `NOCODE_WEBHOOK_ORIGINS` | HTTPS origins ที่อนุญาตสำหรับ Automation; ว่างคือไม่อนุญาต |
| `NOCODE_API_ORIGINS` | HTTPS origins สำหรับแหล่งข้อมูล External REST; ว่างคือไม่อนุญาต |
| `NOCODE_API_WORKSPACE_ORIGINS` | JSON map ของ origins แยกตาม app; ว่างใช้ค่าเริ่มต้น `{}` |
| `NOCODE_API_CREDENTIALS` | JSON credential registry; ว่างใช้ `[]` ค่าจริงเป็นความลับและต้องกำหนด apps/origins ที่อนุญาต |
| `NOCODE_API_READ_QUERY_PATHS` | JSON map ของ POST endpoints ที่อนุญาตให้ query แบบอ่านข้อมูล; ว่างใช้ `{}` |
| `NOCODE_USAGE_RETENTION_DAYS` | 1–3650, ค่าเริ่มต้น 180; ลดค่านี้อาจทำให้ประวัติการใช้งานเก่าถูกล้างตาม retention |
| `NOCODE_PWA_VERSION` | ปล่อยว่างให้ใช้ BUILD_ID ของแต่ละ release |
| `NOCODE_PDF_BROWSER_PATH` | ปล่อยว่างให้ใช้ Chromium ใน image; หากระบุ ต้องเป็น path ภายใน container ไม่ใช่ path ของเครื่องผู้ดูแล |

JSON ใน dotenv ควรใส่ single quotes เช่น `NOCODE_API_WORKSPACE_ORIGINS='{}'` เพื่อป้องกันการขยาย `${...}` ในค่าลับ ค่า credentials จริงห้ามใส่ในไฟล์ example หรือลง Git อย่าบันทึกผล `docker compose config` แบบแสดงค่าจริงลง log ใช้ `config --quiet` เพื่อตรวจ syntax

ชื่อ bearer token ของ Automation เป็นชื่อที่ผู้สร้าง Action กำหนดเอง (`bearer_env`) จึงต้องเพิ่ม mapping อย่างชัดเจน เช่นสร้าง `compose.runtime.yaml` ส่วนตัว:

```yaml
services:
  app:
    environment:
      ERP_API_TOKEN: ${ERP_API_TOKEN:?Set ERP_API_TOKEN in the private env file}
```

แล้วใส่ค่าจริงใน `.env.docker` ที่ mode 600 และเพิ่ม `-f compose.runtime.yaml` ในทุกคำสั่ง `config/build/up` ของชุดนั้น การใส่เพียง `ERP_API_TOKEN` ลง dotenv โดยไม่เพิ่ม mapping จะไม่ทำให้โค้ดใน container อ่าน token ได้ ไฟล์ override นี้ถูก ignore ใน Git และ build context

Image tag ในตัวอย่างยังเป็น placeholder ต้องเลือก release tag ที่ไม่ใช้ซ้ำและบันทึก image digest จริง รวมถึง versions/digests ของ Node/Caddy ที่ทดสอบ ก่อนอนุญาต Go Live

## 2. Build และทดสอบแบบ local HTTP

```sh
docker compose --env-file .env.docker config --quiet
docker compose --env-file .env.docker build app
docker compose --env-file .env.docker up -d --wait
docker compose --env-file .env.docker ps
curl -fsS http://127.0.0.1:8080/api/health
```

คาดหวัง `{"status":"ok"}` Healthcheck ตรวจ HTTP และการเปิด/อ่าน DB ด้วย SELECT 1 ไม่มีข้อมูลบัญชี schema หรือ path เปิดเผย ไม่ได้ตรวจทุกตาราง, เขียนดิสก์ หรือทำ integrity check เต็มฐานข้อมูล

`npm run build` คือ frontend และ server build ของ Next.js แอปเดียวกัน ไม่มี backend service แยกและไม่มี `npm run migrate` ใน package.json ส่วน startup จริงคือ `sh deploy/start-app.sh` → `exec node node_modules/next/dist/bin/next start` โค้ด `lib/db.ts` เรียก `initializeDatabase` เมื่อเปิด DB ครั้งแรก และ workflow worker/healthcheck อาจทำให้เกิดการเปิด DB ทันทีหลัง start จึงต้องสำรองก่อนเริ่ม image รุ่นใหม่ ไม่ใช่รอจนล็อกอินแล้วค่อยสำรอง ระบบมี migration backup ตามเงื่อนไขในโค้ด แต่ไม่ทดแทน cold backup ทั้งชุด

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

### ถ้ามี Nginx และ Certbot บน host อยู่แล้ว

ใช้ host Nginx ส่งตรงเข้า app ทาง loopback โดยใช้ `compose.yaml` + `compose.nginx.yaml` แทนชุด Caddy HTTPS พอร์ต 3001 บน host ต้องว่างก่อน และต้องใช้ `.env.docker`/COMPOSE_PROJECT_NAME เดิมเพื่อรักษา volume เดิม:

```sh
ss -ltnp '( sport = :3001 )'
docker compose --env-file .env.docker -f compose.yaml -f compose.nginx.yaml config --quiet
docker compose --env-file .env.docker -f compose.yaml -f compose.nginx.yaml up -d --no-build --pull never --wait app
curl -fsS http://127.0.0.1:3001/api/health
```

การเพิ่ม port mapping recreate app ทำให้หยุดสั้น ๆ; ไม่ลบ app_data volume และไม่อัปเกรด image ในคำสั่งนี้ Caddy ถูกจัดไว้ใน profile ที่ไม่เปิดตามปกติ ห้ามเพิ่ม `compose.https.yaml` หรือเปิด bundled-caddy profile ในชุด Nginx นี้

สำรอง Nginx config ไว้นอก sites-enabled แล้วแทนเฉพาะ `location /` ของ HTTPS server_name สำหรับแอปด้วย `deploy/nginx-location.conf.example` คง certificate directives/Certbot includes และ HTTP→HTTPS redirect เดิมไว้ รัน `nginx -t` ก่อน reload ทุกครั้ง แล้วตรวจ `https://YOUR_DOMAIN/api/health` โดยไม่ใช้ `-k` วิธีนี้ไม่ต้องหยุด Nginx หรือออก certificate ใหม่ อ้างอิง [Nginx proxy module](https://nginx.org/en/docs/http/ngx_http_proxy_module.html)

### ถ้าเลือกให้ Caddy ของชุดนี้รับ HTTPS

เมื่อ DNS และพอร์ตพร้อม:

```sh
docker compose --env-file .env.docker -f compose.yaml -f compose.https.yaml config --quiet
docker compose --env-file .env.docker -f compose.yaml -f compose.https.yaml up -d --wait
docker compose --env-file .env.docker -f compose.yaml -f compose.https.yaml logs --tail=100 proxy
curl -fsS https://your-domain.example.com/api/health
```

Caddy ขอและต่ออายุใบรับรองอัตโนมัติ ข้อมูลใบรับรองอยู่ใน volume ของ Caddy ส่วน `/api/realtime` ส่ง SSE ผ่าน proxy โดยไม่ buffer ทดสอบ login/บันทึก/PWA/Realtime/PDF บนโดเมนจริงหลัง DNS พร้อม

ใช้ไฟล์ Compose ทั้งสองทุกครั้งที่สั่ง `up` ใน Production มิฉะนั้น service proxy จะกลับไปใช้ HTTP config ค่า `Host` และ protocol ต้องส่งต่อถูกต้องเพื่อให้ CSRF check, Secure cookie และ PWA ทำงาน Caddy ที่ให้มาจัดการส่วนนี้ไว้แล้ว

ชุดนี้ใช้ **Caddy ไม่ใช่ Nginx** และส่งทุก path ไป Next.js โดยไม่ตัด prefix รวม `/api/*`, `/api/realtime`, `/_next/*`, `/app/*`, fonts และ media ผ่าน API หาก VPS มี Nginx/CDN อยู่ก่อน ให้ตรวจ config ของตัวนั้นแยก และกำหนดว่าใคร terminate TLS ห้ามตั้ง `try_files` หรือ strip `/api` จน API ไปผิดปลายทาง การทำงานจริงของ Caddy/HTTPS ยังต้องยืนยันด้วย smoke test และโดเมนปลายทาง

## 5. ข้อมูลถาวรและการย้ายข้อมูล

volume `<project>_app_data` mount ที่ `/data` เก็บทั้งหมดต่อไปนี้:

- `/data/data.db` และ SQLite WAL/SHM เมื่อมี
- `/data/uploads/` (ไฟล์/รูปที่ตั้งให้เก็บลงโฟลเดอร์)
- `/data/backups/`
- `/data/.app-releases/` (ฉบับร่างและ release)

การ recreate/rebuild/container restart ไม่ลบข้อมูล volume แต่การสั่ง `down --volumes` หรือ `volume prune` อาจลบข้อมูล ให้ใช้ `down` โดยไม่เพิ่ม `--volumes` สำหรับระบบจริง

ห้ามเปลี่ยน `COMPOSE_PROJECT_NAME`, เปลี่ยน `app_data` หรือ `NOCODE_DB_PATH` โดยไม่ย้ายข้อมูล เพราะอาจเปิด volume/DB ว่างและดูเหมือนข้อมูลหาย ห้ามให้สอง app containers/processes เขียน DB ชุดเดียวกัน `/data` ใน image เป็นเจ้าของ UID/GID 1000:1000 และ mode 700; startup ใช้ umask 077 เพื่อให้ DB/WAL/SHM, uploads และ backup ใหม่เป็น mode 600 การ mount ข้อมูลเดิมไม่ได้แก้ owner/mode ให้อัตโนมัติ ต้องตรวจและแก้สิทธิ์เฉพาะชุดข้อมูลที่หยุดใช้งานแล้วก่อนเปิดแอป ห้ามใช้ `chmod -R 777`

ย้ายจากระบบปัจจุบัน: หยุดแอพต้นทางก่อนคัดลอก DB และไฟล์ทั้งชุด อย่าคัดลอกเฉพาะ `data.db` ขณะต้นทางกำลังเขียน WAL หรือให้สองเครื่องเขียนชุดเดียวกัน นำชุดข้อมูลเข้า volume ปลายทางที่ยังว่างขณะแอพหยุด แล้วกำหนดเจ้าของไฟล์เป็น UID/GID 1000:1000 ก่อน start อีกทางเลือกคือใช้หน้าสำรองและกู้คืนของระบบตามขอบเขตที่ต้องการ

ใช้ storage บนดิสก์เครื่องเดียว ไม่วาง SQLite WAL บน NFS/SMB และไม่ scale app เพิ่มหลาย replicas ในชุดนี้ เพราะ SQLite/Automation/ตัวนับรายงานบางส่วนออกแบบเป็น process เดียว หากเพิ่มหลาย VPS ให้แยกแผนฐานข้อมูลและ worker ก่อน

## 6. สำรองข้อมูลทั้งชุด

บน Linux จาก root ของ repository:

```sh
sh deploy/backup.sh .env.docker ./server-backups
```

สคริปต์หยุด app ชั่วคราว เก็บ archive ทั้ง `/data` ตรวจว่า archive อ่านได้ แล้วเปิด app กลับถ้าเดิมกำลังรันอยู่ งานระหว่างช่วงหยุดเข้าใช้งานไม่ได้ จัดช่วง maintenance สำหรับงานนี้ และคัดลอก archive ออกจาก VPS ไปอีกที่หนึ่ง การมี named volume อย่างเดียวไม่ใช่ backup งาน Automation ที่ถูกตัดระหว่างทำงานต้องตรวจประวัติก่อน retry เพื่อไม่ให้ส่งงานซ้ำ

archive นี้เก็บเฉพาะ app_data ไม่รวม volumes caddy_data/caddy_config ที่เป็นข้อมูล TLS/การตั้งค่าของ proxy ต้องกำหนดว่าจะสำรอง volumes เหล่านั้นแยก หรือออกใบรับรองใหม่ตามข้อจำกัด ACME ในแผน disaster recovery และเก็บ private keys เป็นความลับ

ถ้า tar/ตรวจ archive ล้มเหลวจะไม่ publish ไฟล์ `.tar.gz` ที่สมบูรณ์ ตอนเปิด app กลับ สคริปต์รอ healthcheck สูงสุด 180 วินาที ถ้าเปิดไม่ขึ้นหรือไม่ healthy จะคืน exit code ไม่ใช่ 0 ให้ตรวจ `ps`, health และ logs ก่อนจบ maintenance ไฟล์ `.partial` ที่ล้มเหลวให้เก็บตรวจในพื้นที่ backup จนทราบสาเหตุ ไม่ถือเป็น backup ที่ใช้กู้ได้

ทดสอบกู้คืนใน project/volume ใหม่ก่อนใช้งานจริง อย่าแตก archive ทับ volume ที่กำลังใช้งาน รหัสผ่านและ session เป็นข้อมูลลับอยู่ใน DB จึงต้องจำกัดสิทธิ์ archive ด้วย

ทดสอบ archive ที่ได้ด้วย image ที่ build และตรวจแล้ว โดยไม่ mount production volume:

```sh
sh deploy/restore-drill.sh ./server-backups/FILE.tar.gz nocode-builder:YOUR_TESTED_RELEASE
```

สคริปต์รับแค่ archive และ image ที่มีอยู่ในเครื่อง ไม่รับชื่อ volume เป้าหมาย สร้าง volume ชั่วคราวชื่อ `nocode-restore-drill-*` เอง ปิดเครือข่ายและใช้ UID 1000/read-only root filesystem ตรวจ SQLite integrity/foreign keys แล้วลบเฉพาะ volume ที่สร้าง การตรวจนี้ไม่เริ่มแอป จึงต้องทดสอบฟังก์ชันแอปบน staging แยกด้วย หาก cleanup ไม่สำเร็จให้ตรวจชื่อ/label `app-builder-purpose=restore-drill` ก่อนจัดการ ห้ามลบ volume โดยดูเพียงชื่อคล้ายกัน

การกู้คืน production จริงเป็นงาน maintenance แยก: เก็บ backup ปัจจุบันก่อน หยุด writers ทั้งหมด เตรียม project/volume ใหม่ที่ว่าง ตรวจ image/schema ให้ตรงกับ archive คืนข้อมูลและ owner/mode ตรวจ integrity และฟังก์ชันบน staging แล้วให้ผู้ดูแลอนุมัติการสลับปลายทาง ห้ามใช้คำสั่ง extract ทับ volume ปัจจุบันแบบอัตโนมัติ

การสำรองจาก UI เก็บข้อมูล SQLite รวม blob รูป/ไฟล์ และกู้ผ่าน API ที่ต้องยืนยัน แต่ไม่ได้รวมไฟล์สำเนาบนดิสก์หรือโฟลเดอร์ `.app-releases` ภายนอก DB การย้ายทั้งระบบจึงใช้ cold backup ของ `/data` ให้ครบ และตรวจสำเนารูปที่ขาดก่อนย้าย

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

คำสั่งต่อไปนี้ทดสอบ local/source เท่านั้น ไม่ใช้ production configuration หรือ volume:

```sh
node scripts/verify-deployment-config.cjs
node --test tests/deployment-config.test.cjs
node scripts/deployment-runtime-check.cjs
```

ชุด unit ใช้ Docker mock เพื่อตรวจ guard/คำสั่งของ backup/restore helper และ tar/SQLite จริงกับ fixture ท้องถิ่น ไม่ยืนยัน Linux permissions หรือ Docker volume behavior ชุด runtime เริ่มแอปบน loopback ด้วย port และ DB สังเคราะห์ที่สร้างใหม่ ตรวจ CRUD, WAL/SHM mode 600, backup/restore/session และ process restart โดยใช้ production build `.next` ที่ต้อง build ไว้แล้ว

เมื่อ Docker daemon พร้อม ให้รันบน staging ที่ไม่มี production mounts:

```sh
docker build -t nocode-builder:compose-smoke .
node scripts/docker-smoke.cjs
```

Smoke test สร้าง project `nocode-smoke-<timestamp>` และ volume ใหม่ ทดสอบ non-root/read-only, Healthcheck, localhost owner setup, login/CSRF, อัปโหลด/PDF, persistence หลัง recreate, restart หลัง process crash, HTTPS แบบ local CA, Secure cookie และ PWA ผ่าน Caddy แล้วลบเฉพาะ project ทดสอบ ไม่ใช้โดเมนสาธารณะและไม่ส่งอีเมล/ขอ ACME จริง

Smoke ตรวจชื่อ project/volume และ loopback bindings ก่อน start และเรียก backup/restore helpers ตัวจริงด้วย config สังเคราะห์ ชุด TLS นี้ใช้ `rejectUnauthorized=false` เฉพาะ client fixture ของ localhost/local CA จึงไม่รับรอง certificate chain; ต้องทดสอบโดเมนจริงด้วย client ที่เปิด verification ตามปกติ โดยไม่ใช้ `curl -k` ก่อน Go Live

เอกสารอ้างอิง: [Docker restart policy](https://docs.docker.com/engine/containers/start-containers-automatically/), [Compose services](https://docs.docker.com/reference/compose-file/services/), [Caddy reverse proxy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy), [Playwright Docker](https://playwright.dev/docs/docker).
