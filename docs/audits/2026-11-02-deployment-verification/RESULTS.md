# Production deployment verification — 2 พฤศจิกายน 2569

**GO LIVE: HOLD** — Docker build/run และ helper ที่ส่งมอบผ่านการทดสอบจริงแล้วบน **Linux ARM64 / Node 22.23.4** แต่ config โดเมน/อีเมล/image release ยังต้องกำหนด และยังไม่ได้ตรวจ VPS, DNS หรือ public TLS certificate ของ production

ตรวจ source กับเอกสารและ execute การตรวจที่ทำได้จริง ไม่มีการ deploy production, start/stop service เดิม, เขียน production DB หรือกู้ทับ volume จริง Docker smoke ใช้ project/volumes ที่สร้างใหม่ชื่อ nocode-smoke-* และพอร์ต loopback เท่านั้น; restore drill ใช้ volume ใหม่ที่สคริปต์สร้างเอง ลบเฉพาะทรัพยากรทดสอบหลังจบ การแก้ Dockerfile/Compose/เอกสารและ permission ของ .env.docker เป็นการแก้ใน workspace ไม่ได้เปลี่ยนค่าหรือ deployment บน VPS

ตอนต้น Docker daemon ไม่พร้อม ต่อมารอบตรวจที่ได้รับอนุมัติ daemon ตอบสนอง จึงทำ build และ smoke จริงสำเร็จ ไม่ใช้สถานะ NOT TESTED ของรอบต้นแทนผลล่าสุด ดู [Docker build](evidence/docker-build.txt), [Docker smoke](evidence/docker-smoke.txt), [ผล runtime แบบ JSON](evidence/docker-runtime-results.json)

สถานะ: **VERIFIED** มีหลักฐานตรงตาม scope; **FAILED** ตรวจแล้วไม่ผ่าน; **NOT TESTED** ยังไม่มี execution ในปลายทาง/กรณีนั้น; **NEEDS CONFIGURATION** ต้องใส่ค่าจริงหรือกำหนดแผนก่อนเปิด ไม่ใช้ผล static review แทน container runtime

## ผลตรวจ 15 ข้อ

| ข้อ | สถานะหลังแก้ | ผลเทียบ source และการทดสอบจริง |
|---|---|---|
| 1. Dockerfile build ได้จริง | **VERIFIED** Linux ARM64 | docker build จาก Dockerfile ปัจจุบันผ่านครบ npm ci, Next build, prune, Chromium/system dependencies และ export image ทดสอบ ได้ image ID ในหลักฐาน ยัง **NOT TESTED** บน architecture ของ VPS ถ้าเป็น AMD64 |
| 2. Docker Compose config | **VERIFIED**; ค่าปลายทาง **NEEDS CONFIGURATION** | Compose 5.1.4 render HTTP และ HTTP+HTTPS ผ่าน ตรวจ assertions ของ ports/mount/env/override จริง และตรวจ private config ใน memory โดยไม่พิมพ์ค่าลับ: render ผ่าน แต่โดเมน/อีเมลและ release image ยังเป็นค่าที่ต้องกำหนด |
| 3. Port mapping | **VERIFIED** config + Docker fixture | Next ฟัง 0.0.0.0:3000; app expose 3000 ไม่มี published host port; HTTP default 127.0.0.1:8080→8080, HTTPS override 80/TCP,443/TCP,443/UDP ไม่มี 8080 ตกค้าง Caddy ส่ง app:3000 จริง Smoke ใช้ host ports ว่างบน loopback ไม่จับ public ports ของเครื่อง; firewall/public mapping ของ VPS ยัง **NOT TESTED** |
| 4. SQLite path | **VERIFIED** | lib/db.ts อ่าน NOCODE_DB_PATH; Dockerfile/Compose ใช้ /data/data.db และ probe ใน container ตรงกัน DB ของ build อยู่ /tmp/build-only.db และไม่พบใน runtime image |
| 5. DB/WAL persistent storage | **VERIFIED** | mount ทั้ง /data เข้า named volume; DB/WAL/SHM อยู่ที่เดียวกันจริง รวม uploads/backups/.app-releases ตาม dirname(DB) ทดสอบ committed WAL ใน tar fixture, cold restore, force recreate และ crash restart แล้วข้อมูล/ไฟล์ยังอยู่ WAL/SHM อาจถูก SQLite checkpoint/ลบเมื่อปิดตามปกติ ไม่ควรคัดลอก DB เดี่ยวขณะเขียน |
| 6. File permissions | **VERIFIED** fixture; ข้อมูลย้ายจริง **NEEDS CONFIGURATION** | actual container UID 1000, read-only root, /tmp และ .next/cache เขียนได้, DB/WAL/SHM owner 1000 และ mode 600; startup umask 077, /data ใน image mode 700; local CLI ยืนยัน upload/backup mode 600 ด้วย ตั้ง .env.docker ใน workspace เป็น 600 แล้ว ตรวจ owner/mode ของ volume เดิมก่อนย้ายแยกต่างหาก |
| 7. Backend startup command | **VERIFIED** local + Docker | CMD เรียก sh deploy/start-app.sh แล้ว exec Next production start จริง Health/auth/CRUD/ไฟล์/backup/restore ใช้งานได้และ process restart ผ่าน ไม่มี backend service แยกจาก Next app นี้ |
| 8. Frontend build command | **VERIFIED** local + Docker | npm run build = next build --webpack; รันจริงทั้ง Node 24 บน host และ Node 22 ใน Linux image ผ่าน compile/TypeScript/static pages 23 หน้า ไม่ได้ใช้ dev server เป็น production |
| 9. Nginx/API routing | **VERIFIED** Caddy fixture; VPS proxy **NOT TESTED** | repository นี้ใช้ Caddy ไม่มี Nginx config ส่งทุก path โดยไม่ strip prefix รวม /api, /api/realtime, /_next, /app และ media ทดสอบ Caddy จริงใน container: HTTPS local CA, Secure cookie, same-origin/CSRF, PWA redirects และ SSE ไม่ buffer ผ่าน ถ้าปลายทางมี Nginx/CDN ต้องกำหนดและทดสอบเพิ่ม Local-CA client fixture ปิด certificate-chain verification จึงไม่รับรอง public CA trust |
| 10. Environment variables | **VERIFIED** mapping; ค่าจริง **NEEDS CONFIGURATION** | เพิ่ม External REST origins/workspace origins/credential registry/read-query policy, usage retention, PWA version และ PDF browser path ให้ตรง source ชื่อ bearer_env ของ Automation เป็น dynamic ต้องเพิ่ม private override เฉพาะชื่อที่ใช้ การใส่ dotenv อย่างเดียวไม่ส่งทุกตัวเข้า container |
| 11. Secrets/commit/exposure | **VERIFIED** ตาม scope; exhaustive history **NOT TESTED** | tracked paths ไม่พบ dotenv จริง/DB/private keys/machine credentials, heuristic scan ไม่พบ private-key/AWS/GitHub token patterns และ selected sensitive filenames ไม่พบใน reachable history Image probe ไม่พบ .env.docker/.env.local/.aws/.git/DB ของ host หรือ build DB เพิ่ม ignore ของ credentials/agent state/keys และ private override; ไม่ได้ตรวจทุก historical blob/ทุก secret pattern และไม่แสดงค่าจาก private config |
| 12. Migration commands | **VERIFIED** source + bootstrap/reopen | ไม่มี npm run migrate หรือ Prisma command; lib/db.ts เรียก initializeDatabase เมื่อเปิด DB ผ่าน worker/health/startup ทดสอบ fresh DB, reopen และ unit migration tests ผ่าน ต้อง cold backup ก่อน start image ใหม่ การอัปเกรดสำเนา production data และ rollback schema/image ที่ตรง release ยัง **NOT TESTED** |
| 13. Backup/restore | **VERIFIED** API + real Docker helpers | local production CLI ทดสอบ backup/download/upload/inspect/restore, session invalidation, record/file bytes และ restart ผ่าน Docker smoke เรียก deploy/backup.sh กับ env ของ project สังเคราะห์จริง ได้ private archive mode 600, resume+health ผ่าน แล้วเรียก deploy/restore-drill.sh จริงใน volume ใหม่ รวมตรวจ SQLite integrity/foreign keys และอ่านข้อมูล/ไฟล์จาก archive อีก volume ผ่าน |
| 14. คำสั่งเสี่ยงข้อมูลหาย | **VERIFIED** review/guard | backup failure ยังพยายาม resume app และไม่คืน success หาก start/health ไม่ผ่าน Restore drill ไม่รับ production target volume, สร้างชื่อเอง, ปฏิเสธ target ที่มีอยู่/parent paths/links และ cleanup เฉพาะ volume ที่สร้าง ทดสอบ failure/guard ด้วย mock และ happy path จริง ไม่มี destructive command กับข้อมูลจริง |
| 15. ขั้นตอนที่ขาด | แก้ runbook แล้ว; **NEEDS CONFIGURATION / NOT TESTED** ปลายทาง | เพิ่ม env passthrough, automatic migration timing, private permissions, restore drill, ขอบเขต cold backup/SQLite backup, Caddy แทน Nginx และรายการ Go Live gates ต้องกำหนดค่าจริงและทดสอบ VPS ตาม blockers ด้านล่าง |

## จุดที่ FAILED/ขาดเดิมและแก้แล้ว

| สิ่งที่ผิดหรือขาด | การแก้และผลหลังแก้ |
|---|---|
| backup helper ใช้ compose start ... หรือ true ทำให้ restart ล้มเหลวแต่รายงานสำเร็จ | EXIT trap รักษา failure status และใช้ start --wait --wait-timeout 180; test restart/tar fail ผ่าน และ helper บน project ทดสอบจริง backup+resume healthy ผ่าน |
| Compose ส่งเฉพาะ DB path/webhook แต่ source อ่าน environment เพิ่ม | เพิ่ม mapping/example และทดสอบ Compose render จริง ไม่ใส่ production credentials ใน example |
| runtime ไม่มี restrictive umask และ private env ใน workspace mode 644 | เพิ่ม start-app.sh/umask 077, /data owner+mode และ explicit HOSTNAME/PORT; actual Linux DB/WAL/SHM = 600, .env.docker ใน workspace เปลี่ยนเป็น 600 โดยไม่แก้ค่าภายใน |
| ไม่มี restore helper ที่ไม่รับ production volume | เพิ่ม restore-drill.sh: image+archive เท่านั้น, volume ใหม่, network none/read-only root/UID 1000, SQLite checks และ cleanup; syntax/guard tests และ Docker execution ผ่าน |
| context exclusions ไม่ครอบคลุม machine credentials/agent state อย่างชัดเจน | เพิ่ม .aws/.ssh/.codex/.agents/.npmrc/.netrc/recursive keys พร้อมรักษา app/backups และ app/api/backups source; image build และ private-path probe ผ่าน |
| smoke กล่าวว่าตรวจ read-only แต่เดิมมีเพียง UID check | เพิ่ม HostConfig.ReadonlyRootfs, EROFS, DB/WAL owner/mode, writable tmp/cache/data, actual backup/restore helpers และแยก host app environment ออกจาก test container; ผ่านจริง |
| เอกสารไม่ครบเรื่อง dotenv, migration, permissions และ SQLite/cold backup | แก้ docs/DOCKER_PRODUCTION.md, production readiness และ Node minimum ของ automation docs ให้ตรง package/source พร้อม failure/rollback/backup warnings |

**ไม่เหลือ FAILED ที่ยังไม่แก้ในชุดตรวจนี้** ข้อจำกัดของ VPS/DNS/public certificate/ข้อมูลจริงยังไม่ถือว่าผ่านจากผล fixture

## หลักฐาน execution ใหม่

- [Unit tests](evidence/unit-tests.txt): **399/399 ผ่าน** รวม deployment helper tests 7 รายการ
- [Local production CLI](evidence/runtime-checks.json): 6 กลุ่ม assertion ผ่าน รวม real backup/restore และไฟล์ mode 600
- [Compose/source/security](evidence/config-checks.json): 12 assertions ผ่าน; real private config render ผ่าน, mode 600 แต่ domain/email/release image ยัง NEEDS CONFIGURATION ไม่มี private values ในหลักฐาน
- [Frontend build](evidence/frontend-build.txt) และ [Docker build](evidence/docker-build.txt): ผ่าน
- [Docker runtime](evidence/docker-runtime-results.json): Linux ARM64 / Node 22.23.4 / UID 1000, DB mode 384 ฐานสิบ = 0600, backup helper และ restore drill VERIFIED
- [Docker smoke log](evidence/docker-smoke.txt), [image metadata](evidence/image-metadata.txt): image ทดสอบเฉพาะ audit ไม่ได้ push/deploy
- [Containers ที่เหลือ](evidence/remaining-test-containers.txt) และ [volumes ที่เหลือ](evidence/remaining-test-volumes.txt): ว่างหลัง cleanup ของ project ทดสอบ
- [Source hashes](evidence/source-sha256.json) ผูกหลักฐานกับ config/scripts ที่ตรวจ; [environment](evidence/environment.json) ระบุ platform และขอบเขต

TLS smoke ใช้ localhost/local CA ภายใน container ไม่ขอ ACME ของโดเมนจริง ไม่ติดตั้ง CA ลง host และ test client ใช้ rejectUnauthorized=false จึงทดสอบ encrypted routing/headers ได้ แต่ **ไม่ได้ตรวจความเชื่อถือของ certificate chain หรือ public CA** การดาวน์โหลด/รัน native Caddy บน host รอบต้นถูก automatic approval review ปฏิเสธด้วยเหตุผล external executable risk ไม่มีการ retry บน host; ต่อมาทดสอบ Caddy ผ่าน Docker smoke ที่ได้รับอนุมัติใน container/volume ทิ้งได้แทน ดู [ขอบเขต](evidence/caddy-runtime-blocked.txt)

## คำสั่ง/การเปลี่ยนแปลงที่เสี่ยงข้อมูลหาย

ห้ามใช้กับ volume ปัจจุบันโดยไม่มี maintenance/backup ที่อนุมัติ:

- docker compose down --volumes, volume rm/prune, system prune ที่รวม volumes หรือการลบ /data ทำให้ข้อมูลถาวรหายได้ Script test ลบเฉพาะ generated test volumes เท่านั้น
- Extract archive/copy DB ทับ volume ที่ทำงานอยู่, คัดลอกเพียง data.db ระหว่างเขียน WAL หรือให้สอง processes/servers เขียน SQLite ชุดเดียวกัน เสี่ยงข้อมูลไม่สอดคล้อง/สูญหาย
- up ด้วย image ใหม่อาจเริ่ม migration ทันที ต้องสำรองก่อน start ไม่ใช่หลัง start การย้อน image ไม่ย้อน schema/data
- เปลี่ยน COMPOSE_PROJECT_NAME, volume name หรือ NOCODE_DB_PATH อาจเปิด DB ว่างคนละตำแหน่ง อย่าสร้างบัญชีใหม่หรือลบ volume เดิมก่อนตรวจ path
- UI restore ย้อนข้อมูลธุรกรรมตาม snapshot และยกเลิก session; usage retention ล้างประวัติเก่าตามวันที่ตั้งไว้

## Remaining blockers ก่อนอนุญาต Go Live

1. **NEEDS CONFIGURATION:** metadata ของ private config ยังเป็น placeholder สำหรับ domain/email และ release image เลือก tag ที่ไม่ใช้ซ้ำและบันทึก digest, ตรวจ DNS A/AAAA, ACME email, TCP 80/443/UDP443 ตามการใช้จริง ห้ามใช้ image audit/local/latest เป็น release ที่ไม่ควบคุม
2. **NOT TESTED:** VPS จริง รวม architecture (ผลนี้ ARM64 ถ้า VPS AMD64 ต้อง build/smoke บน AMD64), firewall, public port binding, RAM/disk/OOM/resource limits, owner/mode ของข้อมูลย้าย และ Nginx/CDN ที่อาจมีอยู่ก่อน
3. **NOT TESTED:** public TLS certificate/chain โดยไม่ปิด verification, Host/proto/redirect, login/CSRF/Secure cookie, PWA/camera/assets และ SSE บนโดเมนจริง ผล local CA ไม่ทดแทนขั้นนี้
4. **NEEDS CONFIGURATION / NOT TESTED:** backup schedule/offsite destination/retention/RPO/RTO, การสำรองหรือ reissue TLS volumes, monitoring/ผู้รับแจ้งเตือน และ staging restore ด้วย release ที่ตรงข้อมูลจริงก่อนสลับ production Secrets/allowlists ภายนอกตั้งเฉพาะ feature ที่ใช้
5. **NEEDS CONFIGURATION:** finding เรื่องสำเนารูปที่ขาดจาก [รายงานก่อนหน้า](../2026-11-02-production-check/RESULTS.md) ต้องจัดการหรือกำหนดแนวทางก่อนย้ายข้อมูลทั้งหมด ไม่ได้ลบ/สร้างไฟล์รูปจริงใน audit นี้
6. **NEEDS CONFIGURATION:** กำหนดแผนแก้หรือยอมรับความเสี่ยงของ Moderate 8 แพ็กเกจในกลุ่ม ExcelJS ที่ยังเหลือจาก [dependency audit](../2026-11-02-dependency-security/RESULTS.md) ตามนโยบายก่อนเปิดใช้งานจริง

Runbook ที่แก้: [Docker production](../../DOCKER_PRODUCTION.md) เอกสารอ้างอิง semantics: [Caddy reverse_proxy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy) โดยมี execution fixture ประกอบตามข้อจำกัดข้างต้น
