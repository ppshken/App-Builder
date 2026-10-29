# Feature Gap Analysis

วันที่ 2026-10-29. เทียบความสามารถตามขอบเขตที่ค้นจริง ไม่ให้คะแนน checkbox จากชื่อ marketing. Ourstatuses จาก [47capabilities](CURRENT_SYSTEM_CAPABILITIES.md); Sxx มี URL/date/stage ใน [Research](COMPETITOR_RESEARCH.md). Unknown=ยังไม่ยืนยัน ไม่แปลว่าไม่มี. กรณี GA/Beta/Alpha/Experimental ดู source ทะเบียน ไม่รวมเป็นคะแนนเดียว

## Comparison matrix

| Feature | Our Builder | AppSheet | Retool | Power Apps | Other platforms | Gap | Opportunity |
|---|---|---|---|---|---|---|---|
| Visual app/layout builder | Implemented C12/C15; fixednodes | schema-drivenUI S01/S03 | AIapps+classic S11/S13 | canvas/model-driven S09/S10 | FlutterFlowtypedwidgets S25; Appsmithwidgets S19 | reusablecomponentgap | C01/L01 |
| Database and sources | SQLiteinternal; remotequeryMissing C30 | AppSheetdata/security S02 | resources S11 | connectors/Dataverse S05 | BudibaseCouch/external S14; DirectusSQL S38 | genericadapter | G01/G02 |
| Data binding | expressions+snapshot C17 | expressiondrivenapps; exactreactivitynotresearched | queries/resources S11/S13 | PowerFx S06 | AppsmithJSbindings S19/S22 | observabletypedquerygraph | B01/K02 |
| Formula/expression | boundedAST C18 | creation documented S03; fullfunctionparitynotmeasured | JS/querylogic S11 | PowerFxdelegation S06 | AppsmithJS S19 | delegation+type/help | B01/H01 |
| Workflowautomation | 3stepkinds C26 | AppsScriptbot S04 | Workflows S13 | cloudflows S06 | n8nnodeworkflows S34; DirectusFlows S39 | wait/branches/deliverysafety | E01/E02/E03 |
| Dynamiccomponents | 11nodes C15 | limitedconfigUI; customcodewidgetscopeUnknown | apps/generatedcode S11 | componentlibrary S10 | Bubbleplugins S32; Appsmithcustomwidgets S22 | versionedcomponentcontracts | C01/L01 |
| RBAC/rowaccess | serverroles+rowrules C07/C08 | securityfilters S02 | resourcegroups/use/edit/own S12 | resource/governance S08; exactDBRLSUnknown | Directuspolicy S38; ToolJetgranular S43 | explain+fieldprojection | F01; fieldpolicyfollowup |
| Relationships | Ref/list/FK/ERdiagram C23 | AppSheetfamily; exactEReditingnotverified | resourceexternaldata S11 | Dataverse/tableconnectors S05 | Directusmodeling S38; BudibaseS14 | junction/compositeconstraintUI | B03 |
| REST/GraphQL | internalREST/outboundPartial; GraphQLMissing | scriptscallservices S04; GraphQLUnknown | resources S11; GraphQLscopeUnknown | customconnectors S05; GraphQLUnknown | AppsmithREST/GraphQL S20; Directusboth S38 | stableAPI/resourcecatalog | G01/F03 |
| Webhooks | outboundallowlisted C30 | script/externalservice S04 | workflowresources S13 | cloudflows S06 | n8ntriggers/queues S35; BudibaseS16 | signedingress/idempotency | G03/E03 |
| Plugins/extensions | Missing C43 | AppsScript S04 notgenericwidgetplugin | manualcode/resources S11 notpublicSDKclaim | componentlibraries S10 | BudibaseS15; ToolJetmanifest S44; DirectusS40 | capabilitymanifest/lifecycle | L01/L02 |
| App templates | cloneexisting C06; recipesMissing | AIcreation S03 | AIapps S11 | generativepages S09 | Budibasesample S14; FlutterFlow S28 | safeinstall/remap | A02 |
| Multi-tenancy | multiapp≠organizationtenant C05 | teamadmin S03; physicalinternalsUnknown | organizationroles S12; physicalinternalsUnknown | environmentgovernance S08 | Directus/ToolJetpolicy S38/S43; physicalinternalsUnknown | explicitworkspaceboundary | J02 defer |
| AIappgeneration | Missing C44 | Geminipaid S03 | newapps S11 | genpages S09 | BubbleS29/S30; ToolJetS42 | typedpatch generation | H02/H03 |
| AIassisteddevelopment | deterministicformulahelperonly C19 | Gemini S03 | AIedit S11 | genpages S09 | FlutterFlowdesktopagent S25; n8nS34 | formulaassistantfirst | H01 |
| Testing/debugging | simulation+readiness+tests C41/C42 | deploymentwarnings S02; exactteststudiounknown | workflowconcepts S13; customer-teststudioUnknown | ALMtesting S08 | FlutterFlowTestPilotlisted S28; BubblecheckerExperimental S30 | maker-definedfixtures/debugtrace | K01/K02 |
| Offline | readcache/PWAexplanation C33/C34 | queue/sync S01 | web/mobilestatusnotverified | nativemobileonly S07 | FlutterFlowSQLite S27 notautosync; othersUnknown | offlineCRUD+conflicts | I03 |
| Versioning/deploy | localdraft/configrollback C36 | scriptingheaddeploymentlimitation S04; appALMnotfullyresearched | EnterpriseGit S11 | solutions S08 | AppsmithGit S21; Bubblebranches S33 | schema/envpromotion | A01/J01 |
| Collaboration | multiplebuilders; noCRDT C45 | teamrestrictions S03; liveeditingUnknown | orgpermissions S12; liveeditingUnknown | componentlibALM S10 | Bubblebranchcollab S33 | review/locksfirst | J01 beforeCRDT |
| Monitoring/audit | logs/metrics/processlocal C39/C40 | auditoverview S02 | permissionsadminscopes S12 | governance S08 | ToolJetoverview S42; Directusflowcontext S39 | durabletrace/SLOalerts | J03 |
| Enterprise governance | localroles/backup C07/C38 | teamcontrols S03 | plan-gatedroles S12 | ALMsolutions S08 | ToolJetaccess S43; Directus S38 | secrets/identity/reviewquotas | G02/F02/J01 |

## Library / license candidates

ตรวจ license ข้อความต้นทาง 2026-10-29; เป็น candidate ไม่ใช่ installeddependencies. ก่อนนำเข้าจริงต้อง pinrelease/ตรวจ maintenance/security/transitiveSBOM และ license ณ version นั้นอีกครั้ง. อย่านำ GPL/AGPL/sourceavailableengine มารวมกับ proprietaryBuilder โดยถือว่าใช้ฟรีทุกกรณี

| ID | Candidate | License | Commercial/technical limitation | Official license |
|---|---|---|---|---|
| L00 | Reuse existing engine / platform primitives | ไม่มี dependency ใหม่ | License ของ repo ไม่ได้ประกาศชัดใน root; ตรวจ ownership ก่อนแจก; dependency เดิมตาม lock | [Source](../../../package.json) |
| L01 | Ajv | MIT | คง copyright/license; strictschema ไม่ใช่ permissioncheck; evaluatecompileuntrustedrefs อย่างจำกัด | [Source](https://raw.githubusercontent.com/ajv-validator/ajv/master/LICENSE) |
| L02 | React Flow (xyflow) | MIT | coreMIT; Proexamples/services/assets ไม่เหมารวมอยู่ภายใต้ MIT | [Source](https://raw.githubusercontent.com/xyflow/xyflow/main/LICENSE) |
| L03 | TanStack Virtual | MIT | คง notice; ไม่แก้ serverquerybottleneck ด้วย virtualDOM | [Source](https://raw.githubusercontent.com/TanStack/virtual/main/LICENSE) |
| L04 | dnd-kit | MIT | คง notice; ต้องเพิ่ม keyboard/screenreadersupport เอง | [Source](https://raw.githubusercontent.com/clauderic/dnd-kit/master/LICENSE) |
| L05 | Dexie.js core | Apache-2.0 | คง license/notice; DexieCloud เป็นบริการต่างหาก ไม่รวมมาอัตโนมัติ | [Source](https://raw.githubusercontent.com/dexie/Dexie.js/master/LICENSE) |
| L06 | OpenTelemetry JS | Apache-2.0 | คง license/NOTICE ตาม release; exporter/backendhosting มี cost ต่างหาก | [Source](https://raw.githubusercontent.com/open-telemetry/opentelemetry-js/main/LICENSE) |
| L07 | jose | MIT | คง notice; เป็น JOSEvalidation primitives ไม่ใช่ completeOIDCSSOimplementation | [Source](https://raw.githubusercontent.com/panva/jose/main/LICENSE.md) |
| L08 | Yjs | MIT | คง notice; collaborationserver/mergepolicy/auth ต้องทำเอง; defer จนมี need | [Source](https://raw.githubusercontent.com/yjs/yjs/main/LICENSE) |
| L09 | PostgreSQL | PostgreSQL License | permissive พร้อม notice; ยังไม่เสนอ replaceSQLite ทันที; driverlicense ตรวจแยก | [Source](https://www.postgresql.org/about/licence/) |
| L10 | Zod (alternative to Ajv) | MIT | คง notice; เลือก validator หลักหนึ่งตัว ลด dual-source schemas | [Source](https://raw.githubusercontent.com/colinhacks/zod/main/LICENSE) |

ไม่แนะนำ adoptcompetitorengine ตรงๆ: Budibasepackage-specificGPL/MPL/BSL (S18), ToolJetAGPL (S45), n8nSULexternalcustomerworkflowsrequirescommercial (S37), DirectuscurrentMSCL (S41). สนใจ architecturepatterns ได้โดยไม่ copycode. ReactFlowPro/DexieCloud/commercialIdP แยกจาก OSSlicense

## รายฟีเจอร์: ตอบ 10 คำถาม

แต่ละบัตรต่อไปตอบ: ทำอะไร/ทำไมต้องการ, ปัจจุบันมีไหม, reuse ได้ไหม, สร้างอะไรใหม่, modules ที่กระทบ, risks, OSS/License และควรทำไหม. รายละเอียด 18+fields/Acceptance อยู่ใน Backlog ไม่ใช้คำแนะนำกว้างๆแทนแผน

### A01 Versioned App Package & Migration Plan

| คำถาม | คำตอบเฉพาะ repo |
|---|---|
| 1. ทำอะไร | portable AppSpec envelope พร้อม version และ migration review |
| 2. ผู้ใช้ต้องการเพราะ | ส่งแอปตรวจรถไป staging โดยไม่พาข้อมูลจริงไป; ลดการตั้งค่าซ้ำและเป็นฐานให้ templates/AI/extensions |
| 3. มีแล้วหรือไม่ | C04/C15/C36 Partial |
| 4. ต่อยอดเดิมอย่างไร | canonical app schema + stable IDs + reference visitor; adapters จาก metadata เดิม; existingmodules อ้าง Cxx ใน CurrentInventory |
| 5. ต้องสร้างอะไรใหม่ | export/validate/plan dry-run; import apply ผ่าน services เดิม ไม่รับ SQL จาก package; DB: เพิ่ม package/migration ledger; per-appmetadata ยังใช้เดิม |
| 6. กระทบ module ใด | Frontend: diff/dependency warnings/destructive-change review; Backend ตามข้อ 5; dependencies existingguards/validators |
| 7. ความเสี่ยง | ห้าม importusers/secrets/rolegrants โดยอัตโนมัติ; boundbytes/nodes; checksum ไม่แทน trust |
| 8. OSS ที่พิจารณา | L01 (ทะเบียนด้านบน); noinstall |
| 9. License/เชิงพาณิชย์ | MIT; คง notices/pinversion; L00 ใช้ existingcode ไม่ใช่สิทธิ์แจกจ่ายที่พิสูจน์แล้ว |
| 10. ควรทำไหม | ควรพัฒนาตาม dependency order เพราะ ลดการตั้งค่าซ้ำและเป็นฐานให้ templates/AI/extensions; 18–28person-days, Core. Sourceideas S08,S32,S33, checked2026-10-29 |

### A02 Business App Recipes / Template Installer

| คำถาม | คำตอบเฉพาะ repo |
|---|---|
| 1. ทำอะไร | แพ็ก schema+views+actions+roles แบบ parameterized |
| 2. ผู้ใช้ต้องการเพราะ | สร้างระบบใบลา/ตรวจรถ/asset จากสูตรสำเร็จ; maker เริ่มจากงานจริงแทนหน้าว่าง |
| 3. มีแล้วหรือไม่ | C06 มี clone; reusabletemplates Missing |
| 4. ต่อยอดเดิมอย่างไร | AppSpec template + ID remap + dependency preflight; existingmodules อ้าง Cxx ใน CurrentInventory |
| 5. ต้องสร้างอะไรใหม่ | install dry-run; demo seed opt-in แยก; atomicapply; DB: template catalog/install receipts; ไม่ copy บัญชี |
| 6. กระทบ module ใด | Frontend: เลือก template/map ชื่อ table/preview สิทธิ์; Backend ตามข้อ 5; dependencies A01 |
| 7. ความเสี่ยง | templateuntrusted; freshrolesdefaultdeny; sharedtable ต้อง explicit |
| 8. OSS ที่พิจารณา | L00 (ทะเบียนด้านบน); noinstall |
| 9. License/เชิงพาณิชย์ | ไม่มี dependency ใหม่; คง notices/pinversion; L00 ใช้ existingcode ไม่ใช่สิทธิ์แจกจ่ายที่พิสูจน์แล้ว |
| 10. ควรทำไหม | ควรพัฒนาตาม dependency order เพราะ maker เริ่มจากงานจริงแทนหน้าว่าง; 12–18person-days, Optional. Sourceideas S14,S28, checked2026-10-29 |

### A03 Cross-app Dependency & Change Impact Explorer

| คำถาม | คำตอบเฉพาะ repo |
|---|---|
| 1. ทำอะไร | แสดง impact ต่อ formula/view/workflow/permissions/customnodes ข้ามแอป |
| 2. ผู้ใช้ต้องการเพราะ | ก่อนเปลี่ยนคอลัมน์ที่ใช้ในหลายแอป; ลด breakage และเวลาไล่ซ่อม |
| 3. มีแล้วหรือไม่ | C23/C18 มี diagram/refchecks/rename บางส่วน |
| 4. ต่อยอดเดิมอย่างไร | typed reference graph จาก visitors; reuseformula-dependencies/schema-diagram; existingmodules อ้าง Cxx ใน CurrentInventory |
| 5. ต้องสร้างอะไรใหม่ | read-only impact API; ตรวจ coverage ของ renamevalidators; DB: MVP computedgraph ไม่ persist; indexcache ตาม metadatarevision ภายหลัง |
| 6. กระทบ module ใด | Frontend: impact tree + jump-to-editor + plannedchanges; Backend ตามข้อ 5; dependencies existingguards/validators |
| 7. ความเสี่ยง | ไม่เปิดชื่อ schema ของแอปที่ actor ไม่มีสิทธิ์ |
| 8. OSS ที่พิจารณา | L02 (ทะเบียนด้านบน); noinstall |
| 9. License/เชิงพาณิชย์ | MIT; คง notices/pinversion; L00 ใช้ existingcode ไม่ใช่สิทธิ์แจกจ่ายที่พิสูจน์แล้ว |
| 10. ควรทำไหม | ควรพัฒนาตาม dependency order เพราะ ลด breakage และเวลาไล่ซ่อม; 8–14person-days, Core. Sourceideas S10,S33, checked2026-10-29 |

### B01 Permission-aware Query Planner & Delegation

| คำถาม | คำตอบเฉพาะ repo |
|---|---|
| 1. ทำอะไร | compilefilter/sort/aggregate และ rowrulessubset เป็น parameterizedSQL |
| 2. ผู้ใช้ต้องการเพราะ | เปิด table100krows พร้อม rowrule โดยไม่โหลดทุกแถว; ความเร็วและต้นทุน RAM ที่คาดการณ์ได้ |
| 3. มีแล้วหรือไม่ | C03/C18/C30 มี SQLpaging แต่ fallbackscan |
| 4. ต่อยอดเดิมอย่างไร | typed QueryPlan AST + dialect/capabilities; reference evaluator เป็น oracle; existingmodules อ้าง Cxx ใน CurrentInventory |
| 5. ต้องสร้างอะไรใหม่ | plan/explain/pushdown; unsupportedrule bounded fallback พร้อม warning; DB: ไม่ย้าย DB; indexes เลือกต่างหาก B02 |
| 6. กระทบ module ใด | Frontend: delegationbadge/querycost warning ไม่บอก partial ผลว่า complete; Backend ตามข้อ 5; dependencies F01 |
| 7. ความเสี่ยง | authorizationpredicate ต้องเกิดก่อน pagination/count; ไม่ใช้ rawLLMSQL |
| 8. OSS ที่พิจารณา | L00 (ทะเบียนด้านบน); noinstall |
| 9. License/เชิงพาณิชย์ | ไม่มี dependency ใหม่; คง notices/pinversion; L00 ใช้ existingcode ไม่ใช่สิทธิ์แจกจ่ายที่พิสูจน์แล้ว |
| 10. ควรทำไหม | ควรพัฒนาตาม dependency order เพราะ ความเร็วและต้นทุน RAM ที่คาดการณ์ได้; 25–40person-days, Core. Sourceideas S06,S20, checked2026-10-29 |

### B02 Index Advisor & Explain Console

| คำถาม | คำตอบเฉพาะ repo |
|---|---|
| 1. ทำอะไร | คำแนะนำ index จาก queryshape และ EXPLAIN โดย admin เลือกเอง |
| 2. ผู้ใช้ต้องการเพราะ | filter วันที่/สถานะช้าใน table ใหญ่; เห็นสาเหตุและผลก่อนลงทุนย้าย DB |
| 3. มีแล้วหรือไม่ | C03/C40 มี uniqueindexes/metrics |
| 4. ต่อยอดเดิมอย่างไร | allowlistedqueryplans + indexbenefit estimates; existingmodules อ้าง Cxx ใน CurrentInventory |
| 5. ต้องสร้างอะไรใหม่ | explain read-only; approvedindexDDL ผ่าน schema service; DB: _index_definitions+analysis samples ไม่เก็บ rowvalues |
| 6. กระทบ module ใด | Frontend: recommended indexes/writecost/undo review; Backend ตามข้อ 5; dependencies B01 |
| 7. ความเสี่ยง | indexbuild ล็อก write ได้; schedule/budget/approve ไม่ autoDDL |
| 8. OSS ที่พิจารณา | L00 (ทะเบียนด้านบน); noinstall |
| 9. License/เชิงพาณิชย์ | ไม่มี dependency ใหม่; คง notices/pinversion; L00 ใช้ existingcode ไม่ใช่สิทธิ์แจกจ่ายที่พิสูจน์แล้ว |
| 10. ควรทำไหม | ควรทำเมื่อ pilot ยืนยัน usecase และ foundation พร้อม; เห็นสาเหตุและผลก่อนลงทุนย้าย DB; 8–14person-days, Optional. Sourceideas S06,S38, checked2026-10-29 |

### B03 Relationship / Constraint Designer

| คำถาม | คำตอบเฉพาะ repo |
|---|---|
| 1. ทำอะไร | สร้าง junction+compositeunique/index และ relation ผ่าน ERinspector |
| 2. ผู้ใช้ต้องการเพราะ | รถมีอะไหล่หลายชนิด/อะไหล่ใช้หลายรุ่น; ข้อมูลไม่ซ้ำและความสัมพันธ์เข้าใจง่าย |
| 3. มีแล้วหรือไม่ | C23diagram มี; compositeconstraints Partial |
| 4. ต่อยอดเดิมอย่างไร | extenddiagram to migrationplans; explicitjoinentity แทน JSONarray เมื่อจำเป็น; existingmodules อ้าง Cxx ใน CurrentInventory |
| 5. ต้องสร้างอะไรใหม่ | validateexistingduplicates/refcycles beforeapply; DB: junction tables + metadata constraintsledger |
| 6. กระทบ module ใด | Frontend: cardinality/junction wizard/constraintpreview; Backend ตามข้อ 5; dependencies A01, A03 |
| 7. ความเสี่ยง | ต้องตรวจสิทธิ์ทั้งสองฝั่งและอนุญาต sharedschema จาก owner |
| 8. OSS ที่พิจารณา | L00 (ทะเบียนด้านบน); noinstall |
| 9. License/เชิงพาณิชย์ | ไม่มี dependency ใหม่; คง notices/pinversion; L00 ใช้ existingcode ไม่ใช่สิทธิ์แจกจ่ายที่พิสูจน์แล้ว |
| 10. ควรทำไหม | ควรทำเมื่อ pilot ยืนยัน usecase และ foundation พร้อม; ข้อมูลไม่ซ้ำและความสัมพันธ์เข้าใจง่าย; 16–26person-days, Core. Sourceideas S05,S38, checked2026-10-29 |

### C01 Reusable Visual Components

| คำถาม | คำตอบเฉพาะ repo |
|---|---|
| 1. ทำอะไร | save ส่วนหน้าจอเป็น component มี props/events และ pinnedversion |
| 2. ผู้ใช้ต้องการเพราะ | การ์ดข้อมูลรถใช้ร่วม 5 แอป; แก้ design หนึ่งแห่งและ reviewupgrade แต่ละแอป |
| 3. มีแล้วหรือไม่ | C15nodes มี; C16makerlibraries Missing |
| 4. ต่อยอดเดิมอย่างไร | ComponentDefinition + instanceProps + declaredslots; registryL01; existingmodules อ้าง Cxx ใน CurrentInventory |
| 5. ต้องสร้างอะไรใหม่ | resolveversion/dependencies; validateprops และ cycles; DB: component_definitions/versions + instance refs |
| 6. กระทบ module ใด | Frontend: saveascomponent/librarypicker/upgradepreview; Backend ตามข้อ 5; dependencies A01, L01 |
| 7. ความเสี่ยง | props ไม่รับ JS; component ใช้สิทธิ์ consumerapp ไม่ inheritauthor |
| 8. OSS ที่พิจารณา | L01,L04 (ทะเบียนด้านบน); noinstall |
| 9. License/เชิงพาณิชย์ | MIT, MIT; คง notices/pinversion; L00 ใช้ existingcode ไม่ใช่สิทธิ์แจกจ่ายที่พิสูจน์แล้ว |
| 10. ควรทำไหม | ควรพัฒนาตาม dependency order เพราะ แก้ design หนึ่งแห่งและ reviewupgrade แต่ละแอป; 18–28person-days, Core. Sourceideas S10,S22,S32, checked2026-10-29 |

### C02 Responsive Tokens & Accessibility Inspector

| คำถาม | คำตอบเฉพาะ repo |
|---|---|
| 1. ทำอะไร | token spacing/type/controlsize + responsive overrides และ a11ychecks |
| 2. ผู้ใช้ต้องการเพราะ | maker ปรับ mobileform ไม่ให้ overflow โดยไม่แก้ CSS; UX สม่ำเสมอและรองรับ keyboard |
| 3. มีแล้วหรือไม่ | C01/C14theme/responsive มี |
| 4. ต่อยอดเดิมอย่างไร | token registry resolver + breakpoint constraints reuseCSSvars; existingmodules อ้าง Cxx ใน CurrentInventory |
| 5. ต้องสร้างอะไรใหม่ | validateoverrides และ contrast numeric checks; DB: versioneddisplaytokens ใน appsettings/customspec |
| 6. กระทบ module ใด | Frontend: spacingpresets/devicepreview/focus/labelwarnings; Backend ตามข้อ 5; dependencies A01 |
| 7. ความเสี่ยง | generatedstyles ห้าม arbitraryCSS/URL; a11ywarning ไม่แทน security |
| 8. OSS ที่พิจารณา | L00 (ทะเบียนด้านบน); noinstall |
| 9. License/เชิงพาณิชย์ | ไม่มี dependency ใหม่; คง notices/pinversion; L00 ใช้ existingcode ไม่ใช่สิทธิ์แจกจ่ายที่พิสูจน์แล้ว |
| 10. ควรทำไหม | ควรพัฒนาตาม dependency order เพราะ UX สม่ำเสมอและรองรับ keyboard; 10–16person-days, Core. Sourceideas S23,S25, checked2026-10-29 |

### C03 Kanban View

| คำถาม | คำตอบเฉพาะ repo |
|---|---|
| 1. ทำอะไร | แสดง card ตาม status และย้ายด้วย transitionaction |
| 2. ผู้ใช้ต้องการเพราะ | ติดตามงานซ่อม/คำขอซื้อ; เห็นภาระงานและเปลี่ยนสถานะเร็ว |
| 3. มีแล้วหรือไม่ | C12 มี 9views; Kanban Missing |
| 4. ต่อยอดเดิมอย่างไร | registeredview + pagedcolumnqueries; move เรียก action เดิม; existingmodules อ้าง Cxx ใน CurrentInventory |
| 5. ต้องสร้างอะไรใหม่ | validateversion/status/permissions ไม่ PUTunchecked; DB: viewconfig; optionaltransitionrules ไม่บังคับเปลี่ยน businessschema |
| 6. กระทบ module ใด | Frontend: keyboardanddrag cards; per-columncounts/loading; Backend ตามข้อ 5; dependencies L01, B01 |
| 7. ความเสี่ยง | drag ไม่ข้ามสิทธิ์/valid_if; columns/count ไม่ leakrows |
| 8. OSS ที่พิจารณา | L04,L03 (ทะเบียนด้านบน); noinstall |
| 9. License/เชิงพาณิชย์ | MIT, MIT; คง notices/pinversion; L00 ใช้ existingcode ไม่ใช่สิทธิ์แจกจ่ายที่พิสูจน์แล้ว |
| 10. ควรทำไหม | ควรทำเมื่อ pilot ยืนยัน usecase และ foundation พร้อม; เห็นภาระงานและเปลี่ยนสถานะเร็ว; 12–20person-days, Optional. Sourceideas S42, checked2026-10-29 |

### D01 Multi-step / Wizard Forms

| คำถาม | คำตอบเฉพาะ repo |
|---|---|
| 1. ทำอะไร | แบ่งฟอร์มเป็น step/section มี validation และ progress |
| 2. ผู้ใช้ต้องการเพราะ | ตรวจรถ 10 หมวดก่อนบันทึกครั้งเดียว; ลดภาระสายตาและอัตรากรอกผิด |
| 3. มีแล้วหรือไม่ | C20/C21dynamicform มี; steps Missing |
| 4. ต่อยอดเดิมอย่างไร | stepmetadata referencesexistingcolumns; finalsavepath เดิม; existingmodules อ้าง Cxx ใน CurrentInventory |
| 5. ต้องสร้างอะไรใหม่ | stepvalidationdryrun; finalatomicvalidate ทุก step/children; DB: formdisplay step definitions; ไม่สร้าง table ต่อ step |
| 6. กระทบ module ใด | Frontend: stepper/summaryerrors/focusinvalid/nextback; Backend ตามข้อ 5; dependencies A01 |
| 7. ความเสี่ยง | hiddenstep ไม่ทำให้ bypassrequired/permissions; finalservervalidation ทุกช่อง |
| 8. OSS ที่พิจารณา | L00 (ทะเบียนด้านบน); noinstall |
| 9. License/เชิงพาณิชย์ | ไม่มี dependency ใหม่; คง notices/pinversion; L00 ใช้ existingcode ไม่ใช่สิทธิ์แจกจ่ายที่พิสูจน์แล้ว |
| 10. ควรทำไหม | ควรทำเมื่อ pilot ยืนยัน usecase และ foundation พร้อม; ลดภาระสายตาและอัตรากรอกผิด; 10–16person-days, Optional. Sourceideas S25,S42, checked2026-10-29 |

### D02 Recoverable Form Drafts & Conflict Review

| คำถาม | คำตอบเฉพาะ repo |
|---|---|
| 1. ทำอะไร | กู้ฟอร์มค้างโดยไม่ commit ธุรกิจพร้อม baseversion |
| 2. ผู้ใช้ต้องการเพราะ | มือถือปิดแท็บระหว่างกรอกกลับมากู้ได้; ลดข้อมูลที่พิมพ์สูญหาย |
| 3. มีแล้วหรือไม่ | C33cache/C35optimistic มี; draftform Missing |
| 4. ต่อยอดเดิมอย่างไร | encrypted? localdraftnotassumedsecure; user/app/scopetag + TTL; explicitrestore; existingmodules อ้าง Cxx ใน CurrentInventory |
| 5. ต้องสร้างอะไรใหม่ | drafttoken/versionverify onsubmit; noautopersistbusinessrow; DB: MVP localIndexedDBdraftstore; attachmentreferences ชั่วคราว |
| 6. กระทบ module ใด | Frontend: restore/discard/banner + fielddiffwhen409; Backend ตามข้อ 5; dependencies F01 |
| 7. ความเสี่ยง | PIIlocalstorage opt-in/TTL/logoutwipe; shareddevice ไม่ autodisplay; reauthbeforeupload |
| 8. OSS ที่พิจารณา | L05 (ทะเบียนด้านบน); noinstall |
| 9. License/เชิงพาณิชย์ | Apache-2.0; คง notices/pinversion; L00 ใช้ existingcode ไม่ใช่สิทธิ์แจกจ่ายที่พิสูจน์แล้ว |
| 10. ควรทำไหม | ควรพัฒนาตาม dependency order เพราะ ลดข้อมูลที่พิมพ์สูญหาย; 14–22person-days, Core. Sourceideas S01,S07, checked2026-10-29 |

### D03 Staged Import Mapping & Validation

| คำถาม | คำตอบเฉพาะ repo |
|---|---|
| 1. ทำอะไร | เพิ่ม explicitcustommapping และ durablestagedjobs เหนือ preview เดิม |
| 2. ผู้ใช้ต้องการเพราะ | นำเข้าลูกค้า 50k แถวจาก Excel ต่างชื่อ; ลด partialfailure และช่วย nontechnicalusers |
| 3. มีแล้วหรือไม่ | C29 มี headername/labelmatching, dry-runpreview, issues และ transaction5000rows แล้ว |
| 4. ต่อยอดเดิมอย่างไร | reuseimportExcel validators/preview; addmappingprofile+stagedbatchjob/results; existingmodules อ้าง Cxx ใน CurrentInventory |
| 5. ต้องสร้างอะไรใหม่ | stagedparse/validate/commitwithidempotency/status; preserveexistingpreviewandatomicmode; DB: import_jobs/stagederrors TTL; nofullnameinlogs |
| 6. กระทบ module ใด | Frontend: explicitmapcolumns/errorCSV/progress/reconcile; preview เดิมยังใช้ได้; Backend ตามข้อ 5; dependencies A01, E03 |
| 7. ความเสี่ยง | size/zipbomblimits; fieldpolicy; serverchecks ทุก row; partialvsatomicchoiceclear |
| 8. OSS ที่พิจารณา | L00 (ทะเบียนด้านบน); noinstall |
| 9. License/เชิงพาณิชย์ | ไม่มี dependency ใหม่; คง notices/pinversion; L00 ใช้ existingcode ไม่ใช่สิทธิ์แจกจ่ายที่พิสูจน์แล้ว |
| 10. ควรทำไหม | ควรทำเมื่อ pilot ยืนยัน usecase และ foundation พร้อม; ลด partialfailure และช่วย nontechnicalusers; 18–28person-days, Optional. Sourceideas S14,S20, checked2026-10-29 |

### E01 Bounded Workflow Branches & Iteration

| คำถาม | คำตอบเฉพาะ repo |
|---|---|
| 1. ทำอะไร | if/switch/foreachlimited พร้อม typeddataflow |
| 2. ผู้ใช้ต้องการเพราะ | แยกอนุมัติค่าใช้จ่ายตามวงเงิน; ลดต้องเขียน Action ซ้ำหลายชุด |
| 3. มีแล้วหรือไม่ | C26linearsteps มี |
| 4. ต่อยอดเดิมอย่างไร | versionedworkflowIR + executionbudget; keepv1linearadapter; existingmodules อ้าง Cxx ใน CurrentInventory |
| 5. ต้องสร้างอะไรใหม่ | branch/loopvalidation + persistedstepinstances; DB: job_step_instances+IRversion; workflowconfigmigrate |
| 6. กระทบ module ใด | Frontend: graphcanvas+inputs/outputs+simulationtrace; Backend ตามข้อ 5; dependencies A01, L01, E03 |
| 7. ความเสี่ยง | loopmaxitems/time/recursion; recheckactor ก่อน sideeffect |
| 8. OSS ที่พิจารณา | L02 (ทะเบียนด้านบน); noinstall |
| 9. License/เชิงพาณิชย์ | MIT; คง notices/pinversion; L00 ใช้ existingcode ไม่ใช่สิทธิ์แจกจ่ายที่พิสูจน์แล้ว |
| 10. ควรทำไหม | ควรทำเมื่อ pilot ยืนยัน usecase และ foundation พร้อม; ลดต้องเขียน Action ซ้ำหลายชุด; 25–40person-days, Core. Sourceideas S13,S34,S39, checked2026-10-29 |

### E02 Human Approval Inbox / Durable Wait

| คำถาม | คำตอบเฉพาะ repo |
|---|---|
| 1. ทำอะไร | พัก job รอผู้อนุมัติ/วันครบกำหนดแล้ว resume |
| 2. ผู้ใช้ต้องการเพราะ | ขอซื้อ/OT ต้องผู้จัดการอนุมัติ; ทำ businessprocess ครบตั้งแต่ request ถึง audit |
| 3. มีแล้วหรือไม่ | C26 ไม่มี waitstep |
| 4. ต่อยอดเดิมอย่างไร | durablewaitstate+approvalcommand; transitionsversioned; existingmodules อ้าง Cxx ใน CurrentInventory |
| 5. ต้องสร้างอะไรใหม่ | approve/reject/expire/reassign guarded; resumeonce; DB: approval_tasks/decisions/waittokens TTL |
| 6. กระทบ module ใด | Frontend: inbox/detaildecision/comments+statushistory; Backend ตามข้อ 5; dependencies A01, E03, F01 |
| 7. ความเสี่ยง | actor/membership/selfapprovalpolicy; token ผูก task/version ไม่ publicbearer |
| 8. OSS ที่พิจารณา | L00 (ทะเบียนด้านบน); noinstall |
| 9. License/เชิงพาณิชย์ | ไม่มี dependency ใหม่; คง notices/pinversion; L00 ใช้ existingcode ไม่ใช่สิทธิ์แจกจ่ายที่พิสูจน์แล้ว |
| 10. ควรทำไหม | ควรพัฒนาตาม dependency order เพราะ ทำ businessprocess ครบตั้งแต่ request ถึง audit; 25–40person-days, Core. Sourceideas S36,S39, checked2026-10-29 |

### E03 Workflow Delivery Ledger & Recovery Policies

| คำถาม | คำตอบเฉพาะ repo |
|---|---|
| 1. ทำอะไร | ต่อยอด deliveryreceipts/structuredunknownoutcome/controlledretry ไม่สร้าง queue ซ้ำ |
| 2. ผู้ใช้ต้องการเพราะ | webhook สร้างใบงานสำเร็จแต่ process ตายก่อน checkpoint; ลดการทำรายการซ้ำและ recovery ที่ไม่แน่นอน |
| 3. มีแล้วหรือไม่ | C27 มี transactionaljobenqueue, checkpoint, Idempotency-Key และ manualretry แล้ว |
| 4. ต่อยอดเดิมอย่างไร | reuse _automation_jobs เป็น outboxadapter; adddeliveryreceipt/attemptstate+leases; preserveexistingstableeffectkey; existingmodules อ้าง Cxx ใน CurrentInventory |
| 5. ต้องสร้างอะไรใหม่ | classifyunknownoutcome/reconcile; boundedapprovedbackoff/jitter; perdeliveryattemptaudit; DB: delivery_attempts/receipts; generic event_outbox เพิ่มเฉพาะ futurebus ที่ต้องการ |
| 6. กระทบ module ใด | Frontend: deliverytimeline/retrysafe/needsreconcile; Backend ตามข้อ 5; dependencies existingguards/validators |
| 7. ความเสี่ยง | outboundallowlist/SSRF/DNS/secretredaction; noautorettryunsafeeffect |
| 8. OSS ที่พิจารณา | L00 (ทะเบียนด้านบน); noinstall |
| 9. License/เชิงพาณิชย์ | ไม่มี dependency ใหม่; คง notices/pinversion; L00 ใช้ existingcode ไม่ใช่สิทธิ์แจกจ่ายที่พิสูจน์แล้ว |
| 10. ควรทำไหม | ควรพัฒนาตาม dependency order เพราะ ลดการทำรายการซ้ำและ recovery ที่ไม่แน่นอน; 18–28person-days, Core. Sourceideas S35,S36, checked2026-10-29 |

### F01 Effective Permission Simulator

| คำถาม | คำตอบเฉพาะ repo |
|---|---|
| 1. ทำอะไร | เลือก app/user/operation แล้วดู table/row/action/exportdecision และเหตุผล |
| 2. ผู้ใช้ต้องการเพราะ | ผู้ดูแลตั้ง role แล้วสงสัยว่าทำไม user เห็นปุ่ม/ข้อมูลไม่เท่ากัน; ลด support และป้องกันสิทธิ์ผิด |
| 3. มีแล้วหรือไม่ | C07–09/C41 มี guards+actionsimulation; permissionexplain Missing |
| 4. ต่อยอดเดิมอย่างไร | policydecisiontrace fromsameguards ไม่ duplicatepolicyengine; existingmodules อ้าง Cxx ใน CurrentInventory |
| 5. ต้องสร้างอะไรใหม่ | read-onlysimulate underactorcontext; sanitizedreason tree; DB: MVP no schema change; savedcasesoptionalK01 |
| 6. กระทบ module ใด | Frontend: role/user/appcompare + no-mutationtestcases; Backend ตามข้อ 5; dependencies existingguards/validators |
| 7. ความเสี่ยง | Owner/authorizedappadmin เท่านั้น; cannotimpersonatewrite; no rawdeniedrow values |
| 8. OSS ที่พิจารณา | L00 (ทะเบียนด้านบน); noinstall |
| 9. License/เชิงพาณิชย์ | ไม่มี dependency ใหม่; คง notices/pinversion; L00 ใช้ existingcode ไม่ใช่สิทธิ์แจกจ่ายที่พิสูจน์แล้ว |
| 10. ควรทำไหม | ควรพัฒนาตาม dependency order เพราะ ลด support และป้องกันสิทธิ์ผิด; 10–16person-days, Core. Sourceideas S02,S12,S43, checked2026-10-29 |

### F02 OIDC Federation & Step-up MFA

| คำถาม | คำตอบเฉพาะ repo |
|---|---|
| 1. ทำอะไร | เชื่อม IdP และบังคับ stepup สำหรับ publish/exportadmin |
| 2. ผู้ใช้ต้องการเพราะ | องค์กรใช้ Microsoft/Googleaccount และถอดสิทธิ์จากจุดเดียว; ลด passwordsupport และเพิ่ม governance |
| 3. มีแล้วหรือไม่ | C10localidentity มี; C11SSO/MFA Missing |
| 4. ต่อยอดเดิมอย่างไร | OIDCauthorizationcodePKCE + serveridentitylink; reuseexistingperapproles; existingmodules อ้าง Cxx ใน CurrentInventory |
| 5. ต้องสร้างอะไรใหม่ | callbackstate/nonce/issuer/audience/JWKS validation; nosilentemailmerge; DB: identity_links/providerconfigs/sessionauthlevel |
| 6. กระทบ module ใด | Frontend: SSObutton/linkaccount/stepupprompt/recoverypolicy; Backend ตามข้อ 5; dependencies F01, G02 |
| 7. ความเสี่ยง | loginCSRF/tokenreplay/accounttakeover; emergencyownerbreakglassmustreview |
| 8. OSS ที่พิจารณา | L07 (ทะเบียนด้านบน); noinstall |
| 9. License/เชิงพาณิชย์ | MIT; คง notices/pinversion; L00 ใช้ existingcode ไม่ใช่สิทธิ์แจกจ่ายที่พิสูจน์แล้ว |
| 10. ควรทำไหม | ควรทำเมื่อ pilot ยืนยัน usecase และ foundation พร้อม; ลด passwordsupport และเพิ่ม governance; 25–40person-days, External Integration. Sourceideas S12,S43, checked2026-10-29 |

### F03 Scoped Service Accounts & Stable API v1

| คำถาม | คำตอบเฉพาะ repo |
|---|---|
| 1. ทำอะไร | machinecredentials มี app/table/operation/expiry/quotas |
| 2. ผู้ใช้ต้องการเพราะ | ERP อ่าน inventory โดยไม่ใช้ ownerpassword; เปิด integrations อย่างควบคุมและ rotate ได้ |
| 3. มีแล้วหรือไม่ | C30internalcookieAPI มี; C11tokens Missing |
| 4. ต่อยอดเดิมอย่างไร | serviceprincipal mappedexistingguards; OpenAPI fromtypedcontracts; existingmodules อ้าง Cxx ใน CurrentInventory |
| 5. ต้องสร้างอะไรใหม่ | tokenhash/rotation/revoke; APIv1limit/projection/versions; DB: service_principals/tokens/scopes/usagecaps |
| 6. กระทบ module ใด | Frontend: tokencreator/scopepreview/usage/revocation; Backend ตามข้อ 5; dependencies A01, F01, G02 |
| 7. ความเสี่ยง | neverownerbydefault; blockadminAPI; audittokenfingerprint ไม่ logtoken |
| 8. OSS ที่พิจารณา | L01 (ทะเบียนด้านบน); noinstall |
| 9. License/เชิงพาณิชย์ | MIT; คง notices/pinversion; L00 ใช้ existingcode ไม่ใช่สิทธิ์แจกจ่ายที่พิสูจน์แล้ว |
| 10. ควรทำไหม | ควรทำเมื่อ pilot ยืนยัน usecase และ foundation พร้อม; เปิด integrations อย่างควบคุมและ rotate ได้; 20–32person-days, Core. Sourceideas S05,S20,S38, checked2026-10-29 |

### G01 REST Data Source & Query Builder

| คำถาม | คำตอบเฉพาะ repo |
|---|---|
| 1. ทำอะไร | ผูก externalREST อ่านข้อมูลเป็น queryresource ที่ reuse ใน View |
| 2. ผู้ใช้ต้องการเพราะ | dashboard ดึง stock จาก ERP โดยไม่ copytable ทุกคืน; ต่อระบบจริงได้โดย maker ไม่เขียน fetch |
| 3. มีแล้วหรือไม่ | C30outboundwebhook มี; datasourceadapter Missing |
| 4. ต่อยอดเดิมอย่างไร | DataSourceAdapter capabilitycontract; normalizeQueryResult; explicitremotevslocaldataset; existingmodules อ้าง Cxx ใน CurrentInventory |
| 5. ต้องสร้างอะไรใหม่ | allowlistedHTTPSproxy/authvault/pagination/schema/timeout/cache; peruserresourceguard; DB: datasources/resourcegrants/queries/result_schema |
| 6. กระทบ module ใด | Frontend: connect/test/querymapper + viewbindinginspector; Backend ตามข้อ 5; dependencies A01, G02, F01 |
| 7. ความเสี่ยง | SSRF/DNSrebind/redirect/privateIP; no browsersecret; paginationupperbounds; credentialdelegationexplicit |
| 8. OSS ที่พิจารณา | L01 (ทะเบียนด้านบน); noinstall |
| 9. License/เชิงพาณิชย์ | MIT; คง notices/pinversion; L00 ใช้ existingcode ไม่ใช่สิทธิ์แจกจ่ายที่พิสูจน์แล้ว |
| 10. ควรทำไหม | ควรพัฒนาตาม dependency order เพราะ ต่อระบบจริงได้โดย maker ไม่เขียน fetch; 22–34person-days, Core. Sourceideas S05,S14,S20, checked2026-10-29 |

### G02 App-scoped Connection Secrets

| คำถาม | คำตอบเฉพาะ repo |
|---|---|
| 1. ทำอะไร | จัดการ connectioncredentials ผ่าน secretrefs/rotate โดยไม่อยู่ configexport |
| 2. ผู้ใช้ต้องการเพราะ | แต่ละแอปใช้ ERPtoken คนละชุด; ลดรั่วไหลและตั้งค่าตอนย้าย environment ได้ |
| 3. มีแล้วหรือไม่ | C27envtoken มี; reusablevault Missing |
| 4. ต่อยอดเดิมอย่างไร | secretbroker envelopeAES-GCM withexternalmasterkeyref; serveronly; existingmodules อ้าง Cxx ใน CurrentInventory |
| 5. ต้องสร้างอะไรใหม่ | write-onlysecrets/testconnection/rotate/audit; migrateenvrefsoptional; DB: secret_refs/encrypted_versions/accessgrants; masterkeynotDBbackup |
| 6. กระทบ module ใด | Frontend: maskedcredentialforms/lastrotated/testresult; Backend ตามข้อ 5; dependencies F01 |
| 7. ความเสี่ยง | app+actor+purposecheck; redactlogs; keyloss/restore/rotationplaybook; neverAIcontext |
| 8. OSS ที่พิจารณา | L00 (ทะเบียนด้านบน); noinstall |
| 9. License/เชิงพาณิชย์ | ไม่มี dependency ใหม่; คง notices/pinversion; L00 ใช้ existingcode ไม่ใช่สิทธิ์แจกจ่ายที่พิสูจน์แล้ว |
| 10. ควรทำไหม | ควรพัฒนาตาม dependency order เพราะ ลดรั่วไหลและตั้งค่าตอนย้าย environment ได้; 14–22person-days, Core. Sourceideas S05,S12,S17, checked2026-10-29 |

### G03 Signed Inbound Webhooks

| คำถาม | คำตอบเฉพาะ repo |
|---|---|
| 1. ทำอะไร | endpoint รับ event พร้อม signature/replayguard แล้ว enqueue |
| 2. ผู้ใช้ต้องการเพราะ | ERP แจ้งสถานะซ่อมกลับ Builder; ลด polling และ sync ข้อมูลตรงเวลา |
| 3. มีแล้วหรือไม่ | C30outbound มี; inboundtrigger Missing |
| 4. ต่อยอดเดิมอย่างไร | ingressverify→idempotenteventrecord→workflowenqueue; existingmodules อ้าง Cxx ใน CurrentInventory |
| 5. ต้องสร้างอะไรใหม่ | HMACtimestamp/eventID/bodybudget/ratecap; ACKdurableaftercommit; DB: webhook_endpoints/received_events retention |
| 6. กระทบ module ใด | Frontend: endpointconfig/mockeventtester/deliveryhistory; Backend ตามข้อ 5; dependencies E03, G02, F01 |
| 7. ความเสี่ยง | replay/contenttype/oversize; nosessionbypass toadmin; signaturerawbodyexact |
| 8. OSS ที่พิจารณา | L00 (ทะเบียนด้านบน); noinstall |
| 9. License/เชิงพาณิชย์ | ไม่มี dependency ใหม่; คง notices/pinversion; L00 ใช้ existingcode ไม่ใช่สิทธิ์แจกจ่ายที่พิสูจน์แล้ว |
| 10. ควรทำไหม | ควรทำเมื่อ pilot ยืนยัน usecase และ foundation พร้อม; ลด polling และ sync ข้อมูลตรงเวลา; 14–22person-days, Optional. Sourceideas S16,S35, checked2026-10-29 |

### H01 AI Formula Assistant (Thai-first)

| คำถาม | คำตอบเฉพาะ repo |
|---|---|
| 1. ทำอะไร | ภาษาธรรมชาติ→สูตรพร้อมเหตุผล/testexamples และ validator เดิม |
| 2. ผู้ใช้ต้องการเพราะ | ระยะเวลาตรวจหรือ valid_if ซับซ้อนโดยไม่จำ syntax; ลดเวลาศึกษาและ error ของ maker |
| 3. มีแล้วหรือไม่ | C18/C19deterministictools มี; C44LLM Missing |
| 4. ต่อยอดเดิมอย่างไร | provideradapter→FormulaProposalJSON→parse/type/refcheck→dryrun; existingmodules อ้าง Cxx ใน CurrentInventory |
| 5. ต้องสร้างอะไรใหม่ | boundedrequest/modelbudget; authorizedschemaonly; recordproposal; DB: ai_policy/proposals/usagemeter; sourcepromptmetadataonly |
| 6. กระทบ module ใด | Frontend: suggest/compare/test/insertbutton ใน ExpressionAssistant; Backend ตามข้อ 5; dependencies A01, G02, F01 |
| 7. ความเสี่ยง | schema/docspromptinjection; neverevalJS/SQL; noautopublish; no rowsbydefault |
| 8. OSS ที่พิจารณา | L01 (ทะเบียนด้านบน); noinstall |
| 9. License/เชิงพาณิชย์ | MIT; คง notices/pinversion; L00 ใช้ existingcode ไม่ใช่สิทธิ์แจกจ่ายที่พิสูจน์แล้ว |
| 10. ควรทำไหม | ควรพัฒนาตาม dependency order เพราะ ลดเวลาศึกษาและ error ของ maker; 12–20person-days, Optional. Sourceideas S03,S17,S34, checked2026-10-29 |

### H02 AI Schema Planner

| คำถาม | คำตอบเฉพาะ repo |
|---|---|
| 1. ทำอะไร | โจทย์ธุรกิจ→tables/relations/constraints แบบ reviewableplan |
| 2. ผู้ใช้ต้องการเพราะ | สร้างระบบยืมคืน asset จาก brief ภาษาไทย; ลดเริ่มจาก blank และชี้เรื่อง FK/index |
| 3. มีแล้วหรือไม่ | C23schemaeditor มี; schemaAI Missing |
| 4. ต่อยอดเดิมอย่างไร | AppSpecpatch notSQL; name/relationship/constraintvalidators; impactplan; existingmodules อ้าง Cxx ใน CurrentInventory |
| 5. ต้องสร้างอะไรใหม่ | providerstrategy+schema-scopedcontext+syntheticseedpreview; DB: proposalstore; no businessDDLuntilapproval |
| 6. กระทบ module ใด | Frontend: ERpreview/rename/mapexistingtables/approveplan; Backend ตามข้อ 5; dependencies A01, A03, H01 |
| 7. ความเสี่ยง | hallucinatedPIIcolumns/privileges; destructivechangesdefaultdeny; noauthschemageneration |
| 8. OSS ที่พิจารณา | L01,L02 (ทะเบียนด้านบน); noinstall |
| 9. License/เชิงพาณิชย์ | MIT, MIT; คง notices/pinversion; L00 ใช้ existingcode ไม่ใช่สิทธิ์แจกจ่ายที่พิสูจน์แล้ว |
| 10. ควรทำไหม | ควรทำเมื่อ pilot ยืนยัน usecase และ foundation พร้อม; ลดเริ่มจาก blank และชี้เรื่อง FK/index; 18–28person-days, Optional. Sourceideas S03,S17,S30, checked2026-10-29 |

### H03 AI Incremental App / UI / Workflow Drafts

| คำถาม | คำตอบเฉพาะ repo |
|---|---|
| 1. ทำอะไร | ให้ AI ประกอบ registeredcomponents และ stepIR ใน draft |
| 2. ผู้ใช้ต้องการเพราะ | เพิ่มหน้าติดตามซ่อมพร้อม workflow แจ้งเตือนจาก brief; เพิ่ม productivity โดยยัง review ทุก diff |
| 3. มีแล้วหรือไม่ | C15/C26 มี editors; AIgeneration Missing |
| 4. ต่อยอดเดิมอย่างไร | plan→typedpatch→validate→renderpreview/simulation→humanpublish; existingmodules อ้าง Cxx ใน CurrentInventory |
| 5. ต้องสร้างอะไรใหม่ | reuseAppSpec/Releases; toolallowlist; boundedrepairloop2; DB: ai_runs/proposedpatches/baselinemetadatahash |
| 6. กระทบ module ใด | Frontend: conversationplan/diff/screenshot/undo/approval; Backend ตามข้อ 5; dependencies H02, C01, E01, J01 |
| 7. ความเสี่ยง | untrustedtoolresponses; noarbitrarycode/network/secretread; patchnotgrantpermissions |
| 8. OSS ที่พิจารณา | L01 (ทะเบียนด้านบน); noinstall |
| 9. License/เชิงพาณิชย์ | MIT; คง notices/pinversion; L00 ใช้ existingcode ไม่ใช่สิทธิ์แจกจ่ายที่พิสูจน์แล้ว |
| 10. ควรทำไหม | ควรทำเมื่อ pilot ยืนยัน usecase และ foundation พร้อม; เพิ่ม productivity โดยยัง review ทุก diff; 30–50person-days, Optional. Sourceideas S09,S11,S25,S29,S34,S42, checked2026-10-29 |

### I01 Virtualized Runtime Tables / Lists

| คำถาม | คำตอบเฉพาะ repo |
|---|---|
| 1. ทำอะไร | render เฉพาะ visiblewindow พร้อม stickyrow/groupheaders |
| 2. ผู้ใช้ต้องการเพราะ | กริดคอลัมน์มากบน mobile/tablet; ลด DOM/jank โดยไม่เพิ่ม downloadall |
| 3. มีแล้วหรือไม่ | C12paging/cache มี; virtualization Missing |
| 4. ต่อยอดเดิมอย่างไร | virtualrenderadapter to existingpagedquery; stableIDs/heights; existingmodules อ้าง Cxx ใน CurrentInventory |
| 5. ต้องสร้างอะไรใหม่ | API เดิม; addcolumnprojection ถ้าจำเป็น; DB: ไม่ต้อง schema ใหม่ |
| 6. กระทบ module ใด | Frontend: virtualrows/columns withfocus/scrollrestore/errorfallback; Backend ตามข้อ 5; dependencies existingguards/validators |
| 7. ความเสี่ยง | a11y/focus และ hiddenrowleak; virtual ไม่ทำให้ SQL เร็วขึ้น |
| 8. OSS ที่พิจารณา | L03 (ทะเบียนด้านบน); noinstall |
| 9. License/เชิงพาณิชย์ | MIT; คง notices/pinversion; L00 ใช้ existingcode ไม่ใช่สิทธิ์แจกจ่ายที่พิสูจน์แล้ว |
| 10. ควรทำไหม | ควรทำเมื่อ pilot ยืนยัน usecase และ foundation พร้อม; ลด DOM/jank โดยไม่เพิ่ม downloadall; 12–20person-days, Core. Sourceideas S19,S25, checked2026-10-29 |

### I02 Realtime Fanout / Delta Invalidation

| คำถาม | คำตอบเฉพาะ repo |
|---|---|
| 1. ทำอะไร | รวม poll/fanout ใน server และส่ง revision/delta แบบ bounded |
| 2. ผู้ใช้ต้องการเพราะ | ผู้ใช้ 100 คนเปิด table เดียวกัน; ลด query ต่อ connection และ refresh ไม่จำเป็น |
| 3. มีแล้วหรือไม่ | C32SSEper-table มี |
| 4. ต่อยอดเดิมอย่างไร | sharedrevisionpoller perprocess+subscriberACL; deltaoptional; existingmodules อ้าง Cxx ใน CurrentInventory |
| 5. ต้องสร้างอะไรใหม่ | connection/backpressure/sessionrecheck; crossprocesspubsub หลัง need; DB: optionalchange_logbounded; baseversion/tombstones |
| 6. กระทบ module ใด | Frontend: coalescedupdates/dirtyformprotection/resyncindicator; Backend ตามข้อ 5; dependencies E03 |
| 7. ความเสี่ยง | SSEpermissionrevocation/slowclients/sidechannel; no unauthrowbroadcast |
| 8. OSS ที่พิจารณา | L00 (ทะเบียนด้านบน); noinstall |
| 9. License/เชิงพาณิชย์ | ไม่มี dependency ใหม่; คง notices/pinversion; L00 ใช้ existingcode ไม่ใช่สิทธิ์แจกจ่ายที่พิสูจน์แล้ว |
| 10. ควรทำไหม | ควรทำเมื่อ pilot ยืนยัน usecase และ foundation พร้อม; ลด query ต่อ connection และ refresh ไม่จำเป็น; 20–32person-days, Core. Sourceideas S35,S38, checked2026-10-29 |

### I03 Offline Write Queue & Conflict Center

| คำถาม | คำตอบเฉพาะ repo |
|---|---|
| 1. ทำอะไร | บันทึก offline แล้ว sync พร้อม retry/dedupe/conflictresolution |
| 2. ผู้ใช้ต้องการเพราะ | ตรวจรถในจุดอับสัญญาณรวมรูป; งานภาคสนามต่อเนื่องและไม่สูญข้อมูล |
| 3. มีแล้วหรือไม่ | C33readcache/C34PWA มี; offlineCRUD Missing |
| 4. ต่อยอดเดิมอย่างไร | perapp/useroutboxclient + idmapping + serveridempotency + versionpolicy; existingmodules อ้าง Cxx ใน CurrentInventory |
| 5. ต้องสร้างอะไรใหม่ | syncAPI/delta/retention/grantrecheck; multipartuploadstaging; DB: clientIndexedDBwrites/blobs; serverdedupe/sync_tokens |
| 6. กระทบ module ใด | Frontend: pending/conflictitems/resolve/manualsync; storagequota warning; Backend ตามข้อ 5; dependencies A01, D02, E03, F01, I02 |
| 7. ความเสี่ยง | offlinepermissionexpiry/encryptionnotpromise; revokeddatawipe; shareddevice; blobsquota |
| 8. OSS ที่พิจารณา | L05 (ทะเบียนด้านบน); noinstall |
| 9. License/เชิงพาณิชย์ | Apache-2.0; คง notices/pinversion; L00 ใช้ existingcode ไม่ใช่สิทธิ์แจกจ่ายที่พิสูจน์แล้ว |
| 10. ควรทำไหม | ยังไม่ควรทำตอนนี้ทั้งหมด; ทดลอง scope เล็กเมื่อ demand ชัด เพราะต้นทุน/ความเสี่ยงสูง; 40–65person-days, Optional. Sourceideas S01,S07,S27, checked2026-10-29 |

### J01 Environment Promotion & Review Workflow

| คำถาม | คำตอบเฉพาะ repo |
|---|---|
| 1. ทำอะไร | dev/stage/prod配置และ reviewedreleasepackage |
| 2. ผู้ใช้ต้องการเพราะ | ทดสอบสูตร/connector ใน stage ก่อนโปรโมต; ลดผิดพลาดจากแก้ live และรองรับทีม |
| 3. มีแล้วหรือไม่ | C36draft/hashrollback มี; C37envGit Missing |
| 4. ต่อยอดเดิมอย่างไร | AppSpecartifact+envconnectionbindings+baselinehash+approverroles; existingmodules อ้าง Cxx ใน CurrentInventory |
| 5. ต้องสร้างอะไรใหม่ | exportvalidatepromote; gateReadiness/K01; manualGitexportMVP; DB: environments/releases/reviewdecisions/resourcebindings |
| 6. กระทบ module ใด | Frontend: releasecompare/approvereject/rollback/envselector; Backend ตามข้อ 5; dependencies A01, A03, G02 |
| 7. ความเสี่ยง | separatepromotionpermission; no copyingprodsecrets/data; schematicrollbacknotbusinessdatarollback |
| 8. OSS ที่พิจารณา | L00 (ทะเบียนด้านบน); noinstall |
| 9. License/เชิงพาณิชย์ | ไม่มี dependency ใหม่; คง notices/pinversion; L00 ใช้ existingcode ไม่ใช่สิทธิ์แจกจ่ายที่พิสูจน์แล้ว |
| 10. ควรทำไหม | ควรพัฒนาตาม dependency order เพราะ ลดผิดพลาดจากแก้ live และรองรับทีม; 25–40person-days, Core. Sourceideas S08,S10,S21,S33, checked2026-10-29 |

### J02 Organization Workspaces / Tenant Quotas

| คำถาม | คำตอบเฉพาะ repo |
|---|---|
| 1. ทำอะไร | workspaceusers/apps/resources/budgets และ isolationpolicy |
| 2. ผู้ใช้ต้องการเพราะ | Builder ขายให้หลายบริษัทโดยไม่ปนกัน; เปิด B2BSaaS หลังมี demand และ SLA |
| 3. มีแล้วหรือไม่ | C05multiapp มี; orgboundary Partial |
| 4. ต่อยอดเดิมอย่างไร | explicittenantscopeandresourceownership; enforceeveryentrypoint; physicalisolationoption; existingmodules อ้าง Cxx ใน CurrentInventory |
| 5. ต้องสร้างอะไรใหม่ | tenantguards/migrations/storagejobsisolation/quotas; DB: workspace_id/tenantresources+ownershipmigration acrosscatalog |
| 6. กระทบ module ใด | Frontend: workspaceadmin/billing-independentquota/settings; Backend ตามข้อ 5; dependencies A01, F01, J01 |
| 7. ความเสี่ยง | tenantescape/sharedtablemigration; no trustingUIselector; isolationmatrix beforelaunch |
| 8. OSS ที่พิจารณา | L00 (ทะเบียนด้านบน); noinstall |
| 9. License/เชิงพาณิชย์ | ไม่มี dependency ใหม่; คง notices/pinversion; L00 ใช้ existingcode ไม่ใช่สิทธิ์แจกจ่ายที่พิสูจน์แล้ว |
| 10. ควรทำไหม | ยังไม่ควรทำตอนนี้ทั้งหมด; ทดลอง scope เล็กเมื่อ demand ชัด เพราะต้นทุน/ความเสี่ยงสูง; 50–80person-days, Core. Sourceideas S12,S38,S43, checked2026-10-29 |

### J03 Durable Observability / SLO & Alerts

| คำถาม | คำตอบเฉพาะ repo |
|---|---|
| 1. ทำอะไร | traceIDs+persistedaggregates+budget+notificationthresholds |
| 2. ผู้ใช้ต้องการเพราะ | รู้ว่า app ช้าจาก SQL/formula/PDF หรือ webhook และแจ้ง admin; ลด MTTR และพิสูจน์ก่อน–หลัง |
| 3. มีแล้วหรือไม่ | C39/C40logs/metrics มี |
| 4. ต่อยอดเดิมอย่างไร | instrumentservicesviaOTelbridge; metricexport; alertsoutbox; existingmodules อ้าง Cxx ใน CurrentInventory |
| 5. ต้องสร้างอะไรใหม่ | boundedspans/redaction/sampling/retention; groupbyapp/table; DB: rollupstoreTTL optionalexternalcollector; no rawvalues |
| 6. กระทบ module ใด | Frontend: p50/p95/errorbudget/beforeafter/alertconfig; Backend ตามข้อ 5; dependencies E03 |
| 7. ความเสี่ยง | PII/secretredaction และ access; alertstormdedupe; no expensive fullSQLpayloads |
| 8. OSS ที่พิจารณา | L06 (ทะเบียนด้านบน); noinstall |
| 9. License/เชิงพาณิชย์ | Apache-2.0; คง notices/pinversion; L00 ใช้ existingcode ไม่ใช่สิทธิ์แจกจ่ายที่พิสูจน์แล้ว |
| 10. ควรทำไหม | ควรพัฒนาตาม dependency order เพราะ ลด MTTR และพิสูจน์ก่อน–หลัง; 14–24person-days, Core + External Integration. Sourceideas S02,S12,S42, checked2026-10-29 |

### K01 No-code Test Studio & Publish Gates

| คำถาม | คำตอบเฉพาะ repo |
|---|---|
| 1. ทำอะไร | maker กำหนด givenrows/actor/action/expectedresults แบบ fixtures |
| 2. ผู้ใช้ต้องการเพราะ | เปลี่ยนสูตรแล้วมั่นใจ status/duration/roles ยังถูก; ลด regression โดยไม่ต้องเขียน Playwright |
| 3. มีแล้วหรือไม่ | C41simulation/C42developertests มี |
| 4. ต่อยอดเดิมอย่างไร | tests-as-AppSpec + isolatedSQLite runner + existingguards/evaluator; existingmodules อ้าง Cxx ใน CurrentInventory |
| 5. ต้องสร้างอะไรใหม่ | seed/simulate/assert/rollback; asyncbrowseradapterlater; DB: test_definitions/fixtures/results artifacts redacted |
| 6. กระทบ module ใด | Frontend: Given/When/Then UI+failureexplanation+diff; Backend ตามข้อ 5; dependencies A01, F01 |
| 7. ความเสี่ยง | neverexecuteprodmutations; fixturePIIscrub; actorsnoelevation; externalwebhookmock |
| 8. OSS ที่พิจารณา | L00 (ทะเบียนด้านบน); noinstall |
| 9. License/เชิงพาณิชย์ | ไม่มี dependency ใหม่; คง notices/pinversion; L00 ใช้ existingcode ไม่ใช่สิทธิ์แจกจ่ายที่พิสูจน์แล้ว |
| 10. ควรทำไหม | ควรพัฒนาตาม dependency order เพราะ ลด regression โดยไม่ต้องเขียน Playwright; 18–28person-days, Core. Sourceideas S28,S30,S34, checked2026-10-29 |

### K02 Binding / Workflow Trace Debugger

| คำถาม | คำตอบเฉพาะ repo |
|---|---|
| 1. ทำอะไร | singletrace การโหลด binding→formula→action→workflow→HTTP |
| 2. ผู้ใช้ต้องการเพราะ | maker ถามว่าคอลัมน์นี้ทำไมได้ค่า 42 วินาที; ลดการไล่ log และปรับ config ผิดจุด |
| 3. มีแล้วหรือไม่ | C19/C40/C41trace/preview มี |
| 4. ต่อยอดเดิมอย่างไร | read-onlytraceview reuseaction-trace/simulation; structurederrorpath; existingmodules อ้าง Cxx ใน CurrentInventory |
| 5. ต้องสร้างอะไรใหม่ | correlationids/sourcepointers+scopedtracefetch; DB: boundedtraceartifact metadata; retentionperapp |
| 6. กระทบ module ใด | Frontend: inspectnode/input/output/timing/permissiondenial; Backend ตามข้อ 5; dependencies J03 |
| 7. ความเสี่ยง | maskdataandsecrets; no otheractortracebydefault; writesdisabledindebugmode |
| 8. OSS ที่พิจารณา | L00 (ทะเบียนด้านบน); noinstall |
| 9. License/เชิงพาณิชย์ | ไม่มี dependency ใหม่; คง notices/pinversion; L00 ใช้ existingcode ไม่ใช่สิทธิ์แจกจ่ายที่พิสูจน์แล้ว |
| 10. ควรทำไหม | ควรทำเมื่อ pilot ยืนยัน usecase และ foundation พร้อม; ลดการไล่ log และปรับ config ผิดจุด; 10–18person-days, Core. Sourceideas S30,S34,S39, checked2026-10-29 |

### K03 Living App Documentation Generator

| คำถาม | คำตอบเฉพาะ repo |
|---|---|
| 1. ทำอะไร | สร้าง data dictionary/screens/actions/roles/dependencies จาก metadata |
| 2. ผู้ใช้ต้องการเพราะ | handover ระบบให้แผนกใหม่; ลด busfactor และทำ review ง่าย |
| 3. มีแล้วหรือไม่ | C18guide/C23diagram มี; appdocexport Missing |
| 4. ต่อยอดเดิมอย่างไร | deterministicAppSpec→Markdown/HTML; optionalAIexplanations แยก; existingmodules อ้าง Cxx ใน CurrentInventory |
| 5. ต้องสร้างอะไรใหม่ | read-onlyexport scopedmetadata; stableanchors/revisions; DB: MVP noDBchange; generationmanifest artifact |
| 6. กระทบ module ใด | Frontend: exportsections/preview/changecompares; Backend ตามข้อ 5; dependencies A03 |
| 7. ความเสี่ยง | no userlist/secret/examplePII; respectappaccess; AIopt-in only |
| 8. OSS ที่พิจารณา | L00 (ทะเบียนด้านบน); noinstall |
| 9. License/เชิงพาณิชย์ | ไม่มี dependency ใหม่; คง notices/pinversion; L00 ใช้ existingcode ไม่ใช่สิทธิ์แจกจ่ายที่พิสูจน์แล้ว |
| 10. ควรทำไหม | ควรพัฒนาตาม dependency order เพราะ ลด busfactor และทำ review ง่าย; 4–7person-days, Optional. Sourceideas S10,S34, checked2026-10-29 |

### L01 Internal Component / Action Registry

| คำถาม | คำตอบเฉพาะ repo |
|---|---|
| 1. ทำอะไร | รวม descriptor/validator/editor/runtime/capability ใน registration เดียว |
| 2. ผู้ใช้ต้องการเพราะ | เพิ่ม Kanban/fieldtype โดยไม่แก้ switch หลายแห่ง; ลด maintenance และเป็นฐาน privateextensions |
| 3. มีแล้วหรือไม่ | C12/C15/C25hardcodedregistries มี |
| 4. ต่อยอดเดิมอย่างไร | versionedtypedregistry builtintypeswrapped; notdynamiccodeinstaller; existingmodules อ้าง Cxx ใน CurrentInventory |
| 5. ต้องสร้างอะไรใหม่ | sharedregistrationvalidationanddependencygraph; backwardcompatadapter; DB: registryversionspinned ใน AppSpec; noinstalltableMVP |
| 6. กระทบ module ใด | Frontend: palette/propertyeditorfromdescriptor; lazyloadedbuiltinrenderer; Backend ตามข้อ 5; dependencies A01 |
| 7. ความเสี่ยง | registryisnotisolation; onlyreviewedbuiltinmodules; failclosedunknownkind |
| 8. OSS ที่พิจารณา | L01 (ทะเบียนด้านบน); noinstall |
| 9. License/เชิงพาณิชย์ | MIT; คง notices/pinversion; L00 ใช้ existingcode ไม่ใช่สิทธิ์แจกจ่ายที่พิสูจน์แล้ว |
| 10. ควรทำไหม | ควรพัฒนาตาม dependency order เพราะ ลด maintenance และเป็นฐาน privateextensions; 16–26person-days, Core. Sourceideas S15,S16,S40,S44, checked2026-10-29 |

### L02 Trusted Private Plugin SDK

| คำถาม | คำตอบเฉพาะ repo |
|---|---|
| 1. ทำอะไร | SDKmanifest/installapprove/pin/disable/uninstall สำหรับทีมพัฒนา |
| 2. ผู้ใช้ต้องการเพราะ | ทีมองค์กรเพิ่ม connector เฉพาะ; ขยายโดยไม่ forkcore ต่อ feature |
| 3. มีแล้วหรือไม่ | C43pluginlifecycle Missing |
| 4. ต่อยอดเดิมอย่างไร | manifest+capabilitygrants+integrity+hostbroker; declarativefirst; existingmodules อ้าง Cxx ใน CurrentInventory |
| 5. ต้องสร้างอะไรใหม่ | installstaging/contracttests/lifecycle/dependentsbeforeuninstall; DB: installed_extensions/versions/grants/lockmanifest |
| 6. กระทบ module ใด | Frontend: adminreviewpermissiondiff/rollback/health; Backend ตามข้อ 5; dependencies L01, A03, G02, J01 |
| 7. ความเสี่ยง | signedsource≠safe; nountrustedNodeinprocess; network/DBdeny; auditpluginpurpose |
| 8. OSS ที่พิจารณา | L01 (ทะเบียนด้านบน); noinstall |
| 9. License/เชิงพาณิชย์ | MIT; คง notices/pinversion; L00 ใช้ existingcode ไม่ใช่สิทธิ์แจกจ่ายที่พิสูจน์แล้ว |
| 10. ควรทำไหม | ยังไม่ควรทำตอนนี้ทั้งหมด; ทดลอง scope เล็กเมื่อ demand ชัด เพราะต้นทุน/ความเสี่ยงสูง; 30–50person-days, Plugin Infrastructure. Sourceideas S15,S32,S40,S44, checked2026-10-29 |

### L03 Private Package Catalog & Upgrade Planner

| คำถาม | คำตอบเฉพาะ repo |
|---|---|
| 1. ทำอะไร | internalcatalogtemplates/components/connectors พร้อม compatibility และ receipts |
| 2. ผู้ใช้ต้องการเพราะ | หลายทีมใช้มาตรฐานตรวจรถรุ่นเดียวกัน; reuse และ governance โดยไม่เปิด publicmarketplace |
| 3. มีแล้วหรือไม่ | C06clone/C38backup มี; marketplace Missing |
| 4. ต่อยอดเดิมอย่างไร | artifactcatalog+semverconstraints+lockresolver+licenseinventory; existingmodules อ้าง Cxx ใน CurrentInventory |
| 5. ต้องสร้างอะไรใหม่ | publishcatalogversion/dependencypreflight/rollback; DB: catalog_artifacts/dependencies/install_receipts |
| 6. กระทบ module ใด | Frontend: browse/licensebadge/versiondiff/upgradepreview; Backend ตามข้อ 5; dependencies A02, C01, L02 |
| 7. ความเสี่ยง | supplychain/licenseownership/untrustedassets; noautomaticprivilegeupgrade |
| 8. OSS ที่พิจารณา | L00 (ทะเบียนด้านบน); noinstall |
| 9. License/เชิงพาณิชย์ | ไม่มี dependency ใหม่; คง notices/pinversion; L00 ใช้ existingcode ไม่ใช่สิทธิ์แจกจ่ายที่พิสูจน์แล้ว |
| 10. ควรทำไหม | ยังไม่ควรทำตอนนี้ทั้งหมด; ทดลอง scope เล็กเมื่อ demand ชัด เพราะต้นทุน/ความเสี่ยงสูง; 18–30person-days, Optional. Sourceideas S10,S32,S44, checked2026-10-29 |
