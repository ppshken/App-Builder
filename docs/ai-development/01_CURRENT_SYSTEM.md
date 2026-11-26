# การสำรวจระบบปัจจุบัน

สถานะจาก Source Code ที่ตรวจ 26 พฤศจิกายน 2569 การพบ implementation หมายถึงมีเส้นทางในโค้ด การทดสอบ Provider/Production และ baseline โหลดจริงจัดเป็นงานถัดไป

| โมดูล · สถานะ | หลักฐานและหน้าที่ | API / ข้อมูล / ตัวพึ่งพา | การใช้ซ้ำและความเสี่ยง |
|---|---|---|---|
| Frontend / State · Implemented | Next App Router, React ใน package.json, AppShell, AuthProvider, app/views/page.tsx | JSON API, UI state, client cache | Drawer และ Design System เดิม · กลาง หากสลับ app/workspace แล้ว state ค้าง |
| Backend / Service · Implemented | app/api ใช้ withAuth ใน lib/auth-api.ts; service ใน lib | Application scope, DB proxy, route DTO | ใช้ services เดิม · สูงหากเรียกนอก scope |
| SQLite / migration · Implemented | better-sqlite3, lib/db.ts, initializeDatabase ใน lib/schema.ts, lib/application-schema.ts | t_* และ _tables/_columns/_views; scoped metadata | ใช้ transaction เดียว · สูงเมื่อ schema lock หรือคัดลอกข้อมูลใหญ่ |
| Auth / App scope · Implemented | lib/auth.ts, lib/permissions.ts/accessFor, lib/access.ts/tableAccess, lib/row-access.ts | /api/auth, roles, grants, แอป/ตารางร่วมและ user scope | ตรวจสิทธิ์ซ้ำตอน apply · สูงต่อการแยกแอป |
| ตาราง/คอลัมน์ · Implemented | createBuilderTable/addBuilderColumn ใน lib/table-builder.ts, normalizeColumns ใน lib/metadata.ts | /api/tables, /api/tables/[name]/convert, _tables/_columns | ใช้ validation และ preview conversion เดิม · สูงต่อ Ref/ชนิดจริง |
| Relationships · Implemented | lib/schema-diagram.ts/diagramEdges, lib/lists.ts, lib/ref-options.ts | Ref/List metadata, /api/ref-options | ใช้ edge graph · สูงต่อ rename และสูตรข้ามตาราง |
| Expression · Implemented | lib/expression.ts, lib/columns.ts/formulaErrors, lib/formula-result-type.ts | /api/expression-data, lib/expression-context.ts, สูตรใน metadata | parser/validator เดิม · สูงด้านชนิดและงานอ่านตารางซ้ำ |
| View/Binding/Runtime · Implemented | app/run/page.tsx, lib/view-records.ts/readRows, lib/view-display.ts, lib/custom-binding-scope.ts | /api/views, /api/view-data, _views/_slices, lib/runtime-cache.ts | ใช้ View contract และ preview เดิม · กลางต่อ stale metadata |
| Form/Data write · Implemented | lib/columns.ts/formState/validateRow, lib/data-write.ts/writeRecord | /api/data/[table], rule/Ref/child writes | ใช้ validation กับ fixture · สูงหาก tool เข้าถึง live row write |
| Action · Implemented | lib/automation.ts, lib/action-config.ts, lib/bulk-actions.ts | /api/actions, /api/actions/bulk-execute, _actions | ใช้ contract definition · สูงด้านผลข้างเคียงขณะ execute |
| Workflow/PDF · Implemented | lib/workflows.ts/saveWorkflow/withoutWorkflows, lib/workflow-validation.ts, lib/workflow-runner.ts | /api/workflows, _automations/_automation_jobs/_pdf_templates | ร่าง disabled และใช้ simulation · สูงต่อ push/external/schedule |
| External · Implemented | lib/external-connector.ts, external-http.ts, external-storage.ts, external-worker.ts | _external_sources, ตาราง live/cached | ส่งเฉพาะชนิดและ schema ที่อนุญาต · สูงต่อ secret และ outbound |
| Release · Implemented | lib/releases.ts/createDraft, lib/development-workspace.ts/developmentOrigins, lib/release-publication.ts/publishDevelopment | /api/releases, workspace SQLite, _development_objects, rehearsal worker | ใช้ lineage และ rehearsal · สูงต่อ stale state และข้อมูลใหญ่ |
| Logs/Health/Performance · Implemented | lib/audit-log.ts, lib/app-usage.ts, lib/readiness.ts/inspectApp, lib/performance-report.ts, lib/formula-performance.ts | /api/audit-log, /api/readiness, /api/performance | สร้าง evidence DTO · สูงถ้าดึง payload/raw log |
| AI Gateway/Context · Partially Implemented | app/api/ai/assist/route.ts, lib/ai-assist.ts/chatProvider | OpenAI JSON mode, Gemini JSON Schema, 20 ตาราง × 30 คอลัมน์ตามอันดับ, 8 ครั้ง/นาทีต่อผู้ใช้และ 4 in-flight ต่อ process, timeout 25 วินาที | ทำ context กลางและอธิบายรายการถูกตัด · สูงต่อสิทธิ์และโควตาหลาย process |
| Copilot/Change · Partially Implemented | app/components/AiCopilotChat.tsx, lib/ai-data-design.ts, app/api/ai/design/route.ts, ai-view-draft.ts, ai-automation-draft.ts | sessionStorage สูงสุด 30 turn และส่งประวัติ 4 turn, draft approval UI, conversion dialog | สร้าง plan ledger, digest และหลักฐาน read-back · สูงต่อ retry และ approval drift |
| ทดสอบ/Deploy · Implemented | scripts/test.cjs, scripts/integration.cjs, tests/ai-assist.test.cjs, Dockerfile, compose.yaml | Playwright + isolated fixture, worker build, /api/health | ต่อยอด model evaluation/load test · กลาง ยังไม่ยืนยันสภาพ Production |

## ช่องว่างตามเป้าผลิตภัณฑ์

| ความสามารถ | ตอนนี้ | โอกาส |
|---|---|---|
| Understand | schema shortlist และสูตร | stable IDs, context ของ editor, graph, coverage |
| Analyze | readiness และ performance แยกหน้า | รายงานร่วมที่มีหลักฐานอ้างกลับ |
| Create / Modify | ตาราง คอลัมน์ Ref สูตร และร่าง View/Automation | นิยามแผนกลาง, Action และชุดหลายโมดูล |
| Debug & Fix | ตรวจสูตร ข้อมูล และโครงสร้างตามเครื่องมือ | Issue ID, diff, validation และ read-back เดียว |
| Optimize | Formula/API metrics | benchmark ก่อน–หลังด้วย fixture เดียว |
| Explain / Document / Recommend | Q&A และลิงก์ตั้งค่า | Data dictionary, รายงานอ้าง stable ID, ลำดับงานจากหลักฐาน |

## คะแนนความพร้อม

4 เกณฑ์ต่อด้าน เกณฑ์ละ 0 / 12.5 / 25 สำหรับยังไม่พบ / มีบางส่วน / พบตามเกณฑ์ คะแนนสะท้อน coverage ของโค้ด

| ด้าน | เกณฑ์และคะแนนย่อย | รวม |
|---|---|---:|
| Architecture | แยก route/service 25, runtime แยก AI 25, shared workflow 12.5, execution ledger 0 | 62.5 |
| Metadata | SQL catalog 25, typed validation 25, stable lineage 12.5, canonical DTO 0 | 62.5 |
| API | auth wrapper 25, DTO ราย route 25, conflict check 12.5, versioned plan contract 0 | 62.5 |
| Database | transaction 25, draft scope 25, rehearsal 25, rollback ราย AI plan 0 | 75 |
| Expression | parser 25, type check 25, diagnostics 25, AI provenance 12.5 | 87.5 |
| Tools | table service 25, workflow validation 25, shared adapters 12.5, registry 0 | 62.5 |
| Security | app scope 25, server auth 25, draft guard 25, AI policy/audit 12.5 | 87.5 |
| Performance | diagnostics 25, cache/projection 25, AI cap 12.5, quota หลาย process 0 | 62.5 |
| Testing | unit 25, integration 25, browser 25, model eval 12.5 จาก mocks | 87.5 |
| Scalability | ยังไม่มี baseline หลาย process, write contention, traffic หรือ Provider quota จริง | ยังประเมินไม่ได้ |
| AI Integration | adapter 25, assistant 25, mutation coverage 12.5, common eval gate 0 | 62.5 |

**ลำดับแก้หนี้** แยก context assembly จาก assist handler ก่อน เพิ่ม task-specific budget และตรวจ scope โดยบังคับ principal ที่ผ่านการยืนยัน เพราะ currentAccess มี fallback สำหรับ internal callers จากนั้นจัดการ plan provenance และ idempotency ก่อนเพิ่ม mutation ใหม่ สิ่งที่ทำได้เร็วคือแจ้ง context coverage ให้ผู้ใช้เห็น และล็อกกรณี regression ที่โมเดลบอกว่าสร้างตารางทั้งที่ไม่มีแผน
