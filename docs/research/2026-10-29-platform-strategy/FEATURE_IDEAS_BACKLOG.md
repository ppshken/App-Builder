# Feature Ideas Backlog — 36 ข้อ

วันที่ 29 ตุลาคม 2026. ทั้งหมดเป็น **Proposed / ยังไม่ได้พัฒนาในรอบนี้**. [Currentinventory](CURRENT_SYSTEM_CAPABILITIES.md) คือ baseline; Cxx อ้างถึงตาราง capabilities. [Sxx](COMPETITOR_RESEARCH.md) คือ officialsources ตรวจ 2026-10-29; Lxx คือ candidate license ใน [GapAnalysis](FEATURE_GAP_ANALYSIS.md#library--license-candidates). Design ของเราเป็น inference/ข้อเสนอ ไม่อ้างว่า vendor ใช้ architecture เดียวกัน

## สมมติฐานแรงงาน

1person-day=8 ชั่วโมงของผู้มีประสบการณ์ codebase; ช่วงประมาณรวม implementation, migration, unit/integration/negativechecks และ QAreview พื้นฐาน ไม่รวมรอ vendor, legal, infrastructureprovisioning, data-cleanup, penetrationtest หรือผู้ใช้ acceptance. Confidence คะแนนเป็นสมมติฐานจาก code ไม่ใช่ measuredcustomer demand. Complexity1=smalllocalchange,5=หลาย boundary/stateful/distributedrisk. Dependencies ชี้ MVP ขั้นต่ำ ไม่ใช่ต้องทำทุก phase ของ feature ก่อนเริ่มงานถัดไป

PriorityP1=ควรทำ, P2=ตาม usecase/หลัง foundation, P3=ระยะยาว/ลงทุนเมื่อมี demand; ไม่ใช่ AuditSeverity. Effort เป็น fullMVP ของแต่ละบัตร; partialspike ใน Roadmap นับแยก ไม่บอก fullfeature เสร็จจาก spike

## A. Core App Builder

### A01 — Versioned App Package & Migration Plan

| Field | Specification |
|---|---|
| Feature ID / Name | A01: Versioned App Package & Migration Plan |
| Current status / extension | C04/C15/C36 Partial |
| Description | portable AppSpec envelope พร้อม version และ migration review |
| Real use case | ส่งแอปตรวจรถไป staging โดยไม่พาข้อมูลจริงไป |
| User value | ลดการตั้งค่าซ้ำและเป็นฐานให้ templates/AI/extensions |
| Technical architecture | canonical app schema + stable IDs + reference visitor; adapters จาก metadata เดิม |
| Backend changes | export/validate/plan dry-run; import apply ผ่าน services เดิม ไม่รับ SQL จาก package |
| Frontend changes | diff/dependency warnings/destructive-change review |
| Database changes | เพิ่ม package/migration ledger; per-appmetadata ยังใช้เดิม |
| Dependencies | ไม่มี feature ใหม่ที่ต้องรอ; ใช้ securityguard/validator เดิม |
| Security implications | ห้าม importusers/secrets/rolegrants โดยอัตโนมัติ; boundbytes/nodes; checksum ไม่แทน trust |
| Complexity (1–5) | 4 |
| Estimated effort | 18–28 person-days ตามสมมติฐานด้านบน |
| Expected impact (1–5) | 5 (hypothesis) |
| Priority | P1 |
| MVP scope | export/import config-only + schema drift detection; ยังไม่ applydestructiveDDL |
| Acceptance criteria | roundtrip2apps เท่ากัน; wrongversion/ref ปฏิเสธ; drift ให้ 409; rollbackconfig ไม่กระทบ rows |
| Candidate OSS / commercial limits | L01; license/notice และขอบเขต paid อยู่ใน GapAnalysis; ยังไม่ติดตั้ง |
| Placement | Core |
| Inspiration / checked | S08,S32,S33; 2026-10-29, ดู sourceURLs ใน CompetitorResearch |

### A02 — Business App Recipes / Template Installer

| Field | Specification |
|---|---|
| Feature ID / Name | A02: Business App Recipes / Template Installer |
| Current status / extension | C06 มี clone; reusabletemplates Missing |
| Description | แพ็ก schema+views+actions+roles แบบ parameterized |
| Real use case | สร้างระบบใบลา/ตรวจรถ/asset จากสูตรสำเร็จ |
| User value | maker เริ่มจากงานจริงแทนหน้าว่าง |
| Technical architecture | AppSpec template + ID remap + dependency preflight |
| Backend changes | install dry-run; demo seed opt-in แยก; atomicapply |
| Frontend changes | เลือก template/map ชื่อ table/preview สิทธิ์ |
| Database changes | template catalog/install receipts; ไม่ copy บัญชี |
| Dependencies | A01 |
| Security implications | templateuntrusted; freshrolesdefaultdeny; sharedtable ต้อง explicit |
| Complexity (1–5) | 3 |
| Estimated effort | 12–18 person-days ตามสมมติฐานด้านบน |
| Expected impact (1–5) | 5 (hypothesis) |
| Priority | P1 |
| MVP scope | 3first-partyrecipes; no publicmarketplace |
| Acceptance criteria | install3recipes เป็น newapp; collisionsremap; cancel ไม่มี mutation; repeatedinstall ไม่ทับแอป |
| Candidate OSS / commercial limits | L00; license/notice และขอบเขต paid อยู่ใน GapAnalysis; ยังไม่ติดตั้ง |
| Placement | Optional |
| Inspiration / checked | S14,S28; 2026-10-29, ดู sourceURLs ใน CompetitorResearch |

### A03 — Cross-app Dependency & Change Impact Explorer

| Field | Specification |
|---|---|
| Feature ID / Name | A03: Cross-app Dependency & Change Impact Explorer |
| Current status / extension | C23/C18 มี diagram/refchecks/rename บางส่วน |
| Description | แสดง impact ต่อ formula/view/workflow/permissions/customnodes ข้ามแอป |
| Real use case | ก่อนเปลี่ยนคอลัมน์ที่ใช้ในหลายแอป |
| User value | ลด breakage และเวลาไล่ซ่อม |
| Technical architecture | typed reference graph จาก visitors; reuseformula-dependencies/schema-diagram |
| Backend changes | read-only impact API; ตรวจ coverage ของ renamevalidators |
| Frontend changes | impact tree + jump-to-editor + plannedchanges |
| Database changes | MVP computedgraph ไม่ persist; indexcache ตาม metadatarevision ภายหลัง |
| Dependencies | ไม่มี feature ใหม่ที่ต้องรอ; ใช้ securityguard/validator เดิม |
| Security implications | ไม่เปิดชื่อ schema ของแอปที่ actor ไม่มีสิทธิ์ |
| Complexity (1–5) | 3 |
| Estimated effort | 8–14 person-days ตามสมมติฐานด้านบน |
| Expected impact (1–5) | 4 (hypothesis) |
| Priority | P1 |
| MVP scope | inspect/delete/rename plan โดยยังไม่ rewrite เพิ่ม |
| Acceptance criteria | fixture ครอบคลุม Ref/slice/action/PDF/custom/role; cycle ไม่ hang; unauthorizedapp ไม่ leak |
| Candidate OSS / commercial limits | L02; license/notice และขอบเขต paid อยู่ใน GapAnalysis; ยังไม่ติดตั้ง |
| Placement | Core |
| Inspiration / checked | S10,S33; 2026-10-29, ดู sourceURLs ใน CompetitorResearch |

## B. Data & Database Engine

### B01 — Permission-aware Query Planner & Delegation

| Field | Specification |
|---|---|
| Feature ID / Name | B01: Permission-aware Query Planner & Delegation |
| Current status / extension | C03/C18/C30 มี SQLpaging แต่ fallbackscan |
| Description | compilefilter/sort/aggregate และ rowrulessubset เป็น parameterizedSQL |
| Real use case | เปิด table100krows พร้อม rowrule โดยไม่โหลดทุกแถว |
| User value | ความเร็วและต้นทุน RAM ที่คาดการณ์ได้ |
| Technical architecture | typed QueryPlan AST + dialect/capabilities; reference evaluator เป็น oracle |
| Backend changes | plan/explain/pushdown; unsupportedrule bounded fallback พร้อม warning |
| Frontend changes | delegationbadge/querycost warning ไม่บอก partial ผลว่า complete |
| Database changes | ไม่ย้าย DB; indexes เลือกต่างหาก B02 |
| Dependencies | F01 |
| Security implications | authorizationpredicate ต้องเกิดก่อน pagination/count; ไม่ใช้ rawLLMSQL |
| Complexity (1–5) | 5 |
| Estimated effort | 25–40 person-days ตามสมมติฐานด้านบน |
| Expected impact (1–5) | 5 (hypothesis) |
| Priority | P1 |
| MVP scope | eq/range/AND/order/count บน physicalcolumns+simpleUSERIDrules |
| Acceptance criteria | compareSQL กับ reference200cases; rolecounts ตรง; nooverfetch; 100kfixturememorybounded; p95 เป้าหมาย 500ms ต้อง benchmark |
| Candidate OSS / commercial limits | L00; license/notice และขอบเขต paid อยู่ใน GapAnalysis; ยังไม่ติดตั้ง |
| Placement | Core |
| Inspiration / checked | S06,S20; 2026-10-29, ดู sourceURLs ใน CompetitorResearch |

### B02 — Index Advisor & Explain Console

| Field | Specification |
|---|---|
| Feature ID / Name | B02: Index Advisor & Explain Console |
| Current status / extension | C03/C40 มี uniqueindexes/metrics |
| Description | คำแนะนำ index จาก queryshape และ EXPLAIN โดย admin เลือกเอง |
| Real use case | filter วันที่/สถานะช้าใน table ใหญ่ |
| User value | เห็นสาเหตุและผลก่อนลงทุนย้าย DB |
| Technical architecture | allowlistedqueryplans + indexbenefit estimates |
| Backend changes | explain read-only; approvedindexDDL ผ่าน schema service |
| Frontend changes | recommended indexes/writecost/undo review |
| Database changes | _index_definitions+analysis samples ไม่เก็บ rowvalues |
| Dependencies | B01 |
| Security implications | indexbuild ล็อก write ได้; schedule/budget/approve ไม่ autoDDL |
| Complexity (1–5) | 3 |
| Estimated effort | 8–14 person-days ตามสมมติฐานด้านบน |
| Expected impact (1–5) | 4 (hypothesis) |
| Priority | P2 |
| MVP scope | SQLitephysicalcolumncompositeindexadvisor |
| Acceptance criteria | detectfullscan; addedindex ลด scannedrows; duplicateproposal ไม่ซ้ำ; rollbackplan |
| Candidate OSS / commercial limits | L00; license/notice และขอบเขต paid อยู่ใน GapAnalysis; ยังไม่ติดตั้ง |
| Placement | Optional |
| Inspiration / checked | S06,S38; 2026-10-29, ดู sourceURLs ใน CompetitorResearch |

### B03 — Relationship / Constraint Designer

| Field | Specification |
|---|---|
| Feature ID / Name | B03: Relationship / Constraint Designer |
| Current status / extension | C23diagram มี; compositeconstraints Partial |
| Description | สร้าง junction+compositeunique/index และ relation ผ่าน ERinspector |
| Real use case | รถมีอะไหล่หลายชนิด/อะไหล่ใช้หลายรุ่น |
| User value | ข้อมูลไม่ซ้ำและความสัมพันธ์เข้าใจง่าย |
| Technical architecture | extenddiagram to migrationplans; explicitjoinentity แทน JSONarray เมื่อจำเป็น |
| Backend changes | validateexistingduplicates/refcycles beforeapply |
| Frontend changes | cardinality/junction wizard/constraintpreview |
| Database changes | junction tables + metadata constraintsledger |
| Dependencies | A01, A03 |
| Security implications | ต้องตรวจสิทธิ์ทั้งสองฝั่งและอนุญาต sharedschema จาก owner |
| Complexity (1–5) | 4 |
| Estimated effort | 16–26 person-days ตามสมมติฐานด้านบน |
| Expected impact (1–5) | 4 (hypothesis) |
| Priority | P2 |
| MVP scope | many-to-manyviajunction + compositeunique |
| Acceptance criteria | duplicateexistingdata ทำให้ planfail; createjunctionatomic; noaccidentalcasade; export/restore คง constraints |
| Candidate OSS / commercial limits | L00; license/notice และขอบเขต paid อยู่ใน GapAnalysis; ยังไม่ติดตั้ง |
| Placement | Core |
| Inspiration / checked | S05,S38; 2026-10-29, ดู sourceURLs ใน CompetitorResearch |

## C. UI / UX Builder

### C01 — Reusable Visual Components

| Field | Specification |
|---|---|
| Feature ID / Name | C01: Reusable Visual Components |
| Current status / extension | C15nodes มี; C16makerlibraries Missing |
| Description | save ส่วนหน้าจอเป็น component มี props/events และ pinnedversion |
| Real use case | การ์ดข้อมูลรถใช้ร่วม 5 แอป |
| User value | แก้ design หนึ่งแห่งและ reviewupgrade แต่ละแอป |
| Technical architecture | ComponentDefinition + instanceProps + declaredslots; registryL01 |
| Backend changes | resolveversion/dependencies; validateprops และ cycles |
| Frontend changes | saveascomponent/librarypicker/upgradepreview |
| Database changes | component_definitions/versions + instance refs |
| Dependencies | A01, L01 |
| Security implications | props ไม่รับ JS; component ใช้สิทธิ์ consumerapp ไม่ inheritauthor |
| Complexity (1–5) | 4 |
| Estimated effort | 18–28 person-days ตามสมมติฐานด้านบน |
| Expected impact (1–5) | 5 (hypothesis) |
| Priority | P1 |
| MVP scope | 3composites: recordcard/KPI/filterheader; explicitupgrade |
| Acceptance criteria | 2apps ใช้ version1 ต่อได้หลัง release2; propinvalidfail; no recursiveinstances; authorizedbindings เท่านั้น |
| Candidate OSS / commercial limits | L01,L04; license/notice และขอบเขต paid อยู่ใน GapAnalysis; ยังไม่ติดตั้ง |
| Placement | Core |
| Inspiration / checked | S10,S22,S32; 2026-10-29, ดู sourceURLs ใน CompetitorResearch |

### C02 — Responsive Tokens & Accessibility Inspector

| Field | Specification |
|---|---|
| Feature ID / Name | C02: Responsive Tokens & Accessibility Inspector |
| Current status / extension | C01/C14theme/responsive มี |
| Description | token spacing/type/controlsize + responsive overrides และ a11ychecks |
| Real use case | maker ปรับ mobileform ไม่ให้ overflow โดยไม่แก้ CSS |
| User value | UX สม่ำเสมอและรองรับ keyboard |
| Technical architecture | token registry resolver + breakpoint constraints reuseCSSvars |
| Backend changes | validateoverrides และ contrast numeric checks |
| Frontend changes | spacingpresets/devicepreview/focus/labelwarnings |
| Database changes | versioneddisplaytokens ใน appsettings/customspec |
| Dependencies | A01 |
| Security implications | generatedstyles ห้าม arbitraryCSS/URL; a11ywarning ไม่แทน security |
| Complexity (1–5) | 3 |
| Estimated effort | 10–16 person-days ตามสมมติฐานด้านบน |
| Expected impact (1–5) | 4 (hypothesis) |
| Priority | P1 |
| MVP scope | 3breakpoints+spacingtokens+overflow/focuscheck |
| Acceptance criteria | 320/390/768/1440 ไม่มี horizontalbodyoverflow ใน fixtures; keyboardtab ครบ; reducedmotion respected |
| Candidate OSS / commercial limits | L00; license/notice และขอบเขต paid อยู่ใน GapAnalysis; ยังไม่ติดตั้ง |
| Placement | Core |
| Inspiration / checked | S23,S25; 2026-10-29, ดู sourceURLs ใน CompetitorResearch |

### C03 — Kanban View

| Field | Specification |
|---|---|
| Feature ID / Name | C03: Kanban View |
| Current status / extension | C12 มี 9views; Kanban Missing |
| Description | แสดง card ตาม status และย้ายด้วย transitionaction |
| Real use case | ติดตามงานซ่อม/คำขอซื้อ |
| User value | เห็นภาระงานและเปลี่ยนสถานะเร็ว |
| Technical architecture | registeredview + pagedcolumnqueries; move เรียก action เดิม |
| Backend changes | validateversion/status/permissions ไม่ PUTunchecked |
| Frontend changes | keyboardanddrag cards; per-columncounts/loading |
| Database changes | viewconfig; optionaltransitionrules ไม่บังคับเปลี่ยน businessschema |
| Dependencies | L01, B01 |
| Security implications | drag ไม่ข้ามสิทธิ์/valid_if; columns/count ไม่ leakrows |
| Complexity (1–5) | 3 |
| Estimated effort | 12–20 person-days ตามสมมติฐานด้านบน |
| Expected impact (1–5) | 4 (hypothesis) |
| Priority | P2 |
| MVP scope | หนึ่ง groupcolumn; ย้ายผ่าน namedAction; ไม่ nestedboard |
| Acceptance criteria | unauthorizedmove403; stale409; rollbackcard ถ้า APIerror; keyboardmove ได้ |
| Candidate OSS / commercial limits | L04,L03; license/notice และขอบเขต paid อยู่ใน GapAnalysis; ยังไม่ติดตั้ง |
| Placement | Optional |
| Inspiration / checked | S42; 2026-10-29, ดู sourceURLs ใน CompetitorResearch |

## D. Dynamic Forms

### D01 — Multi-step / Wizard Forms

| Field | Specification |
|---|---|
| Feature ID / Name | D01: Multi-step / Wizard Forms |
| Current status / extension | C20/C21dynamicform มี; steps Missing |
| Description | แบ่งฟอร์มเป็น step/section มี validation และ progress |
| Real use case | ตรวจรถ 10 หมวดก่อนบันทึกครั้งเดียว |
| User value | ลดภาระสายตาและอัตรากรอกผิด |
| Technical architecture | stepmetadata referencesexistingcolumns; finalsavepath เดิม |
| Backend changes | stepvalidationdryrun; finalatomicvalidate ทุก step/children |
| Frontend changes | stepper/summaryerrors/focusinvalid/nextback |
| Database changes | formdisplay step definitions; ไม่สร้าง table ต่อ step |
| Dependencies | A01 |
| Security implications | hiddenstep ไม่ทำให้ bypassrequired/permissions; finalservervalidation ทุกช่อง |
| Complexity (1–5) | 3 |
| Estimated effort | 10–16 person-days ตามสมมติฐานด้านบน |
| Expected impact (1–5) | 4 (hypothesis) |
| Priority | P2 |
| MVP scope | 3steps+review+singlesave |
| Acceptance criteria | back เก็บค่าครบ; invalidstep ไปต่อไม่ได้; finalAPIrejecttampering; relatedrowsatomic |
| Candidate OSS / commercial limits | L00; license/notice และขอบเขต paid อยู่ใน GapAnalysis; ยังไม่ติดตั้ง |
| Placement | Optional |
| Inspiration / checked | S25,S42; 2026-10-29, ดู sourceURLs ใน CompetitorResearch |

### D02 — Recoverable Form Drafts & Conflict Review

| Field | Specification |
|---|---|
| Feature ID / Name | D02: Recoverable Form Drafts & Conflict Review |
| Current status / extension | C33cache/C35optimistic มี; draftform Missing |
| Description | กู้ฟอร์มค้างโดยไม่ commit ธุรกิจพร้อม baseversion |
| Real use case | มือถือปิดแท็บระหว่างกรอกกลับมากู้ได้ |
| User value | ลดข้อมูลที่พิมพ์สูญหาย |
| Technical architecture | encrypted? localdraftnotassumedsecure; user/app/scopetag + TTL; explicitrestore |
| Backend changes | drafttoken/versionverify onsubmit; noautopersistbusinessrow |
| Frontend changes | restore/discard/banner + fielddiffwhen409 |
| Database changes | MVP localIndexedDBdraftstore; attachmentreferences ชั่วคราว |
| Dependencies | F01 |
| Security implications | PIIlocalstorage opt-in/TTL/logoutwipe; shareddevice ไม่ autodisplay; reauthbeforeupload |
| Complexity (1–5) | 4 |
| Estimated effort | 14–22 person-days ตามสมมติฐานด้านบน |
| Expected impact (1–5) | 5 (hypothesis) |
| Priority | P1 |
| MVP scope | text/scalarforms online-draftrecovery; offlinewrites ยังไม่รวม |
| Acceptance criteria | killtab/reopen กู้ได้; crossuser/app ไม่อ่าน draft; expireddeleted; stale ไม่ silentoverwrite |
| Candidate OSS / commercial limits | L05; license/notice และขอบเขต paid อยู่ใน GapAnalysis; ยังไม่ติดตั้ง |
| Placement | Core |
| Inspiration / checked | S01,S07; 2026-10-29, ดู sourceURLs ใน CompetitorResearch |

### D03 — Staged Import Mapping & Validation

| Field | Specification |
|---|---|
| Feature ID / Name | D03: Staged Import Mapping & Validation |
| Current status / extension | C29 มี headername/labelmatching, dry-runpreview, issues และ transaction5000rows แล้ว |
| Description | เพิ่ม explicitcustommapping และ durablestagedjobs เหนือ preview เดิม |
| Real use case | นำเข้าลูกค้า 50k แถวจาก Excel ต่างชื่อ |
| User value | ลด partialfailure และช่วย nontechnicalusers |
| Technical architecture | reuseimportExcel validators/preview; addmappingprofile+stagedbatchjob/results |
| Backend changes | stagedparse/validate/commitwithidempotency/status; preserveexistingpreviewandatomicmode |
| Frontend changes | explicitmapcolumns/errorCSV/progress/reconcile; preview เดิมยังใช้ได้ |
| Database changes | import_jobs/stagederrors TTL; nofullnameinlogs |
| Dependencies | A01, E03 |
| Security implications | size/zipbomblimits; fieldpolicy; serverchecks ทุก row; partialvsatomicchoiceclear |
| Complexity (1–5) | 4 |
| Estimated effort | 18–28 person-days ตามสมมติฐานด้านบน |
| Expected impact (1–5) | 4 (hypothesis) |
| Priority | P2 |
| MVP scope | Excel เดิม + mapping20columns + 10krows perjob |
| Acceptance criteria | invalidrows ไม่เขียน; rerunsamekey ไม่ duplicate; cancel/TTLcleanup; countsreconcile |
| Candidate OSS / commercial limits | L00; license/notice และขอบเขต paid อยู่ใน GapAnalysis; ยังไม่ติดตั้ง |
| Placement | Optional |
| Inspiration / checked | S14,S20; 2026-10-29, ดู sourceURLs ใน CompetitorResearch |

## E. Actions & Workflow

### E01 — Bounded Workflow Branches & Iteration

| Field | Specification |
|---|---|
| Feature ID / Name | E01: Bounded Workflow Branches & Iteration |
| Current status / extension | C26linearsteps มี |
| Description | if/switch/foreachlimited พร้อม typeddataflow |
| Real use case | แยกอนุมัติค่าใช้จ่ายตามวงเงิน |
| User value | ลดต้องเขียน Action ซ้ำหลายชุด |
| Technical architecture | versionedworkflowIR + executionbudget; keepv1linearadapter |
| Backend changes | branch/loopvalidation + persistedstepinstances |
| Frontend changes | graphcanvas+inputs/outputs+simulationtrace |
| Database changes | job_step_instances+IRversion; workflowconfigmigrate |
| Dependencies | A01, L01, E03 |
| Security implications | loopmaxitems/time/recursion; recheckactor ก่อน sideeffect |
| Complexity (1–5) | 5 |
| Estimated effort | 25–40 person-days ตามสมมติฐานด้านบน |
| Expected impact (1–5) | 5 (hypothesis) |
| Priority | P2 |
| MVP scope | if/else+foreach<=100items sequential; noarbitrarycode |
| Acceptance criteria | branchcoveragefixture ครบ; budget หยุดไม่ hang; resume ไม่ repeatcommittedsteps; oldworkflow ผลเดิม |
| Candidate OSS / commercial limits | L02; license/notice และขอบเขต paid อยู่ใน GapAnalysis; ยังไม่ติดตั้ง |
| Placement | Core |
| Inspiration / checked | S13,S34,S39; 2026-10-29, ดู sourceURLs ใน CompetitorResearch |

### E02 — Human Approval Inbox / Durable Wait

| Field | Specification |
|---|---|
| Feature ID / Name | E02: Human Approval Inbox / Durable Wait |
| Current status / extension | C26 ไม่มี waitstep |
| Description | พัก job รอผู้อนุมัติ/วันครบกำหนดแล้ว resume |
| Real use case | ขอซื้อ/OT ต้องผู้จัดการอนุมัติ |
| User value | ทำ businessprocess ครบตั้งแต่ request ถึง audit |
| Technical architecture | durablewaitstate+approvalcommand; transitionsversioned |
| Backend changes | approve/reject/expire/reassign guarded; resumeonce |
| Frontend changes | inbox/detaildecision/comments+statushistory |
| Database changes | approval_tasks/decisions/waittokens TTL |
| Dependencies | A01, E03, F01 |
| Security implications | actor/membership/selfapprovalpolicy; token ผูก task/version ไม่ publicbearer |
| Complexity (1–5) | 5 |
| Estimated effort | 25–40 person-days ตามสมมติฐานด้านบน |
| Expected impact (1–5) | 5 (hypothesis) |
| Priority | P1 |
| MVP scope | singleapprover/approve-reject/timeout; noemailactionlink แรก |
| Acceptance criteria | doubleclickonefinaldecision; revoke ก่อน approve403; expired409; restart ยังรอ; auditactor ครบ |
| Candidate OSS / commercial limits | L00; license/notice และขอบเขต paid อยู่ใน GapAnalysis; ยังไม่ติดตั้ง |
| Placement | Core |
| Inspiration / checked | S36,S39; 2026-10-29, ดู sourceURLs ใน CompetitorResearch |

### E03 — Workflow Delivery Ledger & Recovery Policies

| Field | Specification |
|---|---|
| Feature ID / Name | E03: Workflow Delivery Ledger & Recovery Policies |
| Current status / extension | C27 มี transactionaljobenqueue, checkpoint, Idempotency-Key และ manualretry แล้ว |
| Description | ต่อยอด deliveryreceipts/structuredunknownoutcome/controlledretry ไม่สร้าง queue ซ้ำ |
| Real use case | webhook สร้างใบงานสำเร็จแต่ process ตายก่อน checkpoint |
| User value | ลดการทำรายการซ้ำและ recovery ที่ไม่แน่นอน |
| Technical architecture | reuse _automation_jobs เป็น outboxadapter; adddeliveryreceipt/attemptstate+leases; preserveexistingstableeffectkey |
| Backend changes | classifyunknownoutcome/reconcile; boundedapprovedbackoff/jitter; perdeliveryattemptaudit |
| Frontend changes | deliverytimeline/retrysafe/needsreconcile |
| Database changes | delivery_attempts/receipts; generic event_outbox เพิ่มเฉพาะ futurebus ที่ต้องการ |
| Dependencies | ไม่มี feature ใหม่ที่ต้องรอ; ใช้ securityguard/validator เดิม |
| Security implications | outboundallowlist/SSRF/DNS/secretredaction; noautorettryunsafeeffect |
| Complexity (1–5) | 5 |
| Estimated effort | 18–28 person-days ตามสมมติฐานด้านบน |
| Expected impact (1–5) | 5 (hypothesis) |
| Priority | P1 |
| MVP scope | onewebhookproviderdeliveryreceipt+unknownoutcomeUI; key และ transactionaljobs ใช้ของเดิม |
| Acceptance criteria | crashinjectionbefore/afterremoteeffect; receiversees1logicaleffect; retriesbounded; unknownreceiverrequiresmanualreconcile |
| Candidate OSS / commercial limits | L00; license/notice และขอบเขต paid อยู่ใน GapAnalysis; ยังไม่ติดตั้ง |
| Placement | Core |
| Inspiration / checked | S35,S36; 2026-10-29, ดู sourceURLs ใน CompetitorResearch |

## F. Authentication & Security

### F01 — Effective Permission Simulator

| Field | Specification |
|---|---|
| Feature ID / Name | F01: Effective Permission Simulator |
| Current status / extension | C07–09/C41 มี guards+actionsimulation; permissionexplain Missing |
| Description | เลือก app/user/operation แล้วดู table/row/action/exportdecision และเหตุผล |
| Real use case | ผู้ดูแลตั้ง role แล้วสงสัยว่าทำไม user เห็นปุ่ม/ข้อมูลไม่เท่ากัน |
| User value | ลด support และป้องกันสิทธิ์ผิด |
| Technical architecture | policydecisiontrace fromsameguards ไม่ duplicatepolicyengine |
| Backend changes | read-onlysimulate underactorcontext; sanitizedreason tree |
| Frontend changes | role/user/appcompare + no-mutationtestcases |
| Database changes | MVP no schema change; savedcasesoptionalK01 |
| Dependencies | ไม่มี feature ใหม่ที่ต้องรอ; ใช้ securityguard/validator เดิม |
| Security implications | Owner/authorizedappadmin เท่านั้น; cannotimpersonatewrite; no rawdeniedrow values |
| Complexity (1–5) | 3 |
| Estimated effort | 10–16 person-days ตามสมมติฐานด้านบน |
| Expected impact (1–5) | 5 (hypothesis) |
| Priority | P1 |
| MVP scope | table/action/export/rowchecks; fieldmaskpolicy เป็นระยะถัดไป |
| Acceptance criteria | matchedruntimeallow/deny50cases; simulation ไม่เขียน; crossapphiddenresources ไม่เผย; exportdecision ตรง |
| Candidate OSS / commercial limits | L00; license/notice และขอบเขต paid อยู่ใน GapAnalysis; ยังไม่ติดตั้ง |
| Placement | Core |
| Inspiration / checked | S02,S12,S43; 2026-10-29, ดู sourceURLs ใน CompetitorResearch |

### F02 — OIDC Federation & Step-up MFA

| Field | Specification |
|---|---|
| Feature ID / Name | F02: OIDC Federation & Step-up MFA |
| Current status / extension | C10localidentity มี; C11SSO/MFA Missing |
| Description | เชื่อม IdP และบังคับ stepup สำหรับ publish/exportadmin |
| Real use case | องค์กรใช้ Microsoft/Googleaccount และถอดสิทธิ์จากจุดเดียว |
| User value | ลด passwordsupport และเพิ่ม governance |
| Technical architecture | OIDCauthorizationcodePKCE + serveridentitylink; reuseexistingperapproles |
| Backend changes | callbackstate/nonce/issuer/audience/JWKS validation; nosilentemailmerge |
| Frontend changes | SSObutton/linkaccount/stepupprompt/recoverypolicy |
| Database changes | identity_links/providerconfigs/sessionauthlevel |
| Dependencies | F01, G02 |
| Security implications | loginCSRF/tokenreplay/accounttakeover; emergencyownerbreakglassmustreview |
| Complexity (1–5) | 5 |
| Estimated effort | 25–40 person-days ตามสมมติฐานด้านบน |
| Expected impact (1–5) | 5 (hypothesis) |
| Priority | P2 |
| MVP scope | oneOIDCprovider; externalIdPMFA; ยังไม่ทำ SAML/localTOTP แรก |
| Acceptance criteria | wrongissuer/nonce/replayreject; sameemail ไม่ autoown; IdPrevocationpolicytested; sessionrotation |
| Candidate OSS / commercial limits | L07; license/notice และขอบเขต paid อยู่ใน GapAnalysis; ยังไม่ติดตั้ง |
| Placement | External Integration |
| Inspiration / checked | S12,S43; 2026-10-29, ดู sourceURLs ใน CompetitorResearch |

### F03 — Scoped Service Accounts & Stable API v1

| Field | Specification |
|---|---|
| Feature ID / Name | F03: Scoped Service Accounts & Stable API v1 |
| Current status / extension | C30internalcookieAPI มี; C11tokens Missing |
| Description | machinecredentials มี app/table/operation/expiry/quotas |
| Real use case | ERP อ่าน inventory โดยไม่ใช้ ownerpassword |
| User value | เปิด integrations อย่างควบคุมและ rotate ได้ |
| Technical architecture | serviceprincipal mappedexistingguards; OpenAPI fromtypedcontracts |
| Backend changes | tokenhash/rotation/revoke; APIv1limit/projection/versions |
| Frontend changes | tokencreator/scopepreview/usage/revocation |
| Database changes | service_principals/tokens/scopes/usagecaps |
| Dependencies | A01, F01, G02 |
| Security implications | neverownerbydefault; blockadminAPI; audittokenfingerprint ไม่ logtoken |
| Complexity (1–5) | 4 |
| Estimated effort | 20–32 person-days ตามสมมติฐานด้านบน |
| Expected impact (1–5) | 4 (hypothesis) |
| Priority | P2 |
| MVP scope | read-onlytableGETv1+singleappscopes |
| Acceptance criteria | noaccesstoappB403; revoked401; rawtoken แสดงครั้งเดียว; cursorandpolicycountsconsistent |
| Candidate OSS / commercial limits | L01; license/notice และขอบเขต paid อยู่ใน GapAnalysis; ยังไม่ติดตั้ง |
| Placement | Core |
| Inspiration / checked | S05,S20,S38; 2026-10-29, ดู sourceURLs ใน CompetitorResearch |

## G. Integrations

### G01 — REST Data Source & Query Builder

| Field | Specification |
|---|---|
| Feature ID / Name | G01: REST Data Source & Query Builder |
| Current status / extension | C30outboundwebhook มี; datasourceadapter Missing |
| Description | ผูก externalREST อ่านข้อมูลเป็น queryresource ที่ reuse ใน View |
| Real use case | dashboard ดึง stock จาก ERP โดยไม่ copytable ทุกคืน |
| User value | ต่อระบบจริงได้โดย maker ไม่เขียน fetch |
| Technical architecture | DataSourceAdapter capabilitycontract; normalizeQueryResult; explicitremotevslocaldataset |
| Backend changes | allowlistedHTTPSproxy/authvault/pagination/schema/timeout/cache; peruserresourceguard |
| Frontend changes | connect/test/querymapper + viewbindinginspector |
| Database changes | datasources/resourcegrants/queries/result_schema |
| Dependencies | A01, G02, F01 |
| Security implications | SSRF/DNSrebind/redirect/privateIP; no browsersecret; paginationupperbounds; credentialdelegationexplicit |
| Complexity (1–5) | 5 |
| Estimated effort | 22–34 person-days ตามสมมติฐานด้านบน |
| Expected impact (1–5) | 5 (hypothesis) |
| Priority | P1 |
| MVP scope | read-onlyRESTJSONGET+cursor/page; noexternalwrite/FKinitial |
| Acceptance criteria | 3mockAPIs รวม timeout/schemaerror; nosecretbundle; appAresource จาก B403; paginationcompleteorlabelpartial |
| Candidate OSS / commercial limits | L01; license/notice และขอบเขต paid อยู่ใน GapAnalysis; ยังไม่ติดตั้ง |
| Placement | Core |
| Inspiration / checked | S05,S14,S20; 2026-10-29, ดู sourceURLs ใน CompetitorResearch |

### G02 — App-scoped Connection Secrets

| Field | Specification |
|---|---|
| Feature ID / Name | G02: App-scoped Connection Secrets |
| Current status / extension | C27envtoken มี; reusablevault Missing |
| Description | จัดการ connectioncredentials ผ่าน secretrefs/rotate โดยไม่อยู่ configexport |
| Real use case | แต่ละแอปใช้ ERPtoken คนละชุด |
| User value | ลดรั่วไหลและตั้งค่าตอนย้าย environment ได้ |
| Technical architecture | secretbroker envelopeAES-GCM withexternalmasterkeyref; serveronly |
| Backend changes | write-onlysecrets/testconnection/rotate/audit; migrateenvrefsoptional |
| Frontend changes | maskedcredentialforms/lastrotated/testresult |
| Database changes | secret_refs/encrypted_versions/accessgrants; masterkeynotDBbackup |
| Dependencies | F01 |
| Security implications | app+actor+purposecheck; redactlogs; keyloss/restore/rotationplaybook; neverAIcontext |
| Complexity (1–5) | 4 |
| Estimated effort | 14–22 person-days ตามสมมติฐานด้านบน |
| Expected impact (1–5) | 5 (hypothesis) |
| Priority | P1 |
| MVP scope | oneHTTPbearercredentialtype+rotation; envfallback ยังทำงาน |
| Acceptance criteria | export/diff/logs ไม่มี secret; unauthorizeddecryptdeny; rotateoldrevoked; restorewithoutkeyexplicitblocked |
| Candidate OSS / commercial limits | L00; license/notice และขอบเขต paid อยู่ใน GapAnalysis; ยังไม่ติดตั้ง |
| Placement | Core |
| Inspiration / checked | S05,S12,S17; 2026-10-29, ดู sourceURLs ใน CompetitorResearch |

### G03 — Signed Inbound Webhooks

| Field | Specification |
|---|---|
| Feature ID / Name | G03: Signed Inbound Webhooks |
| Current status / extension | C30outbound มี; inboundtrigger Missing |
| Description | endpoint รับ event พร้อม signature/replayguard แล้ว enqueue |
| Real use case | ERP แจ้งสถานะซ่อมกลับ Builder |
| User value | ลด polling และ sync ข้อมูลตรงเวลา |
| Technical architecture | ingressverify→idempotenteventrecord→workflowenqueue |
| Backend changes | HMACtimestamp/eventID/bodybudget/ratecap; ACKdurableaftercommit |
| Frontend changes | endpointconfig/mockeventtester/deliveryhistory |
| Database changes | webhook_endpoints/received_events retention |
| Dependencies | E03, G02, F01 |
| Security implications | replay/contenttype/oversize; nosessionbypass toadmin; signaturerawbodyexact |
| Complexity (1–5) | 4 |
| Estimated effort | 14–22 person-days ตามสมมติฐานด้านบน |
| Expected impact (1–5) | 4 (hypothesis) |
| Priority | P2 |
| MVP scope | HMACJSONprovider เดียว+manualpayloadmapping |
| Acceptance criteria | bad/replayed/expiredsignaturesreject; duplicateeventenqueueonce; failedjob ไม่ทำ ACK หลอกก่อน durable |
| Candidate OSS / commercial limits | L00; license/notice และขอบเขต paid อยู่ใน GapAnalysis; ยังไม่ติดตั้ง |
| Placement | Optional |
| Inspiration / checked | S16,S35; 2026-10-29, ดู sourceURLs ใน CompetitorResearch |

## H. AI-powered Features

### H01 — AI Formula Assistant (Thai-first)

| Field | Specification |
|---|---|
| Feature ID / Name | H01: AI Formula Assistant (Thai-first) |
| Current status / extension | C18/C19deterministictools มี; C44LLM Missing |
| Description | ภาษาธรรมชาติ→สูตรพร้อมเหตุผล/testexamples และ validator เดิม |
| Real use case | ระยะเวลาตรวจหรือ valid_if ซับซ้อนโดยไม่จำ syntax |
| User value | ลดเวลาศึกษาและ error ของ maker |
| Technical architecture | provideradapter→FormulaProposalJSON→parse/type/refcheck→dryrun |
| Backend changes | boundedrequest/modelbudget; authorizedschemaonly; recordproposal |
| Frontend changes | suggest/compare/test/insertbutton ใน ExpressionAssistant |
| Database changes | ai_policy/proposals/usagemeter; sourcepromptmetadataonly |
| Dependencies | A01, G02, F01 |
| Security implications | schema/docspromptinjection; neverevalJS/SQL; noautopublish; no rowsbydefault |
| Complexity (1–5) | 3 |
| Estimated effort | 12–20 person-days ตามสมมติฐานด้านบน |
| Expected impact (1–5) | 5 (hypothesis) |
| Priority | P1 |
| MVP scope | formula text-only; oneprovider; schema+syntheticexamples |
| Acceptance criteria | 50Thaicases>=80%semanticpass; invalidref100%blocked; proposalnoDBwrite; budgetsstop; user ต้อง insert |
| Candidate OSS / commercial limits | L01; license/notice และขอบเขต paid อยู่ใน GapAnalysis; ยังไม่ติดตั้ง |
| Placement | Optional |
| Inspiration / checked | S03,S17,S34; 2026-10-29, ดู sourceURLs ใน CompetitorResearch |

### H02 — AI Schema Planner

| Field | Specification |
|---|---|
| Feature ID / Name | H02: AI Schema Planner |
| Current status / extension | C23schemaeditor มี; schemaAI Missing |
| Description | โจทย์ธุรกิจ→tables/relations/constraints แบบ reviewableplan |
| Real use case | สร้างระบบยืมคืน asset จาก brief ภาษาไทย |
| User value | ลดเริ่มจาก blank และชี้เรื่อง FK/index |
| Technical architecture | AppSpecpatch notSQL; name/relationship/constraintvalidators; impactplan |
| Backend changes | providerstrategy+schema-scopedcontext+syntheticseedpreview |
| Frontend changes | ERpreview/rename/mapexistingtables/approveplan |
| Database changes | proposalstore; no businessDDLuntilapproval |
| Dependencies | A01, A03, H01 |
| Security implications | hallucinatedPIIcolumns/privileges; destructivechangesdefaultdeny; noauthschemageneration |
| Complexity (1–5) | 4 |
| Estimated effort | 18–28 person-days ตามสมมติฐานด้านบน |
| Expected impact (1–5) | 5 (hypothesis) |
| Priority | P2 |
| MVP scope | newtables<=5; refs<=10; nodrop/alterexisting |
| Acceptance criteria | 20briefsvalidplan>=90%; noSQLexecutableoutput; ambiguousrequirement ถาม; applyatomicisolated |
| Candidate OSS / commercial limits | L01,L02; license/notice และขอบเขต paid อยู่ใน GapAnalysis; ยังไม่ติดตั้ง |
| Placement | Optional |
| Inspiration / checked | S03,S17,S30; 2026-10-29, ดู sourceURLs ใน CompetitorResearch |

### H03 — AI Incremental App / UI / Workflow Drafts

| Field | Specification |
|---|---|
| Feature ID / Name | H03: AI Incremental App / UI / Workflow Drafts |
| Current status / extension | C15/C26 มี editors; AIgeneration Missing |
| Description | ให้ AI ประกอบ registeredcomponents และ stepIR ใน draft |
| Real use case | เพิ่มหน้าติดตามซ่อมพร้อม workflow แจ้งเตือนจาก brief |
| User value | เพิ่ม productivity โดยยัง review ทุก diff |
| Technical architecture | plan→typedpatch→validate→renderpreview/simulation→humanpublish |
| Backend changes | reuseAppSpec/Releases; toolallowlist; boundedrepairloop2 |
| Frontend changes | conversationplan/diff/screenshot/undo/approval |
| Database changes | ai_runs/proposedpatches/baselinemetadatahash |
| Dependencies | H02, C01, E01, J01 |
| Security implications | untrustedtoolresponses; noarbitrarycode/network/secretread; patchnotgrantpermissions |
| Complexity (1–5) | 5 |
| Estimated effort | 30–50 person-days ตามสมมติฐานด้านบน |
| Expected impact (1–5) | 5 (hypothesis) |
| Priority | P2 |
| MVP scope | newpage<=20nodes +existingdata; workflowv1linearfirst |
| Acceptance criteria | 10goldenappsbuildvalid; stale409; unsafeplugin/actionreject; no productionpublish; rollbackdraft |
| Candidate OSS / commercial limits | L01; license/notice และขอบเขต paid อยู่ใน GapAnalysis; ยังไม่ติดตั้ง |
| Placement | Optional |
| Inspiration / checked | S09,S11,S25,S29,S34,S42; 2026-10-29, ดู sourceURLs ใน CompetitorResearch |

## I. Performance / Scalability

### I01 — Virtualized Runtime Tables / Lists

| Field | Specification |
|---|---|
| Feature ID / Name | I01: Virtualized Runtime Tables / Lists |
| Current status / extension | C12paging/cache มี; virtualization Missing |
| Description | render เฉพาะ visiblewindow พร้อม stickyrow/groupheaders |
| Real use case | กริดคอลัมน์มากบน mobile/tablet |
| User value | ลด DOM/jank โดยไม่เพิ่ม downloadall |
| Technical architecture | virtualrenderadapter to existingpagedquery; stableIDs/heights |
| Backend changes | API เดิม; addcolumnprojection ถ้าจำเป็น |
| Frontend changes | virtualrows/columns withfocus/scrollrestore/errorfallback |
| Database changes | ไม่ต้อง schema ใหม่ |
| Dependencies | ไม่มี feature ใหม่ที่ต้องรอ; ใช้ securityguard/validator เดิม |
| Security implications | a11y/focus และ hiddenrowleak; virtual ไม่ทำให้ SQL เร็วขึ้น |
| Complexity (1–5) | 4 |
| Estimated effort | 12–20 person-days ตามสมมติฐานด้านบน |
| Expected impact (1–5) | 4 (hypothesis) |
| Priority | P2 |
| MVP scope | table100rows/clientwindow; variableheightlist ตามหลัง |
| Acceptance criteria | DOMrows<=viewportbudget; backscroll ไม่ jump; keyboardread ได้; memory/framebenchmark เทียบ baseline |
| Candidate OSS / commercial limits | L03; license/notice และขอบเขต paid อยู่ใน GapAnalysis; ยังไม่ติดตั้ง |
| Placement | Core |
| Inspiration / checked | S19,S25; 2026-10-29, ดู sourceURLs ใน CompetitorResearch |

### I02 — Realtime Fanout / Delta Invalidation

| Field | Specification |
|---|---|
| Feature ID / Name | I02: Realtime Fanout / Delta Invalidation |
| Current status / extension | C32SSEper-table มี |
| Description | รวม poll/fanout ใน server และส่ง revision/delta แบบ bounded |
| Real use case | ผู้ใช้ 100 คนเปิด table เดียวกัน |
| User value | ลด query ต่อ connection และ refresh ไม่จำเป็น |
| Technical architecture | sharedrevisionpoller perprocess+subscriberACL; deltaoptional |
| Backend changes | connection/backpressure/sessionrecheck; crossprocesspubsub หลัง need |
| Frontend changes | coalescedupdates/dirtyformprotection/resyncindicator |
| Database changes | optionalchange_logbounded; baseversion/tombstones |
| Dependencies | E03 |
| Security implications | SSEpermissionrevocation/slowclients/sidechannel; no unauthrowbroadcast |
| Complexity (1–5) | 5 |
| Estimated effort | 20–32 person-days ตามสมมติฐานด้านบน |
| Expected impact (1–5) | 4 (hypothesis) |
| Priority | P2 |
| MVP scope | singleprocessfanout sameSSEcontract; 100clientslab |
| Acceptance criteria | DBpollcount ไม่ linearclients; revokecloses; slowclientmemorybounded; reconnectfullsnapshotcorrect |
| Candidate OSS / commercial limits | L00; license/notice และขอบเขต paid อยู่ใน GapAnalysis; ยังไม่ติดตั้ง |
| Placement | Core |
| Inspiration / checked | S35,S38; 2026-10-29, ดู sourceURLs ใน CompetitorResearch |

### I03 — Offline Write Queue & Conflict Center

| Field | Specification |
|---|---|
| Feature ID / Name | I03: Offline Write Queue & Conflict Center |
| Current status / extension | C33readcache/C34PWA มี; offlineCRUD Missing |
| Description | บันทึก offline แล้ว sync พร้อม retry/dedupe/conflictresolution |
| Real use case | ตรวจรถในจุดอับสัญญาณรวมรูป |
| User value | งานภาคสนามต่อเนื่องและไม่สูญข้อมูล |
| Technical architecture | perapp/useroutboxclient + idmapping + serveridempotency + versionpolicy |
| Backend changes | syncAPI/delta/retention/grantrecheck; multipartuploadstaging |
| Frontend changes | pending/conflictitems/resolve/manualsync; storagequota warning |
| Database changes | clientIndexedDBwrites/blobs; serverdedupe/sync_tokens |
| Dependencies | A01, D02, E03, F01, I02 |
| Security implications | offlinepermissionexpiry/encryptionnotpromise; revokeddatawipe; shareddevice; blobsquota |
| Complexity (1–5) | 5 |
| Estimated effort | 40–65 person-days ตามสมมติฐานด้านบน |
| Expected impact (1–5) | 5 (hypothesis) |
| Priority | P3 |
| MVP scope | create/update1table; nomedia/deletesfirstpilot; onlinebootstraprequired |
| Acceptance criteria | kill/retryneverduplicate; conflictingedit409review; no crossappcache; revokeuploaddeny; explicitpartialfailure |
| Candidate OSS / commercial limits | L05; license/notice และขอบเขต paid อยู่ใน GapAnalysis; ยังไม่ติดตั้ง |
| Placement | Optional |
| Inspiration / checked | S01,S07,S27; 2026-10-29, ดู sourceURLs ใน CompetitorResearch |

## J. Enterprise Features

### J01 — Environment Promotion & Review Workflow

| Field | Specification |
|---|---|
| Feature ID / Name | J01: Environment Promotion & Review Workflow |
| Current status / extension | C36draft/hashrollback มี; C37envGit Missing |
| Description | dev/stage/prod配置และ reviewedreleasepackage |
| Real use case | ทดสอบสูตร/connector ใน stage ก่อนโปรโมต |
| User value | ลดผิดพลาดจากแก้ live และรองรับทีม |
| Technical architecture | AppSpecartifact+envconnectionbindings+baselinehash+approverroles |
| Backend changes | exportvalidatepromote; gateReadiness/K01; manualGitexportMVP |
| Frontend changes | releasecompare/approvereject/rollback/envselector |
| Database changes | environments/releases/reviewdecisions/resourcebindings |
| Dependencies | A01, A03, G02 |
| Security implications | separatepromotionpermission; no copyingprodsecrets/data; schematicrollbacknotbusinessdatarollback |
| Complexity (1–5) | 5 |
| Estimated effort | 25–40 person-days ตามสมมติฐานด้านบน |
| Expected impact (1–5) | 5 (hypothesis) |
| Priority | P1 |
| MVP scope | 2isolatedinstances; config-onlypackagepromotion+explicitreview |
| Acceptance criteria | stale/dependency/schemaMismatchblocks; devsecret ไม่เข้า prod; reviewhashbound; rollbackconfigtested |
| Candidate OSS / commercial limits | L00; license/notice และขอบเขต paid อยู่ใน GapAnalysis; ยังไม่ติดตั้ง |
| Placement | Core |
| Inspiration / checked | S08,S10,S21,S33; 2026-10-29, ดู sourceURLs ใน CompetitorResearch |

### J02 — Organization Workspaces / Tenant Quotas

| Field | Specification |
|---|---|
| Feature ID / Name | J02: Organization Workspaces / Tenant Quotas |
| Current status / extension | C05multiapp มี; orgboundary Partial |
| Description | workspaceusers/apps/resources/budgets และ isolationpolicy |
| Real use case | Builder ขายให้หลายบริษัทโดยไม่ปนกัน |
| User value | เปิด B2BSaaS หลังมี demand และ SLA |
| Technical architecture | explicittenantscopeandresourceownership; enforceeveryentrypoint; physicalisolationoption |
| Backend changes | tenantguards/migrations/storagejobsisolation/quotas |
| Frontend changes | workspaceadmin/billing-independentquota/settings |
| Database changes | workspace_id/tenantresources+ownershipmigration acrosscatalog |
| Dependencies | A01, F01, J01 |
| Security implications | tenantescape/sharedtablemigration; no trustingUIselector; isolationmatrix beforelaunch |
| Complexity (1–5) | 5 |
| Estimated effort | 50–80 person-days ตามสมมติฐานด้านบน |
| Expected impact (1–5) | 5 (hypothesis) |
| Priority | P3 |
| MVP scope | oneorganizationperserverpilot ก่อน sharedtenancy |
| Acceptance criteria | cross-tenantAPI/media/PDF/worker/backup/cachematrixdeny; tenantquotaandrestoreisolated |
| Candidate OSS / commercial limits | L00; license/notice และขอบเขต paid อยู่ใน GapAnalysis; ยังไม่ติดตั้ง |
| Placement | Core |
| Inspiration / checked | S12,S38,S43; 2026-10-29, ดู sourceURLs ใน CompetitorResearch |

### J03 — Durable Observability / SLO & Alerts

| Field | Specification |
|---|---|
| Feature ID / Name | J03: Durable Observability / SLO & Alerts |
| Current status / extension | C39/C40logs/metrics มี |
| Description | traceIDs+persistedaggregates+budget+notificationthresholds |
| Real use case | รู้ว่า app ช้าจาก SQL/formula/PDF หรือ webhook และแจ้ง admin |
| User value | ลด MTTR และพิสูจน์ก่อน–หลัง |
| Technical architecture | instrumentservicesviaOTelbridge; metricexport; alertsoutbox |
| Backend changes | boundedspans/redaction/sampling/retention; groupbyapp/table |
| Frontend changes | p50/p95/errorbudget/beforeafter/alertconfig |
| Database changes | rollupstoreTTL optionalexternalcollector; no rawvalues |
| Dependencies | E03 |
| Security implications | PII/secretredaction และ access; alertstormdedupe; no expensive fullSQLpayloads |
| Complexity (1–5) | 4 |
| Estimated effort | 14–24 person-days ตามสมมติฐานด้านบน |
| Expected impact (1–5) | 5 (hypothesis) |
| Priority | P1 |
| MVP scope | request/formula/workflow spans + oneemailwebhookalert channel |
| Acceptance criteria | failedjobtracetoapp/actor; restartretainsrollups; PIIcanaryabsent; thresholdalertdedupe/recovery |
| Candidate OSS / commercial limits | L06; license/notice และขอบเขต paid อยู่ใน GapAnalysis; ยังไม่ติดตั้ง |
| Placement | Core + External Integration |
| Inspiration / checked | S02,S12,S42; 2026-10-29, ดู sourceURLs ใน CompetitorResearch |

## K. Developer Experience

### K01 — No-code Test Studio & Publish Gates

| Field | Specification |
|---|---|
| Feature ID / Name | K01: No-code Test Studio & Publish Gates |
| Current status / extension | C41simulation/C42developertests มี |
| Description | maker กำหนด givenrows/actor/action/expectedresults แบบ fixtures |
| Real use case | เปลี่ยนสูตรแล้วมั่นใจ status/duration/roles ยังถูก |
| User value | ลด regression โดยไม่ต้องเขียน Playwright |
| Technical architecture | tests-as-AppSpec + isolatedSQLite runner + existingguards/evaluator |
| Backend changes | seed/simulate/assert/rollback; asyncbrowseradapterlater |
| Frontend changes | Given/When/Then UI+failureexplanation+diff |
| Database changes | test_definitions/fixtures/results artifacts redacted |
| Dependencies | A01, F01 |
| Security implications | neverexecuteprodmutations; fixturePIIscrub; actorsnoelevation; externalwebhookmock |
| Complexity (1–5) | 4 |
| Estimated effort | 18–28 person-days ตามสมมติฐานด้านบน |
| Expected impact (1–5) | 5 (hypothesis) |
| Priority | P1 |
| MVP scope | formvalidation/action/rowaccess tests; publishoptionalwarningfirst |
| Acceptance criteria | 20fixturetestsdetectseededregressions; 0prodDBaccess; deterministictime; failingcaseblockswhenenabled |
| Candidate OSS / commercial limits | L00; license/notice และขอบเขต paid อยู่ใน GapAnalysis; ยังไม่ติดตั้ง |
| Placement | Core |
| Inspiration / checked | S28,S30,S34; 2026-10-29, ดู sourceURLs ใน CompetitorResearch |

### K02 — Binding / Workflow Trace Debugger

| Field | Specification |
|---|---|
| Feature ID / Name | K02: Binding / Workflow Trace Debugger |
| Current status / extension | C19/C40/C41trace/preview มี |
| Description | singletrace การโหลด binding→formula→action→workflow→HTTP |
| Real use case | maker ถามว่าคอลัมน์นี้ทำไมได้ค่า 42 วินาที |
| User value | ลดการไล่ log และปรับ config ผิดจุด |
| Technical architecture | read-onlytraceview reuseaction-trace/simulation; structurederrorpath |
| Backend changes | correlationids/sourcepointers+scopedtracefetch |
| Frontend changes | inspectnode/input/output/timing/permissiondenial |
| Database changes | boundedtraceartifact metadata; retentionperapp |
| Dependencies | J03 |
| Security implications | maskdataandsecrets; no otheractortracebydefault; writesdisabledindebugmode |
| Complexity (1–5) | 3 |
| Estimated effort | 10–18 person-days ตามสมมติฐานด้านบน |
| Expected impact (1–5) | 4 (hypothesis) |
| Priority | P2 |
| MVP scope | onesavetrace+formulasteps+webhookstatuswithoutpayloadsecret |
| Acceptance criteria | traceexplainsordering; readonlymode0mutations; forbiddenfieldsredacted; expiredartifact404 |
| Candidate OSS / commercial limits | L00; license/notice และขอบเขต paid อยู่ใน GapAnalysis; ยังไม่ติดตั้ง |
| Placement | Core |
| Inspiration / checked | S30,S34,S39; 2026-10-29, ดู sourceURLs ใน CompetitorResearch |

### K03 — Living App Documentation Generator

| Field | Specification |
|---|---|
| Feature ID / Name | K03: Living App Documentation Generator |
| Current status / extension | C18guide/C23diagram มี; appdocexport Missing |
| Description | สร้าง data dictionary/screens/actions/roles/dependencies จาก metadata |
| Real use case | handover ระบบให้แผนกใหม่ |
| User value | ลด busfactor และทำ review ง่าย |
| Technical architecture | deterministicAppSpec→Markdown/HTML; optionalAIexplanations แยก |
| Backend changes | read-onlyexport scopedmetadata; stableanchors/revisions |
| Frontend changes | exportsections/preview/changecompares |
| Database changes | MVP noDBchange; generationmanifest artifact |
| Dependencies | A03 |
| Security implications | no userlist/secret/examplePII; respectappaccess; AIopt-in only |
| Complexity (1–5) | 2 |
| Estimated effort | 4–7 person-days ตามสมมติฐานด้านบน |
| Expected impact (1–5) | 4 (hypothesis) |
| Priority | P1 |
| MVP scope | Markdowndict+relationdiagram+workflowtable |
| Acceptance criteria | fixturefields/views ครบ; changedcolumnupdaterevision; nosecretcanaries; exportwithoutAIworks |
| Candidate OSS / commercial limits | L00; license/notice และขอบเขต paid อยู่ใน GapAnalysis; ยังไม่ติดตั้ง |
| Placement | Optional |
| Inspiration / checked | S10,S34; 2026-10-29, ดู sourceURLs ใน CompetitorResearch |

## L. Marketplace / Plugin Ecosystem

### L01 — Internal Component / Action Registry

| Field | Specification |
|---|---|
| Feature ID / Name | L01: Internal Component / Action Registry |
| Current status / extension | C12/C15/C25hardcodedregistries มี |
| Description | รวม descriptor/validator/editor/runtime/capability ใน registration เดียว |
| Real use case | เพิ่ม Kanban/fieldtype โดยไม่แก้ switch หลายแห่ง |
| User value | ลด maintenance และเป็นฐาน privateextensions |
| Technical architecture | versionedtypedregistry builtintypeswrapped; notdynamiccodeinstaller |
| Backend changes | sharedregistrationvalidationanddependencygraph; backwardcompatadapter |
| Frontend changes | palette/propertyeditorfromdescriptor; lazyloadedbuiltinrenderer |
| Database changes | registryversionspinned ใน AppSpec; noinstalltableMVP |
| Dependencies | A01 |
| Security implications | registryisnotisolation; onlyreviewedbuiltinmodules; failclosedunknownkind |
| Complexity (1–5) | 4 |
| Estimated effort | 16–26 person-days ตามสมมติฐานด้านบน |
| Expected impact (1–5) | 5 (hypothesis) |
| Priority | P1 |
| MVP scope | migrate3representativecomponents+3workflowactions; legacyadapters ครบ |
| Acceptance criteria | oldAppSpecsrenderidentical; unknowncapreject; newbuiltin1registration+tests; server/clientcontractsame |
| Candidate OSS / commercial limits | L01; license/notice และขอบเขต paid อยู่ใน GapAnalysis; ยังไม่ติดตั้ง |
| Placement | Core |
| Inspiration / checked | S15,S16,S40,S44; 2026-10-29, ดู sourceURLs ใน CompetitorResearch |

### L02 — Trusted Private Plugin SDK

| Field | Specification |
|---|---|
| Feature ID / Name | L02: Trusted Private Plugin SDK |
| Current status / extension | C43pluginlifecycle Missing |
| Description | SDKmanifest/installapprove/pin/disable/uninstall สำหรับทีมพัฒนา |
| Real use case | ทีมองค์กรเพิ่ม connector เฉพาะ |
| User value | ขยายโดยไม่ forkcore ต่อ feature |
| Technical architecture | manifest+capabilitygrants+integrity+hostbroker; declarativefirst |
| Backend changes | installstaging/contracttests/lifecycle/dependentsbeforeuninstall |
| Frontend changes | adminreviewpermissiondiff/rollback/health |
| Database changes | installed_extensions/versions/grants/lockmanifest |
| Dependencies | L01, A03, G02, J01 |
| Security implications | signedsource≠safe; nountrustedNodeinprocess; network/DBdeny; auditpluginpurpose |
| Complexity (1–5) | 5 |
| Estimated effort | 30–50 person-days ตามสมมติฐานด้านบน |
| Expected impact (1–5) | 4 (hypothesis) |
| Priority | P3 |
| MVP scope | firstpartyreviewedbundles+declarativecomponents/connectors; noarbitrarynpminstall |
| Acceptance criteria | tamperedbundleblocked; disablekeepsdata+fallback; revokednetworkpermissiondeny; uninstalldependentblocked |
| Candidate OSS / commercial limits | L01; license/notice และขอบเขต paid อยู่ใน GapAnalysis; ยังไม่ติดตั้ง |
| Placement | Plugin Infrastructure |
| Inspiration / checked | S15,S32,S40,S44; 2026-10-29, ดู sourceURLs ใน CompetitorResearch |

### L03 — Private Package Catalog & Upgrade Planner

| Field | Specification |
|---|---|
| Feature ID / Name | L03: Private Package Catalog & Upgrade Planner |
| Current status / extension | C06clone/C38backup มี; marketplace Missing |
| Description | internalcatalogtemplates/components/connectors พร้อม compatibility และ receipts |
| Real use case | หลายทีมใช้มาตรฐานตรวจรถรุ่นเดียวกัน |
| User value | reuse และ governance โดยไม่เปิด publicmarketplace |
| Technical architecture | artifactcatalog+semverconstraints+lockresolver+licenseinventory |
| Backend changes | publishcatalogversion/dependencypreflight/rollback |
| Frontend changes | browse/licensebadge/versiondiff/upgradepreview |
| Database changes | catalog_artifacts/dependencies/install_receipts |
| Dependencies | A02, C01, L02 |
| Security implications | supplychain/licenseownership/untrustedassets; noautomaticprivilegeupgrade |
| Complexity (1–5) | 4 |
| Estimated effort | 18–30 person-days ตามสมมติฐานด้านบน |
| Expected impact (1–5) | 4 (hypothesis) |
| Priority | P3 |
| MVP scope | privatecatalog<=20artifacts; manualapprovedupdates |
| Acceptance criteria | transitivedepconflictsreject; pin ไม่เปลี่ยนเอง; rollbackpriorversion; eachartifactlicense/provenance ครบ |
| Candidate OSS / commercial limits | L00; license/notice และขอบเขต paid อยู่ใน GapAnalysis; ยังไม่ติดตั้ง |
| Placement | Optional |
| Inspiration / checked | S10,S32,S44; 2026-10-29, ดู sourceURLs ใน CompetitorResearch |
