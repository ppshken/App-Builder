# ตรวจแบบออกแบบกับกรณีใช้งานจริง

สถานะเป็นการตรวจแบบกับ Source Code และข้อเสนอ ผลการทดสอบจริงเป็น acceptance ที่ต้องทำตาม phase

| กรณี / Intent | บริบท, ลำดับและเครื่องมือ | ตัวอย่างผลแบบมีโครงสร้าง | Validation, ความปลอดภัย, Failure และ Acceptance |
|---|---|---|---|
| A สร้างระบบตรวจคุณภาพ มีฟอร์ม คะแนน อนุมัติ Dashboard | รับ requirements → ถามเกณฑ์คะแนนและผู้อนุมัติ → get_context/capabilities → build_blueprint → table/formula/view/action/workflow tools → preview/apply | blueprint.entities = inspections, checks, approvals, dashboard; ops ตาม Ref, workflow disabled | ตรวจ keys, score range, sample forms, role plan และ dashboard bindings; หากโจทย์ขาดสถานะหรือ role ให้ถามก่อน ความสำเร็จคือสร้างองค์ประกอบตาม blueprint และผ่าน rehearsal ใน phase 4 |
| B เพิ่มอนุมัติสองระดับ | อ่าน Workflow และ Action ที่มี → get_dependencies → เสนอ state transition รอตรวจ/ผ่าน 1/ผ่าน 2/ปฏิเสธ → preview_plan | impact.existingWorkflows, ops.addColumns, ops.createActions, ops.createDisabledWorkflow, evidenceId | ตรวจ role และ guard แต่ละ transition, ไม่มี workflow เดิมใน diff ยกเว้นผู้ใช้อนุมัติ หากชื่อชนหรือข้ามสถานะให้ reject; E2E แยกคนอนุมัติและทดสอบ workflow เก่า |
| C Optimize Valid_If ที่ SELECT ข้าม 30k แถว | get_definition + get_dependencies + get_diagnostics → เทียบสูตรเดิมและใหม่ใน fixture เดียว → validate_expression → เสนอ diff เฉพาะเมื่อ pattern ใช้ได้ | finding มี baseline candidate, rows p95/queries, evidenceId, equivalence fixtures | ตรวจผลสูตรทุกกรณีสำคัญ, duplicate/blank/permission filters; หากไม่มี metrics ให้ระบุสมมติฐานและวิธีวัด ถือว่าผ่านเมื่อผลเทียบเท่าพร้อมหลักฐานก่อน–หลัง |
| D วิเคราะห์ app ทั้งหมด | context ตามสิทธิ์ → analyze_app ตรวจ config/data dependency/performance ที่รองรับ → สรุปลำดับ | issues [{entityId,severity,evidenceId,confidence,nextStep}], coverage | ตรวจทุก entity ID และจำนวนที่ครอบคลุม ถ้าตัดเพราะ budget ต้องแสดงส่วนที่ขาด; ผ่านเมื่อพบ seeded issues โดยไม่มีการอ้างข้อมูลที่ยังไม่ได้ตรวจ |
| E สร้างเอกสารหน้างาน | get_context/get_definition ตามหน้า → ออก data dictionary, graph, สูตร, workflow และคู่มือ | document.sections [{title,entityIds,revision,content}], excluded scopes | redact literals/secrets/logs, re-run เมื่อ revision เปลี่ยน, แสดง missing definitions; ผ่านเมื่อผู้ตรวจเปิดย้อนทุกหัวข้อได้และไม่มี schema ที่แต่งขึ้น |
| F กู้คืนเมื่อสร้าง Table+Column+View+Workflow ล้มกลางทาง | preview → approve → apply transaction → inject failure ก่อน Workflow → query receipt → retry เมื่อแก้แล้ว | state=failed, code=VALIDATION_FAILED, committedOps=0; ครั้งสำเร็จมี receipt+entities | ห้ามยิงงานข้างเคียง, rollback metadata และ DDL, ตรวจ database ก่อน–หลังเหมือนเดิม, replay key ไม่ซ้ำ; ถ้า adapter ยังทำ atomic batch ไม่ได้ให้หยุดก่อน apply และแยกแผน |

## ตัวตรวจที่เชื่อมกับของเดิม

ใช้ createBuilderTable/addBuilderColumn/normalizeColumns สำหรับ A/B, formulaTypeCheck และ formula-performance สำหรับ C, inspectApp และ performanceReport สำหรับ D, diagramEdges และ scoped definitions สำหรับ E, workspace isolation/SQLite transaction พร้อม receipt ใหม่สำหรับ F งานสร้าง permissions, ส่งออกเอกสาร, และรัน Blueprint หลายโมดูลจะเริ่มหลัง capability adapters ของ Phase 3–4 พร้อม
