# AI-native App Builder: โอกาสและขอบเขตปลอดภัย

ตรวจเอกสารทางการ 2026-10-29. สถานะ repo: **ยังไม่พบ LLMprovider/API/config หรือ AIgeneration**; ExpressionAssistant เป็น examples/tester/autocomplete ดู C18/C19/C44 ใน [Current](CURRENT_SYSTEM_CAPABILITIES.md). ไม่ได้เรียก AIAPI หรือส่ง schema/ข้อมูลจริงออกไปในงานวิจัยนี้

## แนวทางที่เหมาะกับ repo

เริ่มจาก **H01 AI Formula Assistant** เพราะมี boundedparser/refs/validators/tester อยู่แล้ว จึงตรวจ output ได้ก่อนผู้ใช้ใส่สูตร. ต่อ H02schema-plans แล้ว H03incrementalpages/app/workflows. ไม่เริ่มจาก agent ที่เขียน JavaScript/SQL หรือแก้ production เอง

Pipeline ที่เสนอ: authorized metadata selection → redaction + context budget → ProviderAdapter → typed Proposal → schema/reference/type/permission/budget validation → isolated preview/simulation/tests → human review of exact diff/hash → draft save → existing publish gate. ถ้า validationfail ให้ repair ได้ไม่เกิน 2 ครั้ง จากนั้นส่ง error กลับ ไม่วนจนได้ output ที่ดูผ่าน

## ความเป็นไปได้ 10 กรณี

| AI capability | Current / reusable parts | Proposed implementation / MVP | Validation, scope / acceptance | Incremental effort and order |
|---|---|---|---|---|
| 1.Text-to-App | C04/C15/C36metadata/designer/draft | H03 สร้าง AppSpecpatch จาก approvedrecipe; ไม่สร้าง rawcode | <=5tables/20nodes, noauthpolicy changes; diff ทุก object; 10goldenbriefs ผ่าน schema/tests | H03 30–50pd หลัง H02/C01/versionedIR; ไม่บวกซ้ำกับ UI/workflowrow |
| 2.AI Database Schema | C03/C23schema/EReditor | H02newtable/Ref/constraintplan แบบ noSQL | existingtabledefaultreadonly; ambiguouscardinality ถาม; FK/unique/depcheck + isolatedapply | H02 18–28pd; หลัง A01/A03/H01 |
| 3.AI UI Layout | C15fixed11nodes/customschema | subsetH03registerednodes+tokens; เปลี่ยนเฉพาะ selectedsubtree | bound100nodes/8levels เดิม, noarbitraryCSS/HTMLJS, previewmobile+desktop, a11ygates | prototype8–12pd ภายใน H03 ไม่บวกแยก |
| 4.AI Formula Assistant | C18/C19parser/autocomplete/evaluator | H01FormulaProposal{formula,explanation,examples} | parse/type/refs + semanticgoldencases; refusals/truncationhandled; user กด Insert เอง | H01 12–20pd; AIfirstpilot |
| 5.AI Workflow Generator | C26/C41configvalidator/simulation | H03emitworkflowIR จาก registeredstep; linearv1 ก่อน branchv2 | noactivewebhook/PDFsend; mockallsideeffects; watchedcolumns/loopsvalidated | 8–14pd ใน H03; E01contractready ก่อน fullbranch |
| 6.AI Error Detection | C40/C41readiness/errors | deterministicissues ก่อน; LLM จัดกลุ่ม/อธิบาย trace ที่ redact แล้ว | ไม่บอกว่ามี bug ถ้าไม่มี evidence; exactsourcepointer; distinguishhypothesis | 5–8pd ต่อยอด K02/H01; optional ไม่รวม K02baseline |
| 7.AI Auto-repair Suggestions | releasebaselinehash+validators | generatepatchproposal เท่านั้น ไม่มี autoexecute | reproduciblefailure ก่อน/aftercase; stalepatch409; permissiondestructivechangesblocked; manualreview | 8–14pd หลัง K01/J01; outsideyear1commitment |
| 8.AI Query Builder | C18/B01AST; G01resources | NL→boundedQueryPlan ไม่ rawSQL; resourcecatalogauthorized | plancompilerpermissionbeforecount/paging; scannedbudget; unsupportedqueryreject | 8–14pd หลัง B01/G01; liveexecution ต้อง explicit |
| 9.AI Documentation | C18guides/C23ER/K03deterministicexport | K03 ฐานเอกสารแน่นอนก่อน; AI อธิบาย businessintent พร้อม cites | schemafacts ต้องตรง; labelhallucination; outputnoPII/secrets | deterministicK03 4–7pd; AItextoption เพิ่ม 3–5pd หลัง H01 |
| 10.AI Test Case Generator | C41simulation/C42isolatedrunner | สร้าง K01Given/When/Then proposals+syntheticdata | independentlyreviewexpectedresults; faultinjection ทดสอบจับ bug; nochangingexpectedtohidefailure | 6–10pd หลัง K01; generate≠proofcorrect |

Effort เป็นประมาณของทีมที่รู้ repo; ชิ้นที่ระบุอยู่ภายใน H03 ไม่บวกรวมซ้ำ. Golden success targets เป็น acceptance ที่เสนอ ยังไม่มี benchmarkmodel ใน repo นี้

## Provider options และ cost snapshot

เลือกผ่าน adapter ที่คืน standardproposal ไม่ผูก AppSpec เข้ากับ providerSDK. เริ่ม oneprovider แล้ว benchmark ก่อนเพิ่ม fallback; fallback ข้าม vendor ต้องได้รับสิทธิ์ dataresidency ไม่ใช่ส่งทุก request หลายเจ้า

| Provider / candidate (ไม่ใช่ข้อสรุปว่าคุณภาพดีที่สุด) | Standard text input/output USD per1M tokens | 8k input +2k output / request | 1,000requests | Official checked source |
|---|---:|---:|---:|---|
| OpenAI gpt-6-luna | 0.10 /0.50 |0.0018|1.80|[Pricing](https://developers.openai.com/api/docs/pricing), 2026-10-29 |
| OpenAI gpt-6.1-sol |2.00 /10.00|0.036|36.00|[Pricing](https://developers.openai.com/api/docs/pricing), 2026-10-29 |
| Anthropic Claude Sonnet5.5 |2.00 /10.00|0.036|36.00|[Claude pricing](https://platform.claude.com/docs/en/about-claude/pricing), 2026-10-29 |
| Google Gemini3.5 Flash-Lite |0.30 /2.50|0.0074|7.40|[Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing), 2026-10-29 |
| Local inference viaOllama |ไม่มีค่าต่อ token ที่จ่าย provider ใน localdeployment; มี GPU/RAM/ops และ modellicense |ยังประมาณไม่ได้ถ้าไม่รู้ hardware/model|Not measured|[Structured outputs](https://docs.ollama.com/capabilities/structured-outputs), 2026-10-29 |

สูตร cost=(inputtokens×inputrate +outputtokens×outputrate)/1M. ตัวอย่างเป็น short-contextstandardtext, ไม่รวม cachediscount/reasoning เพิ่ม/repairloops/toolcalls/search/storage/tax/FX. ถ้า retry เฉลี่ย 30%ให้คูณ 1.3: candidateSOL/Sonnet เป็น 46.80USD/1000requests; ยังไม่ใช่ monthlybill ของระบบ. ต้องนับ actualusage รวม reasoning/tool/schema tokens ตาม provider และ hardcap ต่อ app/user. อัตรา/availability เปลี่ยนได้จึง recheck ก่อนซื้อ ไม่มี APIkey หรือ livebillingtest ในรอบนี้

[OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs) รองรับ JSONSchema ส่วนหนึ่ง ช่วยเรื่อง format แต่ไม่รับประกันความถูกต้องทางธุรกิจ จึงต้องรัน validators เดิมเสมอ. LocalOllamadocs แยก localstructuredoutput จาก cloud ที่ยังไม่รองรับตามหน้าที่อ่าน; modelweightslicense ต้องตรวจแยกจาก serverlicense

## Privacy และ dataaccess

| Option | ข้อเท็จจริงจากเอกสาร | Our policy ที่เสนอ |
|---|---|---|
| OpenAI API | APItraining/retention เป็นคนละเรื่อง; abusemonitoring อาจเก็บ 30 วันและ applicationstate ขึ้นกับ endpoint/options; ZDR ต้อง eligible | foregroundstatelessrequest, store=false เมื่อรองรับ, nosensitivevalues, verifyaccountretention ก่อน production. [Data controls](https://developers.openai.com/api/docs/guides/your-data), checked2026-10-29 |
| Anthropic commercial API | standardinputs/outputretention ภายใน 30 วันมีข้อยกเว้น/agreements/files | metadataonlydefault; DPA/residency/accountconfiguration ต้อง review. [Retention](https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data), updated2026-07-01, checked2026-10-29 |
| Gemini | paid/free/contributortier มี datapractice ต่างกัน; paidservices โดยทั่วไปไม่ใช้ prompt/response ปรับปรุง products แต่ termexceptions/region ต้องตรวจ | ห้ามส่งข้อมูลธุรกิจผ่าน free/contributortier โดยถือว่าเหมือน paid;เลือก approvedpaidconfiguration. [Terms](https://ai.google.dev/gemini-api/terms?hl=en), [Pricing](https://ai.google.dev/gemini-api/docs/pricing), checked2026-10-29 |
| Local |ไม่ต้องส่ง prompt ให้ externalAPI ถ้าปิด egress จริง แต่ไม่ใช่ automaticprivacyguarantee|privatenetwork/auth/logretention/telemetry/modellicense/GPUisolation ต้องกำหนด; benchmarkThaifidelity ก่อนเลือก |

Defaultcontext: allowedtable/columnnames/types/relationships, availablefunctions, componentdescriptors และ syntheticexamples. ตัด roles/useridentities/secrets/rowvalues/media ออก; schema เองอาจ sensitive จึงต้อง opt-in ต่อ app. ถ้า futurefeature จำเป็นใช้ rowdata ต้อง explicitpermission+purpose+projection และ limit ไม่ยก Ownercredential ให้ AI

## Threat model / execution safety

| Threat | Concrete control | Proposed adversarial test |
|---|---|---|
| Promptinjection ผ่าน label/docs/rows | treatallcontextasdata; structuredproposal; allowlistedtools and schemas; nofree-formexecute | maliciouscolumnlabel ขอ exportsecrets ต้องถูกปฏิเสธและไม่มี toolcall |
| Cross-appretrieval | deriveapp+actorserver-side, authorizedschemaprojection, cachekey app/actor/accessRevision/workspace | schemaappB ไม่เข้า response/cache ของ appA |
| GeneratedJS/SQL/plugins | onlytypedAppSpec/QueryPlan; validatorrejectunknownkeys/kinds; noeval/vm-as-security | outputdropSQL, scriptURL, unknownplugin ถูก reject |
| Excessagency | provider ไม่มี write/publish/delete/installpermission; proposals boundbasehash | humanapprovalrequired; staleproposal409; noautopublish evenuserpromptasks |
| ExternalURL/credentialexfiltration | egressallowlist/DNS/redirectcontrols; secretbrokerneverreturnsrawsecrettoAI | toolURL ไป metadata/privateIP/redirect ต้อง blocked |
| Costs/DoS | inputbytes/tokens, maxoutput, timeout, concurrencybudget, retry<=2, appspendcaps | longprompt/toolloop/canceldoesnotleaveunboundedjob |
| UntrustedgeneratedUI | registeredcomponents only; noarbitraryHTML; safeimageURL; CSP | hiddenlink/script injection ไม่มีการรัน; componentcountbound |
| Approvalconfusion | showobjectdiff/risk/newpermissions; hashbindapprovaltoexactpatch | patch เปลี่ยนหลัง approve ต้อง review ใหม่ |

Promptfilter อย่างเดียวแก้ promptinjection ไม่ครบ ตาม [OWASP LLM01](https://genai.owasp.org/llmrisk/llm01-prompt-injection/) checked2026-10-29; controls หลักต้องอยู่ที่ toolpermissions/validation/network/dataflow

## Evaluation / rollout / rollback

1. เก็บ 50 โจทย์ภาษาไทยแบบ schema-only: formulas20, layouts10, schema10, workflow10; semanticexpectedresultsreview โดยคนอิสระ; มี negative/securitycases อีก 20 ข้อ
2. Compareproviders ด้วย samebudget/schema/context; วัด semanticpass, invalidref, PIIleakcanaries, latencyP50/P95, correctiontime และ cost/successfulproposal. ไม่เลือกจากราคา token เพียงอย่างเดียว
3. Closedpilot3makers, featureflagperapp, noautomaticapply. Formula first; require>=80%semanticpass และ 0unauthorizedtool/dataevent ในชุดที่กำหนด ไม่อ้าง 0risk ทั่วไป
4. Humanreview จาก diff+preview+tests; publish ต้อง approvedworkflow เดิม ไม่ใช้ modelverdict ว่า passed เป็น gate เดียว
5. Rollback ปิด AIfeatureflag/disableprovider และ discarddraftpatch. Configurationrollback ผ่าน releases; การย้อนข้อมูลธุรกิจ/DDL ไม่รับประกัน ต้อง migration/backupplan แยก

AUD-002/AUD-003 ที่พักยังเป็น riskgate ก่อนขยาย externalaccess/productionlaunch. แผน AI ไม่ใช่ขอเปิดการแก้ไขสองข้อนั้นกลับมา
