# สัญญาเครื่องมือ แผนเปลี่ยนแปลง และการจัดเก็บ

รายละเอียดเป็นข้อเสนอ ใช้ Builder services เดิมผ่าน adapter ตรวจอินพุตทั้งจากโมเดลและ browser ฝั่ง server โมเดลเห็นเครื่องมืออ่านและ schema สำหรับ proposal ส่วนการอนุมัติ เขียน และย้อนใช้ได้จาก Builder UI ผ่าน principal จริง

## JSON Schema ของเครื่องมือ

ตารางใช้รูปย่อของ JSON Schema ที่แปลงได้ตรงตัวเป็น object โดย key ที่มี ? คือ optional, s คือ string, id คือ opaque string, i คือ bounded integer, b คือ boolean, [] คือ array, E คือ error envelope ทุก object ใช้ additionalProperties=false และตรวจขนาด/enum ที่ registry ตัว validator เดิมตรวจ nested config และแปลงเป็น canonical shape ก่อนคำนวณ digest

```json
{"type":"object","additionalProperties":false,"required":["formula","columnId","field"],
 "properties":{"formula":{"type":"string","maxLength":4000},"columnId":{"type":"string","maxLength":128},
 "field":{"enum":["virtual_expr","default_expr","valid_if","show_if","editable_if","required_if"]}}}
```

ผลลัพธ์ validate_expression มี valid (boolean), issues (array ของ code/path/evidenceId), resultType (string หรือ null) และ revision (string) Route ใช้รหัส ERROR แบบเดียวกัน ไม่มี SQL หรือข้อความ upstream ดิบ

| Tool / คำอธิบาย | Input → Output JSON shape | สิทธิ์, validation, side effects, ความเสี่ยง |
|---|---|---|
| get_context / บริบทและรายการคอมโพเนนต์ | {selectedId?:id, kinds?:s[], cursor?:s, limit?:i} → {revision:s, entities:Entity[],coverage:Coverage,cursor?:s} | AI read + scope, filter accessible, page ≤ 50 · อ่าน · ต่ำ |
| get_definition / สคีมา View Action Workflow สูตร | {entityId:id,revision:s} → {entity:Entity,definition:ScopedDTO,evidenceId:id} | ตรวจการเข้าถึง entity/field และ revision · อ่าน · กลาง |
| get_dependencies / ความสัมพันธ์และผู้ใช้ต่อ | {entityId:id,depth:i} → {edges:Edge[],unresolved:i,revision:s} | จำกัด depth ≤ 3/จำนวน edges, ซ่อนปลายทางที่อ่านไม่ได้ · อ่าน · ต่ำ |
| get_diagnostics / ค่าวัดและปัญหาที่บันทึก | {kind:s,entityId?:id,window:s} → {evidence:Metric[],coverage:Coverage} | allowlist window/metrics ไม่รับ SQL, redact · อ่าน · กลาง |
| validate_expression / ตรวจสูตร | {formula:s,columnId:id,field:s} → {valid:b,issues:Issue[],resultType:s,revision:s} | เครื่องมือตรวจ syntax/type/dependency แบบ scoped · อ่าน · กลาง |
| analyze_app / ตรวจสุขภาพและ config | {entityId?:id,checks:s[]} → {issues:Issue[],coverage:Coverage} | ชุดตรวจที่กำหนดและจำกัดเวลา เริ่มจาก inspectApp · อ่าน · กลาง |
| build_blueprint / สร้าง proposal | {requirements:s,contextRevision:s} → {blueprint:Blueprint,unresolved:s[]} | เฉพาะเครื่องมือที่ registry รองรับ ไม่มีการเขียนแอป · กลาง |
| preview_plan / ประเมินผลกระทบ | {planId:id} → {digest:s,diff:Diff[],issues:Issue[],risk:s} | owner + current revision, dry-run ในพื้นที่แยก, จำกัดแถว ออก plan record · กลาง |
| table.create / table.rename_label | {opId:id,label:s,name?:s,tableId?:id} → {entityId:id,revision:s} | app owns, validate internal identifier, createBuilderTable, ไม่มี rename physical ใน MVP · เขียน draft · กลาง |
| column.add / column.configure | {opId:id,tableId:id,columnId?:id,definition:ColumnDTO} → {entityId:id,revision:s} | allowlist type/rule, normalizeColumns, ตรวจ collisions และ dependencies · เขียน draft · กลาง |
| relationship.create | {opId:id,childTableId:id,columnName:s,targetTableId:id} → {columnId:id,targetTableId:id} | สิทธิ์เขียนตารางลูกและอ่านปลายทาง ตรวจ Ref ผ่าน metadata · เขียน draft · สูง |
| column.convert / ref.retarget | {columnId:id,target:ConversionDTO,reviewToken:s} → {result:s,revision:s} | ใช้ conversion dialog/token เดิมพร้อมสิทธิ์และ fingerprint · เขียน draft เฉพาะทาง · สูง |
| formula.update | {opId:id,columnId:id,field:s,formula:s} → {entityId:id,revision:s} | ตรวจ parser/type/dependency และสูตรเดิม ตีความ empty เฉพาะ field ที่อนุญาต · เขียน draft · กลาง |
| view.create / view.configure | {opId:id,tableId:id,viewId?:id,definition:ViewDTO} → {entityId:id} | ใช้ View editor validator ตรวจ layout/binding · เขียน draft · กลาง |
| action.create | {opId:id,tableId:id,definition:ActionDTO} → {entityId:id} | whitelist action definition, preview formula, ห้าม execute · เขียน draft · สูง |
| workflow.create | {opId:id,tableId:id,definition:WorkflowDTO} → {entityId:id,enabled:b} | validateWorkflow, บังคับ disabled, ตรวจ action/trigger ที่อนุญาต · เขียน draft · สูง |
| apply_plan | {planId:id,digest:s,previewRevision:s,idempotencyKey:s} → {receiptId:id,state:s,entities:id[]} | Builder approve, CSRF, verify principal/scope/revision · เขียน draft · สูง |
| get_execution / verify_execution | {planId:id} → {state:s,receiptId?:id,verification:Issue[]} | ตรวจ actor/scope, read-back หลัง commit, status polling · อ่าน · ต่ำ |
| create_snapshot / rollback_plan | {planId:id,digest:s,idempotencyKey:s} → {snapshotId?:id,receiptId?:id,state:s} | ผู้มีสิทธิ์อนุมัติและ current head, เฉพาะ before image/operation ที่รองรับ · เขียน draft · สูง |

**ข้อกำหนดร่วมรายกลุ่ม** เครื่องมืออ่านใช้ revision เป็น cache key และ retry ที่ปลอดภัย ไม่มี transaction เขียนและไม่ต้อง rollback เมื่อ scope หายให้ 403 แผนที่เปลี่ยนแล้วใช้ 409 เครื่องมือ preview ใช้ plan+digest เพื่อคืนผลเดิมเมื่อยังสด บันทึกผลตรวจแยกและทิ้ง sandbox หลังจบ ส่วน mutation ที่รองรับชุดเดียวใช้ unique key บน workspace+plan+op และ transaction ภายใน database เดียวกับ receipt ถ้าเกิด validation/deadline หรือ read-back ไม่ตรงให้ rollback ทั้งชุด Conversion ใช้ token และ transaction เดิม มี receipt ทางเดินแยกเมื่อพัฒนา adapter แล้ว หาก adapter ใดไม่สามารถเข้าร่วม transaction เดียว ให้แยกแผนหรือเลื่อนไป phase ถัดไป Recovery ถูกห้ามเมื่อ before image ไม่ครบหรือ revision เปลี่ยน

## Change Plan และฐานข้อมูล

```json
{"schemaVersion":1,"planId":"plan_1","appId":"app_resolved","workspaceId":"draft_resolved",
 "baseRevision":"r1","contextVersion":1,"intent":"เพิ่มช่องบันทึก",
 "objectives":["เก็บเหตุผล"],"operations":[{"id":"op_1","kind":"column.add",
 "target":"table:uid","dependsOn":[],"input":{"name":"reason","type":"text"},
 "before":null,"after":{"name":"reason","type":"text"}}],
 "risk":"medium","impact":{"entities":["table:uid"],"writesRows":false},
 "validation":{"state":"passed","issues":[]},"approval":{"required":true,"digest":"approved-shape"},
 "rollback":{"mode":"inverse-if-head-unchanged"},"acceptance":["พบคอลัมน์ใน metadata และ schema"]}
```

- แผน: id, actor/app/workspace จาก session, schema version, digest, base revision, op order, risk, expiresAt, state เสนอใน platform ledger เก็บเฉพาะ diff ที่จำเป็น ACL ตามแอปและ actor
- Ledger อนุมัติและคำขอ: unique (workspace, plan, idempotency_key), บันทึก approved digest/actor/time, ไม่มีข้อความจากโมเดลใช้แทน approval
- Receipt commit: แถว receipt ใน workspace DB เดียวกับ atomic apply เพื่อปิดช่อง crash ระหว่างเขียนสองฐานข้อมูล platform ledger อ่านผลจาก receipt แล้ว synchronize แบบ retry-safe อย่าใช้การเขียนสองฐานเป็น transaction เดียว
- Telemetry/audit: request/correlation ID, provider/model, input/output tokens, duration, op IDs, revision, error code, result ใช้ระบบ audit เดิมประกอบ รายละเอียดก่อน–หลังเก็บตามนโยบายและสิทธิ์ การสนทนาบน server เป็น opt-in แยกต่างหาก
- ค่าเริ่มต้นที่เสนอให้อนุมัติ: preview 15 นาที, แผน 14 วันหรือตาม workspace, receipt/audit 90 วัน แล้วลบตามนโยบาย หลักฐานการลบและการ revoke เข้าถึงต้องมี รองรับเปิดอ่าน legacy draft/clients ด้วย feature flag กับ schemaVersion ที่รู้จัก

## API และ state machine

| API ที่เสนอ | ความหมาย |
|---|---|
| POST /api/ai/plans | รับ intent และ selected ID คืน proposal ID จาก scoped context |
| POST /api/ai/plans/{id}/preview | อ่าน baseline, dry-run, คืน canonical diff และ digest |
| POST /api/ai/plans/{id}/approve | validate CSRF และ revision, จดอนุมัติ digest เฉพาะแผน |
| POST /api/ai/plans/{id}/apply | ตรวจ approval และ lock, apply/re-read/commit พร้อม receipt |
| GET /api/ai/plans/{id} | สถานะ, issues, receipt และลิงก์คอมโพเนนต์ |
| POST /api/ai/plans/{id}/rollback | เปิด reverse plan สำหรับหัว revision ที่ยังตรงและผู้ใช้อนุมัติ |

คง /api/ai/assist, /api/ai/design และ API เครื่องมือเดิมระหว่างเปลี่ยนผ่าน เริ่มด้วย adapter ใน service layer ภายใน ไม่ใช้ server ยิง HTTP กลับหา route เพื่ออาศัยสิทธิ์ลัด State เปลี่ยน proposed → reviewed → approved → applying → verified ตามหลักฐานจาก SQLite กรณี policy/revision ไม่ตรงให้ rejected/stale กรณี exception ให้ failed พร้อม rollback Client timeout หลัง commit ให้ GET receipt ก่อน retry ใช้ idempotency key เดิม เส้นทางเผยแพร่ Production ยังแยกจาก AI approval โดยใช้งาน rehearsal และ publication review เดิม
