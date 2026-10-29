# Competitor Research

ตรวจแหล่งทางการเมื่อ **2026-10-29 (Asia/Bangkok)**. ใช้ Official Docs, vendor release notes และ upstream GitHub license; ไม่ใช้ Reddit/review/marketing comparison ของคู่แข่งมายืนยัน feature. ไม่ได้สมัครบัญชีหรือทดสอบ products จริง จึงเป็น documentary research ไม่ใช่ hands-on usability/benchmark

## วิธีอ่านสถานะ

Documented=พบเอกสารใช้งานจริง ไม่เท่ากับยืนยัน GA ทุก region/plan. Alpha/Beta/Preview/Experimental แสดงเฉพาะที่ vendor ระบุ; ถ้าไม่ระบุใช้ Documented/Unknown availability. วันที่ตรวจ!=วันที่เผยแพร่. หน้าไม่แสดง update-date จะระบุไม่ทราบ ไม่ใช้ searchcrawl-date แทน

## ภาพรวม 10 แพลตฟอร์ม

| Platform | Focus | Features และหลักฐาน | แนวคิดนำมาใช้กับ repo | License / scope |
|---|---|---|---|---|
| Google AppSheet | schema-driven business apps/field work | Offline queue/sync + securityfilters [S01–02]; Gemini creation [S03]; AppsScript automation [S04] | นำแนวทาง offline profiles และ reusable app recipes; เรามีสูตร/Ref/Automation แล้ว | Hosted proprietary; paid AI/control availability ตาม plan; ไม่เอา engine มา embed |
| Microsoft Power Apps | enterprise data/connector/governance | Power Fx delegation [S06], connectors [S05], solutions + component libraries [S08,S10], generative pages [S09] | ยืม adapter capability/delegation และ environment solutions; ไม่แทน customformula ทั้งหมด | Proprietary platform; connector/Dataverse licensing แยก. Native mobileoffline != web/PWA [S07] |
| Retool | internal apps over governed resources | new AI-based app builder+manualcode [S11], classic drag/drop ยังอยู่ [S13]; use/edit/own roles [S12] | แยก resource permission จาก screen visibility; resource catalog ก่อน AIquery | Proprietary; permissions และ sourcecontrol ขึ้นกับ plan; ไม่อ้าง exactplan ทุก feature |
| Budibase | operations apps + database + automations | CouchDB/external datasources [S14], component/data/actionplugins [S15–16], workspaceAI [S17] | action plugin contract และ schema mapping; BYO-provider ไม่เท่ากับ freeEnterprise | GPLv3 overall, generated-app MPL packages และ BSL paidpackages [S18]; ไม่ copycode โดยไม่ตรวจแต่ละ package |
| Appsmith | query/JS-driven internal tools | SQL/REST/GraphQL [S20], widgets/custom-model events [S19,S22], Git [S21] | query resource and binding inspector; อย่าให้ user JS รันใน serverprocess | Root Apache2 [S24] ไม่ใช่อนุญาต paidfeatures; responsivewidget ใหม่ Alpha [S23] |
| FlutterFlow | visual Flutter app UI + exported project workflow | localSQLite [S27], desktop codingagent +CLI scopes [S25–26], AItoolsuite [S28] | typed widget tree, component contracts and targeted edits; เราส่ง Web/PWA จึงไม่ต้องย้าย Flutter | Commercial hostedbuilder; generated-code rights และ marketplaceassetlicense ต้องตรวจตามสัญญาที่ใช้ |
| Bubble | full-stack app + plugins + application workflows | AI app/planning and edits [S29–30], pluginpinning [S32], branches [S33], privacy distinction [S31] | versionedplugin dependency และ AI edit-plan review; field/privacy ต้องไม่ใช้แค่ UIhide | Proprietary platform, plugin แต่ละตัว license ต่างกัน; Experimental serverissuechecker [S30] |
| n8n | workflow orchestration and integrations | AIworkflowbuilder [S34], workerqueue [S35], human toolapproval [S36] | ต่อ wait/approval/idempotency ใน engine เดิม; external n8noptional ตาม licensing | SUL ไม่ใช่ OSIopen-source; ให้ customer แก้ workflow ผ่าน UI/API/AI ต้อง commercial [S37] |
| Directus | data/backend platform มากกว่า general screenbuilder | SQL modeling+REST/GraphQL+permission [S38], Flows [S39], API/app extensions [S40] | schema-first generatedcontracts, accountability and extensioncategories | Currentmainlicense MSCL-1.0-GPL [S41], ไม่ใช้ BSL/$5mrule เก่า; competing-use ต้อง review |
| ToolJet | internalapps + AI + connectors | visual/AI/PGDatabase/selfhostworkflows/environments [S42], accesscontrol [S43], manifest [S44] | component/query/actioncapabilities; connectorcatalog + envbinding | CommunityAGPL3 [S45]; paid/selfhostabilities ไม่เท่ากับ Communitysource ทั้งหมด |

## ความพร้อมใช้งานที่ต้องแยก

| Feature | Stage ที่ยืนยันได้ | ข้อจำกัด | Checked/source |
|---|---|---|---|
| AppSheet offline/Gemini | Documented | Gemini paid-account และ offline media/browser มีข้อจำกัด | 2026-10-29, S01/S03 |
| Power Apps generativepages | Documented; connectors/customAPIs บางส่วน Preview | model-driven app ไม่ใช่ทุก canvas; region authoring ข้อจำกัด | 2026-10-29, S09 |
| Appsmith responsivewidgets ชุดใหม่ | **Alpha** | อย่าเหมารวมว่า Appsmith ทั้งระบบ Alpha | 2026-10-29, S23 |
| Bubble server-side issuechecker | **Experimental** | ไม่เหมารวม AIgenerator เป็น Experimental | 2026-10-29, S30 (2026-09-09) |
| Bubble AI Agent | Documented; GA/Beta scope ไม่ยืนยันทุก account | oldindexedsnippet บอก beta/จำกัด generatedapps แต่ fresh manual เปลี่ยนแล้ว; ใช้ freshmanual+release และระบุ rolloutUnknown | 2026-10-29, S29/S30 |
| FlutterFlow agent/CLI; Retool newapps; BudibaseAI; n8nAI; ToolJetAI | Documented | plan/version/desktop/selfhost prerequisites ต่างกัน; ไม่มีหลักฐานว่าเปิดแก่ทุก account | 2026-10-29, S11/S17/S25/S26/S34/S42 |
| ฟีเจอร์ที่ vendor ไม่แสดง stage | Unknown GA status | ไม่เดาว่า GA หรือ Beta | ตาราง sources ด้านล่าง |

ไม่พบ Beta label ปัจจุบันที่ยืนยันได้ชัดจาก selected fresh pages สำหรับ feature อื่น จึงไม่บังคับจัดเป็น Beta/GA จาก search snippet เก่า. รายการที่ยืนยันได้ว่า Alpha/Preview/Experimental แยกไว้ด้านบน

## Design lessons (ข้อเสนอของเรา ไม่ใช่ข้ออ้างจาก vendor)

1. แยก data source/query/component/workflow เป็น contracts; maker ไม่ต้องเขียน code แต่ engine ต้องมี typedinterfaces
2. แสดงสิทธิ์ resource และ data projection ก่อนผูก UI/AI; ซ่อน widget ไม่ใช่ authorization
3. ประกอบแอปจาก metadata ที่ validate/version ได้ มากกว่าสร้าง arbitrarycode ด้วย AI
4. Keep SQLite เป็น baseline; query delegation/limits/observability ก่อนแยก service หรือย้าย DB
5. Pin plugin versions และตรวจ dependency ก่อน publish; permissions ไม่เพิ่มตาม plugin manifest อัตโนมัติ

## Coverage ตามหัวข้อที่ร้องขอ

| Dimension | หลักฐานเปรียบเทียบ | Our mapping / analysis |
|---|---|---|
| Visual builder / dynamic components | S11,S19,S22,S25,S42 | C12,C15,C16 → registry/reusablecomponents |
| Database/data source/data relationships | S05,S14,S20,S27,S38,S42 | C03,C23,C30 → adapters/constraints |
| Data binding/formula/expression | S06,S19,S22 | C17–20 → delegation, assistant, inspector |
| Workflow/webhook/events | S04,S13,S16,S34–36,S39 | C25–27 → branching/approval/outbox |
| RBAC/rowsecurity/governance | S02,S12,S31,S38,S43 | C07–11 → effective-rights/fieldpolicy |
| REST/GraphQL | S05,S20,S38,S42 | C30–31 → RESTfirst; GraphQLlater |
| Plugins/extensions | S15–16,S22,S32,S40,S44 | C43 → private trusted registryfirst |
| Templates | S14 sampledata; S28 generation | C06 clone!=portabletemplate; A02 |
| Multi-tenant architecture | docsdescribeworkspace/resourcecontrols ไม่เปิดเผย tenantinternals ครบ | C05 ismultiapp; ไม่เทียบ physicalisolation จาก marketing |
| AIgeneration/assistance | S03,S09,S11,S17,S25–30,S34,S42 | C44 Missing → H01/H02/H03 |
| Testing/debugging | S28,S30,S34 | C41–42 มีแล้ว → K01/K02 maker-facing |
| Offline | S01,S07,S27 | C33–34 Partialfulloffline → I03 |
| Version/deployment/collaboration | S08,S10–11,S21,S26,S33,S42 | C35–37,C45 → J01; CRDTlater |
| Monitoring/audit/enterprise | S02,S08,S12,S38,S42–43 | C39–40 → durabletrace/SLOexport |

## Source register

ทุกแหล่งต่อไปนี้ตรวจ 2026-10-29. GitHubbranch เป็น mutable ไม่ใช่ license ยืนยันของ futureversion; ก่อน adopt ต้อง pinversion/commit และตรวจ license อีกครั้ง. หลายหน้าไม่แสดง publicationdate จึงระบุ Unknown ตามจริง

| ID | Platform / page | สิ่งที่ใช้ยืนยัน | Stage | Publish/update date ที่เห็น | URL |
|---|---|---|---|---|---|
| S01 | AppSheet: Offline/Sync | offline queue/sync และ browser/media ข้อจำกัด | Documented | ไม่แสดงวันที่อัปเดต | [Official](https://support.google.com/appsheet/answer/10107724?hl=en) |
| S02 | AppSheet: Security essentials | sign-in/app/data access/security filters; ไม่ใช่ DB-nativeRLS | Documented | ไม่แสดงวันที่อัปเดต | [Official](https://support.google.com/appsheet/answer/10105078?hl=en) |
| S03 | AppSheet: Gemini creation governance | Gemini app creation + team restrictions; paid-account availability | Documented / paid | ไม่แสดงวันที่อัปเดต | [Official](https://support.google.com/appsheet/answer/11918568?hl=en-GB) |
| S04 | AppSheet: Apps Script automation | call script จาก bot; head deployment ข้อจำกัด | Documented | ไม่แสดงวันที่อัปเดต | [Official](https://support.google.com/appsheet/answer/11997142?hl=en) |
| S05 | Power Apps: Connectors | tabular/action/custom connector contracts | Documented | ไม่ยืนยันวันที่อัปเดต | [Official](https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/connections-list) |
| S06 | Power Apps: Power Fx business logic | formula delegation และ cloud flows | Documented | หน้าแสดง 2024-10-22 | [Official](https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/app-business-logic) |
| S07 | Power Apps: Offline | native mobile offline; browser canvas ไม่รองรับ | Documented / runtime-specific | ไม่ยืนยันวันที่อัปเดต | [Official](https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/offline-apps) |
| S08 | Power Apps: ALM solutions | governance/solutions/lifecycle | Documented; บาง navigation แจ้ง auth แต่เนื้อหา overview อ่านได้ | ไม่ยืนยันวันที่อัปเดต | [Official](https://learn.microsoft.com/en-us/power-platform/alm/overview-alm) |
| S09 | Power Apps: Generative pages | AI pages สำหรับ model-driven; connectors/custom API ส่วนหนึ่ง preview | Mixed: Documented + Preview integrations | ไม่ยืนยันวันที่อัปเดต | [Official](https://learn.microsoft.com/en-us/power-apps/maker/model-driven-apps/generative-pages) |
| S10 | Power Apps: Component library ALM | reusable components/versioned dependencies ผ่าน solutions | Documented | ไม่ยืนยันวันที่อัปเดต | [Official](https://learn.microsoft.com/power-apps/maker/canvas-apps/component-library-alm) |
| S11 | Retool: Apps concepts | new AI-assisted apps, resource governance, manual code, source control | Documented; Enterprise source-control ข้อจำกัด | ไม่แสดงวันที่อัปเดต | [Official](https://docs.retool.com/build/apps/concepts/intro) |
| S12 | Retool: Permissions | use/edit/own, groups, organization/object roles; plan-gated | Documented / plan-dependent | ไม่แสดงวันที่อัปเดต | [Official](https://docs.retool.com/permissions/quickstart) |
| S13 | Retool: Workflows | separate backend workflow and query/resource concepts; classic editor ยังมี | Documented | ไม่แสดงวันที่อัปเดต | [Official](https://docs.retool.com/workflows) |
| S14 | Budibase: Datasources | internal CouchDB และ external schema mapping/custom sources | Documented | ไม่แสดงวันที่อัปเดต | [Official](https://docs.budibase.com/docs/data-sources) |
| S15 | Budibase: Plugins | component/datasource extension import | Documented / permissions and plan ต้องตรวจ | ไม่แสดงวันที่อัปเดต | [Official](https://docs.budibase.com/docs/custom-plugin) |
| S16 | Budibase: Automation plugins | action-focused custom step; self-host only ตามหน้า | Documented / self-host | ไม่แสดงวันที่อัปเดต | [Official](https://docs.budibase.com/docs/custom-automations) |
| S17 | Budibase: AI | workspace providers, table schema/JS/automation AI; self-hostEnterprise | Documented / plan-dependent | ไม่แสดงวันที่อัปเดต | [Official](https://docs.budibase.com/docs/quickstart-budibase-ai) |
| S18 | Budibase: License | package-specific GPLv3/MPL2/BSL | License text | ไม่แสดง release date | [Official](https://raw.githubusercontent.com/Budibase/budibase/master/LICENSE) |
| S19 | Appsmith: Introduction | visual widgets/query/JS/Git | Documented | ไม่แสดงวันที่อัปเดต | [Official](https://docs.appsmith.com/) |
| S20 | Appsmith: Datasources | REST/GraphQL/SQL/S3/SMTP | Documented | ไม่แสดงวันที่อัปเดต | [Official](https://docs.appsmith.com/connect-data/reference) |
| S21 | Appsmith: Git | branches/commit/push and versioned development | Documented | ไม่แสดงวันที่อัปเดต | [Official](https://docs.appsmith.com/advanced-concepts/version-control-with-git) |
| S22 | Appsmith: Custom widgets | custom widget model and event boundary | Documented | ไม่แสดงวันที่อัปเดต | [Official](https://github.com/appsmithorg/appsmith-docs/blob/main/website/docs/reference/widgets/custom.md) |
| S23 | Appsmith: Responsive widgets | new responsive widgets explicitly ALPHA | Alpha | ไม่แสดงวันที่อัปเดต | [Official](https://docs.appsmith.com/reference/responsive-widgets) |
| S24 | Appsmith: License | Apache2 root license;ไม่ครอบคลุม paid contract ทั้งหมด | License text | ไม่แสดง release date | [Official](https://raw.githubusercontent.com/appsmithorg/appsmith/release/LICENSE) |
| S25 | FlutterFlow: AI Agent | desktop external coding agents edit pages/actions/state/theme | Documented / desktop prerequisite | ไม่แสดงวันที่อัปเดต | [Official](https://docs.flutterflow.io/concepts/ai-agent/) |
| S26 | FlutterFlow: CLI build | structured agent editing and library publishing; paid branching | Documented / plan-dependent | ไม่แสดงวันที่อัปเดต | [Official](https://docs.flutterflow.io/flutterflow-cli/build/) |
| S27 | FlutterFlow: SQLite query | local database query binding;ไม่ใช่อัตโนมัติ offline conflict sync | Documented | ไม่แสดงวันที่อัปเดต | [Official](https://docs.flutterflow.io/resources/backend-query/sqlite-query/) |
| S28 | FlutterFlow: AI suite | Designer/agent/MCP/Test Pilot product offerings | Product documented; stage แต่ละตัวต้องตรวจ account | ไม่แสดงวันที่อัปเดต | [Official](https://www.flutterflow.io/ai) |
| S29 | Bubble: AI agent current manual | in-editor context-aware assistant; fresh fetchedpage ต่างจาก old searchcache | Documented; ไม่อนุมาน GA | ไม่แสดงวันที่อัปเดต | [Official](https://manual.bubble.io/help-guides/ai/bubble-ai-agent) |
| S30 | Bubble: Release notes | app planning, schema/workflow/API edits; issue-checker experimental | Mixed: shipped notes + Experimental checker | รายการล่าสุดที่อ่าน 2026-09-09; มีรายการ 2026-07-29 | [Official](https://bubble.io/release-notes) |
| S31 | Bubble: Workflow privacy | data access privacy != workflow execution authorization | Documented | ไม่แสดงวันที่อัปเดต | [Official](https://manual.bubble.io/help-guides/integrations/api/the-bubble-api/the-workflow-api/workflow-api-privacy-rules) |
| S32 | Bubble: Plugin versions | pin/upgrade/test plugin version beforelive | Documented | ไม่แสดงวันที่อัปเดต | [Official](https://manual.bubble.io/core-resources/bubbles-interface/plugins-tab) |
| S33 | Bubble: Version control | main/dev/live/savepoints; custom branchespaidtiers | Documented / plan-dependent | ไม่แสดงวันที่อัปเดต | [Official](https://manual.bubble.io/help-guides/maintaining-an-application/version-control) |
| S34 | n8n: AI Workflow Builder | generate/refine/debug nodeflows;credits/availabilitypricing | Documented / plan-dependent | ไม่แสดงวันที่อัปเดต | [Official](https://docs.n8n.io/build/ways-of-building-workflows/ai-workflow-builder.md) |
| S35 | n8n: Queue mode | DB job record + Redis dispatch + workers; multi-mainEnterprise | Documented / deployment-dependent | ไม่แสดงวันที่อัปเดต | [Official](https://github.com/n8n-io/n8n-docs/blob/main/docs/deploy/host-n8n/configure-n8n/scaling/enable-queue-mode.md) |
| S36 | n8n: Human tool approval | human approval for agent tool execution | Documented | ไม่แสดงวันที่อัปเดต | [Official](https://docs.n8n.io/build/integrate-ai/ai-examples/human-in-the-loop-for-tools.md) |
| S37 | n8n: License FAQ | SUL internal use vs external-customer configuration requirescommercial | License FAQ | Updated 2026-10-06 | [Official](https://support.n8n.io/article/can-i-use-your-license-for-my-use-case) |
| S38 | Directus: Overview | SQL data modeling / REST / GraphQL / permissions / MCP | Documented | ไม่แสดงวันที่อัปเดต | [Official](https://directus.com/docs/) |
| S39 | Directus: Flows | event operations/data chain/accountability | Documented | ไม่แสดงวันที่อัปเดต | [Official](https://directus.com/docs/guides/flows/) |
| S40 | Directus: Extensions | app/API extension categories/lifecycle ecosystem | Documented | ไม่แสดงวันที่อัปเดต | [Official](https://directus.com/docs/guides/extensions/overview) |
| S41 | Directus: Current license | MSCL-1.0-GPL competing-use/license-key restrictions; futureGPL4years | License text | Copyright2026; version-release date ไม่ยืนยัน | [Official](https://raw.githubusercontent.com/directus/directus/main/directus/license) |
| S42 | ToolJet: Platform overview | AI/visual builder, sources, PG DB, workflows, environment | Documented / self-host and paid capabilitiesvary | ไม่แสดงวันที่อัปเดต | [Official](https://docs.tooljet.ai/docs/getting-started/platform-overview/) |
| S43 | ToolJet: Access control | granular app/datasource/module access | Documented / plan-dependent | ไม่แสดงวันที่อัปเดต | [Official](https://docs.tooljet.ai/docs/user-management/role-based-access/access-control/) |
| S44 | ToolJet: Plugin manifest | schema-based plugin manifest/query extension | Documented | ไม่แสดงวันที่อัปเดต | [Official](https://docs.tooljet.com/docs/contributing-guide/marketplace/creating-a-plugin/) |
| S45 | ToolJet: License | Community AGPL3; paidfeatures ต่างสัญญา | License text | ไม่แสดง release date | [Official](https://raw.githubusercontent.com/ToolJet/ToolJet/develop/LICENSE) |

## Licensing conclusion

แนะนำ reuse แนวคิด/extensioncontracts ไม่ดึง sourceengine ของคู่แข่งมารวมโดยอัตโนมัติ. MIT/Apache ยังต้องคง notice; GPL/AGPL มีเงื่อนไข copyleft ที่ต้องประเมินรูปแบบรวม/แจกจ่าย/networkuse; source-available MSCL/SUL/BSL ไม่ใช่อนุญาตทำบริการแข่งขันได้อิสระ. ข้อสรุปนี้เป็น technicalprocurementscreening ต้อง review สัญญาจริงก่อนจัดซื้อ/embed
