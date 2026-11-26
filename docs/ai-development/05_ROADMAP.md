# Roadmap และแผนงานพัฒนา

คน-วันรวมพัฒนา รีวิว และ QA สำหรับนักพัฒนา full-stack 2 คนที่รู้ระบบ, QA 0.5 คน, ผู้อนุมัติพร้อมตอบและใช้ SQLite/CI เดิม คิดเวลาแบบช่วง ยังไม่รวมเวลารออนุมัติ Provider หรือ migration Production

## MVP และ Dependency Matrix

MVP รองรับ Ask/Analyze ขั้นพื้นฐาน + Plan/Build ในพื้นที่พัฒนา กับตาราง คอลัมน์ Ref และสูตรที่ Engine รองรับ ก่อนยืนยันมี diff, dependency, validator, actor/revision และ receipt ย้อนเฉพาะ config ที่พิสูจน์ว่าปลอดภัย การแปลงและย้าย Ref เข้าหน้าตรวจเดิม ร่าง View/Automation เดิมยังใช้ได้ การสร้าง Action/Workflow/Aggregate Blueprint ผ่าน registry อยู่ระยะ Core

| Phase / ความสำคัญ / คน-วัน | เป้าหมาย งาน และสิ่งส่งมอบ | พึ่งพา / ไฟล์ / การเปลี่ยน API และ DB | ความเสี่ยง / การทดสอบ / DoD และ Exit |
|---|---|---|---|
| 0 · P0 · 5–8 | ตรวจ baseline, map existing service, ทำ fixture และสำรวจ metadata/ความลับ | เอกสารชุดนี้, scripts/integration.cjs, tests/ai-assist.test.cjs, ไม่มี schema/API | ความเสี่ยงคือผลต่าง dev/prod; exit เมื่อบันทึก baseline hardware, fixture และ owner ของแต่ละ adapter |
| 1 · P0 · 12–18 | แยก Gateway/Context/Registry, adapter/usage, intent, read tools และการผูก session | หลัง 0; app/api/ai/assist, lib/ai-assist.ts, application-context/permissions; เพิ่ม DTO และ usage ledger migration ที่ย้อน compatible | unit context/ACL/cache, provider mock, limit/cancel; exit เมื่อไม่มีข้อมูลนอก allowlist และ API เดิมทำงาน |
| 2 · P1 · 7–11 | Contextual analyzer, สูตร, evidence output, brief app summary และ recommendations ในขอบเขตที่ตรวจได้ | หลัง 1; expression/readiness/performance; evidence DTO ใน Gateway ไม่มีแถวใหม่ใน business schema | เสี่ยงความครอบคลุมเกินจริง; exit เมื่อผู้ใช้คลิกเปิดต้นทางจาก finding ได้และข้อความที่ไม่มีหลักฐานถูกป้ายกำกับ |
| 3 · P1 · 12–18 สำหรับ MVP | plan, dry-run, approval, atomic apply, audit/receipt/inverse ที่รองรับ, migrate table/ref/column/formula | หลัง 1 และ validator จาก 2; ai/design, table-builder, metadata, draft-request; เพิ่ม plans endpoints และ ledger/receipt | stale, re-entry, write lock; exit เมื่อ E2E, rollback fault, idempotency และ cross-app fixtures ผ่าน |
| 3 ต่อ · P2 · 10–17 | เพิ่ม View/Action/Workflow adapters, preview bindings, ปิดผลข้างเคียง | หลัง 3 MVP; app/api/views/actions/workflows, lib/workflow-validation; reuse metadata tables | exit เมื่อ dry-run มองเห็นสิ่งอ้างอิงครบ และ workflow/app action ยังไม่ทำงานจนผู้ใช้เปิดตามปกติ |
| 4 · P2/P3 · 14–24 | Blueprint จาก requirements, สร้าง schema/UI/form/rule/workflow ทีละช่วง, verification | หลัง 3 ต่อ; ใช้ app lifecycle, views และ workflow APIs ผ่าน adapters; blueprint DTO เก็บใน plan ledger | เสี่ยง scope กว้าง; E2E ชุด A/B/F และ exit เมื่อ task completion ตามเกณฑ์ |
| 5 · P3/P4 · 15–30 แบบมีเงื่อนไข | Orchestration หลายขั้นแบบหยุดรอ, re-plan เมื่อเกิดข้อผิดพลาด, optimize จากหลักฐาน | หลัง 4 + ข้อมูล pilot; reuse worker, เพิ่ม execution checkpoints เฉพาะที่จำเป็น | คุม loop และค่าใช้จ่าย; exit เมื่อชนะ human-approved single plan ตามเวลา/คุณภาพและ 0 ข้ามสิทธิ์ |
| 6a · P0 · 5–8 | Production gates ขั้น pilot, load/security/eval, telemetry/feature flag และ runbook | ทำร่วม 1–3; lab, CI, app feature settings; deploy เข้ากลุ่ม pilot | exit เมื่อ checklist เอกสาร 04 ครบ และมีวิธีปิด Feature |
| 6b · P2 · 6–12 | งาน hardening ก่อน rollout กว้าง, alert/cost, ทดสอบหลาย process และ recovery | หลัง pilot และ scope ที่อนุมัติ; reuse monitoring/queue; อาจมี shared quota store เมื่อมีหลักฐาน | exit เมื่อ SLO และ recovery ผ่านที่โหลดเป้าหมายพร้อม owner รับผิดชอบ |

MVP รวม 0,1,2,3 MVP,6a เท่ากับ 41–63 คน-วัน หรือประมาณ 5–9 สัปดาห์ตามเวลารวมและงานที่ทำขนานได้ Critical path คือ baseline → scope/context → plan/validator → receipt และ atomic apply → E2E/security gates ชุด evaluation, wireframe, เอกสาร Provider และ diagnostics adapter ทำคู่ขนานได้

รูปแบบงบสำหรับตัดสินใจคือ 41–63 × ต้นทุนเฉลี่ยต่อคน-วัน + ค่าเครื่องทดสอบ/CI + งบ Provider ตามจำนวนคำขอ หลัง MVP งาน 3 ต่อ/4/6b รวม 30–53 คน-วัน ส่วน Phase 5 เป็นงบแยก 15–30 คน-วันและต้องผ่านเกณฑ์คุ้มค่าจาก pilot ก่อน สภาพเครื่องและอัตราค่าแรงจริงยังประเมินไม่ได้จาก Repository

## Backlog จาก Epic ถึง Task

| งาน / Epic / Story | ประเภท / ลำดับ / ความยาก / คน-วัน | พึ่งพา / จุดลงมือ | ทดสอบ เกณฑ์รับมอบและ DoD |
|---|---|---|---|
| AI-00 Evidence · ผู้ดูแลต้องรู้ baseline และ fixture | สำรวจ · P0 · 2/5 · 5–8 | scripts/integration, performance reports | เก็บผล before และรองรับ rerun ด้วย dataset เดิม |
| AI-10 Context · ผู้พัฒนาถามจากแอปและคอมโพเนนต์ปัจจุบัน | Refactor · P0 · 4/5 · 5–8 | 00, ai/assist, application scope, metadata | scoped IDs, truncation และ revoke tests ผ่าน |
| AI-11 Gateway · ผู้ดูแลเลือก Provider และควบคุมงบ | Refactor/ใหม่ · P0 · 3/5 · 4–6 | 00, ai-assist.ts; normalized provider contract | ตรวจ 429, timeout, invalid schema, no-key และ cost counters |
| AI-12 Registry · ผู้ใช้ AI ต้องได้คำแนะนำที่ Engine ทำได้ | ใหม่ · P0 · 3/5 · 3–4 | 00, expression/columns/view/workflow validators | generated registry ตรงเครื่องมือและฟังก์ชันที่เปิดจริง |
| AI-20 Analyzer · ผู้ใช้เปิดหลักฐานและบรรทัดที่เกี่ยวข้อง | ใหม่ · P1 · 3/5 · 7–11 | 10/12, readiness/performance/formula dependencies | click-through, evidence provenance และคำตอบกรณีข้อมูลไม่ครบ |
| AI-30 Plan/Preview · ผู้ใช้ตรวจ diff และผลกระทบก่อนยืนยัน | ใหม่ · P1 · 4/5 · 5–7 | 10/12, ai/design, metadata; plan DTO/ledger | stale, dependency/validator, preview zero-side-effects |
| AI-31 Executor · ผู้ใช้ retry ได้และรู้ผลจริง | ใหม่/Refactor · P1 · 5/5 · 7–11 | 30, table-builder, draft-request, receipt, scopes | fault หลังขั้นแรก rollback, retry once, read-back, audit และ legacy regression |
| AI-32 Core adapters · ผู้ใช้สร้าง View/Action/Workflow ผ่านแผน | Refactor/ใหม่ · P2 · 4/5 · 10–17 | 31, validators ใน routes และ workflow service | binding/action references ถูกต้องและ draft events suppressed |
| AI-40 Blueprint · ผู้ใช้เริ่มสร้างแอปธุรกิจจากความต้องการ | ใหม่ · P2/P3 · 5/5 · 14–24 | 32, app lifecycle, component registry | A/B ผ่านและผู้ใช้ตรวจทุกจุดก่อนเผยแพร่ |
| AI-50 Orchestration · งานยาวหยุดและกลับมาทำได้ | ใหม่แบบมีเงื่อนไข · P3/P4 · 5/5 · 15–30 | 40, worker และ pilot evidence | bounded steps, recovery, rerun และค่าทดสอบดีขึ้นตามเกณฑ์ |
| AI-60 Pilot gate · ผู้ดูแลเปิดเป็นกลุ่มและปิดได้ | ใหม่ · P0 · 3/5 · 5–8 | 00,11,30,31; eval CI, ops runbook | ผ่าน checklist, SLO และ cost gate โดย Runtime เดิมยังทำงาน |
| AI-61 Rollout · ทีมดูแลรองรับโหลดและการกู้คืน | ใหม่ · P2 · 3/5 · 6–12 | 60, pilot metrics | วัด peak/load, kill-switch, rollback drill และ sign-off |

P0 คือฐานและตัวกั้นความเสี่ยง P1 พิสูจน์คุณค่ากับผู้สร้างแอป P2 ลดงานข้ามโมดูล P3/P4 เพิ่มเมื่อ throughput ของ Copilot รุ่นยืนยันทีละแผนยังไม่เพียงพอ ลำดับนี้เลื่อน security/evaluation ขึ้นจากท้ายแผน เพื่อทดสอบก่อนเปิดให้ AI เขียนแม้ในพื้นที่พัฒนา

## สถานะการลงมือพัฒนา

- AI-10 บางส่วน · การเลือกตารางและคอลัมน์ตามคำขอ, ขอบเขต Ref ที่อ่านได้ และตัวเลขแสดงความครอบคลุมอยู่ใน lib/ai-context.ts และ /api/ai/assist ส่วน stable ID และ cache ที่ผูกกับ revision ยังอยู่ในแผน
- AI-30 บางส่วน · Copilot ทดลองแผนโครงสร้างใน transaction ที่ย้อนเสมอ ก่อนอนุญาตให้กดยืนยัน ฝั่ง apply ของ UI ส่ง fingerprint ซึ่งผูกผู้ใช้ แอป พื้นที่พัฒนา โครงสร้างที่อ่านได้ และแผนที่ตรวจแล้ว API แบบเดิมยังอยู่ระหว่างเปลี่ยนผ่าน
- AI-31 บางส่วน · Copilot แยกขั้นตรวจ อนุมัติ และนำไปใช้ ผลตรวจหมดอายุใน 15 นาทีและผูกผู้ใช้ แอป และพื้นที่พัฒนา ประวัติบอกสถานะอนุมัติก่อนลงมือเขียนและมี receipt เมื่อบันทึกแล้ว ย้อนแผนแบบแก้เฉพาะสูตร เงื่อนไข ข้อความแจ้งเตือน หรือชื่อที่แสดงได้เมื่อข้อมูลหลังบันทึกยังตรง ขณะเปลี่ยนผ่านยังคง request แบบเดิมสำหรับผู้เรียก API เดิม ส่วนการกู้คืนแผนเปลี่ยนโครงสร้างจริงยังอยู่ในแผน
- AI-31 เปิดแผนต่อ · เก็บแผนที่ตรวจแล้วไว้ในฐานฉบับร่าง เปิดต่อได้หลังรีเฟรชเมื่อแผนผ่านการอนุมัติและยังไม่หมดอายุ ตรวจสมาชิกและสิทธิ์อีกครั้งเมื่อเปิด และลบเนื้อหาแผนเมื่อบันทึกสำเร็จโดยเก็บรหัสยืนยันและเวลาไว้ในประวัติ
- AI-31 ยกเลิกแผน · ผู้สร้างแผนยกเลิกผลตรวจที่ยังไม่หมดอายุได้ทั้งก่อนและหลังอนุมัติ ตราบใดที่ยังไม่ได้นำไปใช้ ระบบเก็บเวลาในประวัติและลบเนื้อหาที่ใช้เปิดแผนต่อ
- AI-32 บางส่วน · เพิ่ม View ชนิดตารางและรายการในเมนูได้พร้อมการสร้างตารางและคอลัมน์ในแผนเดียว ใช้ตัวตรวจของ API View เดิม และตรวจอ่านกลับใน transaction ก่อนบันทึก ส่วน Action, Workflow และการแก้ View เดิมอยู่ในแผนระยะนี้
- AI-32 Action · เพิ่ม Action อัปเดตแถวในแผนได้ ใช้ตัวบันทึกเดียวกับหน้า Action ตรวจเงื่อนไขและชนิดผลลัพธ์ของสูตร และแสดงการอ่านค่าจากแถวก่อนอัปเดต การตรวจและนำแผนไปใช้บันทึกเฉพาะนิยาม Action
