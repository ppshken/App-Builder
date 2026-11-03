# ตารางกลาง: นำเข้าหลายตารางและยกเลิกการเชื่อม

วันที่ 3 พฤศจิกายน 2569

## วิธีใช้

### นำเข้าหลายตาราง

Data > เพิ่มตารางจากส่วนกลาง > ติ๊กเลือกตาราง > นำเข้า

- เลือกได้สูงสุด 50 ตารางต่อครั้ง มีจำนวนที่เลือก เลือกทั้งหมดที่แสดง และล้างที่เลือก
- ค้นหาแล้วรายการที่เลือกไว้ยังคงอยู่ ไม่ตีความว่าเลือกทุกตารางในฐานข้อมูล
- ถ้าคอลัมน์จริงมี Ref/List/Enum อ้างตารางที่ยังไม่เชื่อม ต้องเลือกตารางนั้นเข้าชุดด้วย UI จะแจ้งชื่อที่ขาด
- รองรับ Ref วนกันภายในชุด เช่น A อ้าง B และ B อ้าง A โดยไม่ต้องเปลี่ยนโครงสร้างต้นทาง
- Backend ตรวจสิทธิ์ทุกตารางใหม่ทั้งหมดและสร้างการเชื่อมใน transaction เดียว ตารางใดผิดพลาดจะ rollback ทั้ง grants, overlays และ Views ที่เพิ่งสร้าง
- ไม่คัดลอกแถวข้อมูลและไม่รับคอลัมน์คำนวณต้นทางตาม semantics เดิม

### ยกเลิกการเชื่อม

- รายตาราง: Data > ตารางกลาง > ตั้งค่าคอลัมน์ > ยกเลิกเชื่อมต่อ
- หลายตาราง: Data > ยกเลิกเชื่อมต่อตารางกลาง > เลือกตาราง > ตรวจผลกระทบ
- รองรับการเลือกยกเลิกทั้งชุดสำหรับ Ref ที่วนกัน การยกเลิกเพียงตารางเดียวจะถูกบล็อกหากอีกตารางยังอ้างอยู่
- แสดงรายชื่อ View, Slice, Action, Automation, แม่แบบ PDF และคอลัมน์คำนวณเฉพาะแอปที่จะนำออก พร้อมคำเตือนเรื่อง Label/ชื่อที่แสดงและสิทธิ์ของทรัพยากรเหล่านั้น
- ต้องกดยืนยันอีกครั้ง จึงนำการเชื่อมและการตั้งค่าของแอปปลายทางออก ไม่ลบตาราง คอลัมน์ หรือแถวจริงของต้นทาง และไม่เปลี่ยนการตั้งค่าของแอปอื่น
- ก่อนยืนยันสามารถกดกลับได้ โดยไม่มีการเปลี่ยนข้อมูล
- ระบบสร้าง backup ผ่าน helper เดิมก่อน commit ประวัติงานและสิทธิ์แชร์จากต้นทางยังอยู่ จึงนำเข้าภายหลังได้เมื่อยังได้รับอนุญาต

## การตรวจผลกระทบ

Preview จำลองการนำ config ออกภายใน SQLite transaction แล้ว rollback เสมอ รวมถึง Audit ที่เกิดในการจำลอง ไม่สร้าง backup ใน preview และไม่อ่านแถวธุรกิจเพื่อคัดลอก/ลบ

หลังจำลอง ใช้ inspectApp ตรวจการอ้างอิงในตารางที่เหลือ สูตร View/Dashboard/Custom layout, Action, Workflow และ PDF พร้อมตรวจการตั้งค่า Header/Navigation ที่ยังชี้ View ที่จะถูกนำออก หากพบ error จะปิดปุ่มยืนยันให้แก้ dependency ก่อน (รวมถึง error เดิมที่ยังเหลือในแอป)

ป้องกัน queued/running jobs ของตารางที่เลือก รวมถึง job snapshots ของตารางอื่นซึ่งยังเรียก Action หรือ PDF ที่จะถูกนำออก ไม่ลบประวัติงานที่จบแล้ว

Preview คืน token ผูกกับ app ID, ชุดตาราง, metadata, permissions, โครงสร้างคอลัมน์และงานที่เกี่ยวข้อง Confirm ต้องส่ง token ปัจจุบันและ confirmation = ยกเลิกเชื่อมต่อ หากการตั้งค่าเปลี่ยน ให้ตรวจใหม่ (409) ตรวจซ้ำภายใต้ immediate transaction ก่อน commit การกดยืนยันซ้ำหลัง unlink ไม่ลบอะไรเพิ่ม

การเชื่อมที่ถูกถอนสิทธิ์อ่านยังแสดงให้ Builder ปลายทางยกเลิกได้ แต่ไม่คืนสิทธิ์อ่านแถวข้อมูล และไม่เปิดเผยคอลัมน์ใหม่หลังถอนสิทธิ์แก่ Builder ที่ไม่ได้จัดการต้นทาง

การยกเลิกแบบเดิมผ่านส่วนกลางจะไม่อนุญาตให้ข้ามการตรวจผลกระทบของ managed overlays เพื่อป้องกัน metadata ค้าง ให้ใช้ปุ่มใหม่ในแอปปลายทาง สำหรับ legacy links ที่ไม่มี overlay ยังใช้พฤติกรรมเดิมได้

## API

- POST /api/shared-tables {op:import, tables:[...]} — atomic batch; รูปแบบเดิม {op:import, table:...} ยังรองรับ
- GET /api/shared-tables?op=disconnect_preview&tables=<JSON array> — read-only preview ที่ UI ใช้ จึงไม่แสดงข้อความบันทึกสำเร็จระหว่างตรวจ
- POST /api/shared-tables {op:disconnect_preview, tables:[...]} — รองรับการตรวจผ่าน API เช่นกัน
- POST /api/shared-tables {op:disconnect, tables:[...], token, confirmation} — confirm
- mutations ใช้ auth, same-origin, app boundary และสิทธิ์ผู้พัฒนาเดิม ค่าจาก Frontend ไม่ใช่หลักฐานสิทธิ์
- Share/import/disconnect mutations ทำในเวอร์ชันจริง; ไม่เปลี่ยนสิทธิ์แชร์ใน Draft

## Files และจุดเชื่อมต่อ

- lib/shared-tables.ts: batch wrapper ใช้ private single-table importer เดิมซ้ำ และยอมรับ Ref ในชุดเดียวกัน
- lib/shared-table-disconnect.ts: impact simulation, stale-token checks, dependency/job guards, scoped cleanup
- lib/shared-table-schema.ts: batch limit ใช้ร่วมกันระหว่าง client/server ไม่มี migration ตารางใหม่ในงานนี้
- lib/applications.ts: ป้องกัน legacy unlink ทิ้ง overlay ค้าง
- app/api/shared-tables/route.ts และ lib/draft-request.ts: API / workspace validation
- SharedTableDialog.tsx: checkbox selection / dependency hints / cancel mode
- SharedDisconnectDialog.tsx: impact summary / confirmation
- shared-table-client.ts: แยก request helper เพื่อไม่ให้ UI components import วนกัน
- SharedTableSettings.tsx, Data page และ CSS: ปุ่มใหม่ / responsive layout

## หลักฐานทดสอบ

- Unit/regression: .test-data/shared-batch-unit-verified.log — 455 total: 448 passed, 0 failed, 7 POSIX-only skips บน Windows
- Unit ใหม่ครอบคลุม mutual Ref, dedup/batch limit, rollback ไม่มี grants/config ค้าง, preview read-only, stale token, wrong confirmation, Ref blockers, atomic unlink cycle, revoked links, running jobs/cross-table job snapshots, Header dependencies, ownership/Builder checks, revoked schema privacy และ legacy guard/explicit source revocation
- Development browser/API: .test-data/shared-batch-browser-second.log — Passed รวมการนำเข้า Ref คู่กัน การกดกลับจาก confirmation โดยไม่ unlink และตรวจว่าต้นทางยังมีข้อมูล
- ภาพ Desktop/mobile ตรวจด้วยตา: artifacts/shared-batch-import-mobile.png; artifacts/shared-disconnect-confirm-mobile.png; artifacts/shared-disconnect-blocked.png
- Initial browser failure เป็น fixture ที่ยังอยู่หน้า Data หลังเพิ่ม scenario ใหม่ แต่คาดปุ่มรีเจนของหน้าคอลัมน์ แก้ setup ให้ไปหน้าคอลัมน์ก่อนตรวจ โดยคง assertion เดิม
- Production Build และ API/Multi-app regression รอบส่งมอบบันทึกเพิ่มด้านล่าง

## ขอบเขต

ไม่ลบข้อมูลจริง ไม่แก้ Production/VPS/credentials/volumes และไม่ Deploy ทดสอบการเปลี่ยนข้อมูลเฉพาะ memory/disposable integration databases ภายใน .test-data เท่านั้น Physical iPhone และ Docker บน VPS ไม่ได้ทดสอบในงานนี้

การยกเลิกนำ local config ที่แสดงใน confirmation ออกจริง จึงควรใช้ backup เมื่อต้องการกู้กลับ ไม่ใช่แค่ซ่อนเมนู หากมีโครงสร้างเชื่อมกันต้องยกเลิกทั้งชุดหรือแก้ Ref ก่อน ไม่มีการลบ Ref/แก้สูตรของตารางอื่นให้อัตโนมัติ

### Permission details

A source grant with can_read=0 is an explicit revocation, not an absent grant. Even a Builder managing both apps must restore that source grant before re-importing; the importer refuses to create a successful-but-unreadable connection. Revoked connections remain available only for cleanup, and Builders without source management authority see their last local schema snapshot rather than newly added private source columns.

## Final verification

- Next 16 production build including TypeScript: Passed, exit 0 — .test-data/shared-batch-final-build.log
- Final production browser/API for shared tables: Passed, exit 0 — .test-data/shared-batch-final-sharedtables.log
- Final production API regression: 18/18 Passed — .test-data/shared-batch-final-api.log
- Final production multi-app regression: Passed — .test-data/shared-batch-final-multiapp.log
- Unit: 455 total / 448 passed / 0 failed / 7 POSIX-only skipped — .test-data/shared-batch-unit-verified.log
- git diff --check: Passed. Build-only synthetic DB path was not created.
- Responsive screenshots inspected after final test: shared-batch-import-mobile.png and shared-disconnect-confirm-mobile.png. Zero-impact resource groups are omitted from cards while totals remain visible.
