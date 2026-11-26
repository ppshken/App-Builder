# Provider ความปลอดภัย สมรรถนะ และการประเมิน

## Provider Strategy และต้นทุน

ตรวจแหล่งข้อมูลทางการ 26 พฤศจิกายน 2569 ตัวเลขต่อหนึ่งล้านโทเคนข้อความ USD เป็นตัวอย่างรุ่นที่ตรวจได้ ใช้ราคาและ availability ที่ยืนยันล่าสุดอีกครั้งตอนจัดซื้อ ไม่ถือว่าเป็นรุ่นที่เร็วหรือแม่นสุด

| ทางเลือก | สิ่งที่ยืนยันได้ / ความพร้อม | Input / Output | การเลือกใช้ |
|---|---|---:|---|
| OpenAI GPT‑5.4 mini | 400k context, Structured Outputs, tool calling และ streaming; repository มี Chat Completions adapter | $0.75 / $4.50 | รุ่นเปรียบเทียบสำหรับแผนและสูตร ตรวจ privacy ของ endpoint และสถานะ model ก่อนใช้ [Model](https://developers.openai.com/api/docs/models/gpt-5.4-mini) · [Data controls](https://developers.openai.com/api/docs/guides/your-data) |
| Google Gemini 2.5 Flash | ราคาแบบ standard จากเอกสาร มี Structured Outputs และเส้นทาง OpenAI-compatible ที่ repo ใช้; ตรวจ schema subset และ quota ต่อรุ่น | $0.30 / $2.50 | ทดลอง pilot บนรุ่นที่บัญชีเปิดใช้และผ่าน fixture ไทย ข้อมูลจริงใช้เฉพาะเงื่อนไขการประมวลผลที่อนุมัติ [Pricing](https://ai.google.dev/gemini-api/docs/pricing.md) · [Structured outputs](https://ai.google.dev/gemini-api/docs/structured-output) · [Compatibility](https://ai.google.dev/gemini-api/docs/openai) · [Terms](https://ai.google.dev/gemini-api/terms) |
| Anthropic Claude Sonnet 4.6 | Messages API / structured outputs / tool use, limit ตามองค์กรและ tier, ต้องเพิ่ม adapter และตรวจสถานะรุ่น | $3 / $15 | benchmark งานหลายขั้นเมื่อ bottleneck เป็น reasoning [Pricing](https://platform.claude.com/docs/en/about-claude/pricing) · [Structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) · [Rate limits](https://platform.claude.com/docs/en/api/rate-limits) |
| OpenAI-compatible / self-hosted เช่น vLLM | โปรโตคอลคล้ายกันแต่ schema, tool parser, context และความเร็วขึ้นกับ model/serving; ต้องรักษาเครื่องและ model license | คิด GPU/เครื่อง/ทีมและปริมาณจริง | ใช้เมื่อมีข้อกำหนดควบคุมข้อมูลหรือความคุ้มค่า ตรวจ TLS, egress, update และ HA [vLLM structured outputs](https://docs.vllm.ai/en/v0.20.2/examples/online_serving/structured_outputs/) |

Thai accuracy, end-to-end latency และ reliability ยังไม่มีการวัดในชุดโจทย์นี้ ทุก Provider ต้องผ่านชุดเดียวกัน รวมการ spell ชื่อในระบบ ผล Ref, ความแม่นยำของ JSON และความชัดเจนภาษาไทย Context window ไม่ได้หมายถึงงบที่ควรส่ง ให้ทดสอบโควตา, timeout, truncation/refusal และ privacy จริงตามรุ่น/endpoint เช่น store=false เป็นพารามิเตอร์ของ API การเก็บประเภทอื่นขึ้นกับเงื่อนไข Provider. Self-hosted ตรวจ license ของ weights แยกจาก serving software

Adapter กลางรับ task, model key, DTO, schema, abort signal และ budget คืน typed result, usage และ error code ใช้ deterministic routing สำหรับ intent ที่ชัด, รุ่นประหยัดสำหรับ Ask/สรุป/สูตรง่าย, รุ่นที่ผ่าน eval งาน reasoning สำหรับ blueprint หรือ cross-module plan Executor และการตรวจไม่ต้องใช้โมเดล Fallback ได้เฉพาะ provider ที่แอปอนุญาตและหลังตรวจ failure ที่ retry ได้ เช่น 429/503 โดยนับโควตาซ้ำ เลือก endpoint จาก config ฝั่ง server พร้อม allowlist

**ตัวอย่างงบ** 1,000 คำขอ × 5,000 input และ 1,000 output = 5M/1M โทเคน Gemini $4.00, OpenAI $8.25, Anthropic $30.00 เผื่อ retry/eval 10% เป็น $4.40, $9.08 และ $33.00 ใช้กรอบวางงบ pilot $10–33 ต่อ 1,000 คำขอโดยประมาณ เฉพาะ inference ไม่รวม VAT/FX/cache/storage และค่าแรง ค่าใช้จ่ายจริงต่อ task = ค่าใช้จ่ายรวมของ cohort / จำนวนงานสำเร็จและตรวจแล้ว ตั้งเพดาน pilot รายเดือนและปิดเมื่อถึงงบโดยให้ admin เป็นผู้กำหนดตัวเลขและการแจ้งเตือน

## Threat Model และ Risk Matrix

ทรัพย์สินคือ metadata/แถว, credentials, app/workspace, approval/receipt และ provider budget ขอบเขตคือ browser → signed-in server → scoped DB และ server → provider/worker ผู้โจมตีที่พิจารณาได้แก่ผู้ใช้ไม่มีสิทธิ์ ผู้พัฒนาที่มีสิทธิ์จำกัด ข้อความใน metadata และ response ภายนอก ระดับใช้ โอกาส/ผลกระทบ

| ความเสี่ยง | ระดับก่อนแก้ | มาตรการและหลักฐานที่ต้องเห็น | ความเสี่ยงคงเหลือ |
|---|---|---|---|
| Prompt injection จาก label/log/ประวัติ | สูง/สูง | ใส่เป็น data, DTO allowlist, ปิด arbitrary tools, validator ฝั่ง server, fixture injection แบบสังเคราะห์ | โมเดลอธิบายผิดได้ ต้อง feedback และตรวจผล |
| ข้าม app / ACL / workspace | กลาง/วิกฤต | resolve actor ฝั่ง server, ตรวจ ACL ก่อน read/cache/apply/rollback, namespace รวม scope | ต้องทดสอบ shared tables และ revoke กลางงาน |
| ส่งข้อมูลจริงหรือ secret ออก | กลาง/สูง | context minimization, no row/attachment/raw log, outbound policy, redact ก่อน telemetry, provider purpose review | ข้อความผู้ใช้และสูตรอาจบรรจุค่าจริง ต้องมี scanner และเกณฑ์ fallback |
| Approval replay / stale plan | กลาง/สูง | digest ผูก actor/scope/revision/expiry, CSRF, unique receipt, recheck ใต้ lock | stale หลายครั้งเมื่อแก้พร้อมกัน แสดงวิธีสร้าง diff ใหม่ |
| โครงสร้างเสีย / ข้อมูลหาย / side effect | กลาง/วิกฤต | validator/transaction, draft only, ปิด external actions, rollback/inverse เมื่อ schema รองรับ, rehearsal แยก | งานข้ามฐานต้องออกแบบ recovery แยก |
| DoS, loop, quota, token | สูง/สูง | max 4 read-tool calls/turn, 12k input/4k output, timeout 25 วินาที, 1 apply ต่อ workspace, queue/cancel/quotas | ต้องวัดและปรับเมื่อ deploy หลาย process |
| อ่าน log เกินสิทธิ์หรือเก็บเกินอายุ | กลาง/สูง | audit role, TTL, deletion job, จำกัดผู้ดูแผน, เก็บ code/metrics แทน prompt | ยืนยัน retention ตาม Provider contract |

## สมรรถนะและ Production Readiness

Baseline ที่ต้องเก็บก่อนเปิด feature flag ใช้ fixture 20/100/300 ตาราง และแถว 0/30k/300k ตามโจทย์ แยก Context/Provider/Dry-run/DB write/Runtime อ่านยอด p50/p95, query count, rows read, RSS, write lock, error และ token ใน warm/cold แยกชุด AI 1/4/10 ผู้ใช้พร้อมกัน วัด Runtime ชุดเดิมเทียบเปิด/ปิด AI เป้าหมาย pilot คือ context p95 ≤ 300 ms ที่ 100 ตาราง, provider-inclusive Ask p95 ≤ 12 วินาที, Plan ≤ 25 วินาที, Runtime p95 ช้าลง ≤ 5% และ error เพิ่ม ≤ 0.5 จุดเปอร์เซ็นต์ ตรวจค่าด้วย hardware เดียวกันและ 100 ตัวอย่างต่อ workload

ใช้ projection และ short-lived cache, dedup ขอ read-only ภายใต้ scope เดียวกัน, ไม่ cache secret, cancel เมื่อปิดหรือสลับ workspace, แยกงานซ้อมใหญ่ไว้ worker และป้องกัน SQLite writer contention ด้วยคิวต่อ workspace เริ่มด้วย hard limit 20 operations ต่อแผนตัวอย่าง เมื่อใช้หลาย process ย้าย quota ไป shared store ตาม baseline Runtime bootstrap และ render ไม่เรียก Provider เป็นเงื่อนไขการออกแบบ

## Test และ AI Evaluation

ตั้งชุดสังเคราะห์ภาษาไทยอย่างน้อย 120 กรณี ครอบคลุม A–F, สูตรข้ามตาราง, rename, ไม่มีสิทธิ์, injection จาก metadata, missing plan, stale, retry, fail กลาง transaction, rollback, outage และกรณีเขียนหลายตาราง เก็บ expected normalized ops/evidence/risk และ runtime assertions แยก holdout 20% ความผิดพลาดด้านสิทธิ์และข้อมูลต้องผ่านทุกกรณี รวมทดสอบ concurrency/replay แยกจาก accuracy

| Metric | เกณฑ์ pilot และวิธีวัด |
|---|---|
| Task completion / Intent / Context relevance | ≥85% / ≥95% / ≥90% จากงานจบพร้อม read-back, label ถูก, entity ที่จำเป็นปรากฏ ตามลำดับ |
| Schema / Expression / Configuration validity | ≥95% first proposal สำหรับโจทย์รองรับ และ 100% ของแผนที่ได้อนุมัติผ่าน deterministic validators |
| Tool success / Regression | ≥99% สำหรับ tool valid requests แบบ mock; zero regression ใน critical fixtures และ ≥99% non-critical |
| Hallucination / Unauthorized action | ≤2% ของคำอธิบายผิดหลักฐาน, 0 การอ้างว่าเขียนสำเร็จโดยไม่มี receipt, 0 unauthorized mutations |
| Rollback success | 100% ใน fault injection และทุก inverse ที่ประกาศรองรับ |
| Latency / Token / Cost | ตาม SLO ข้างต้น, p95 input ≤12k/output ≤4k, ≤$0.05 ต่อ task สำเร็จสำหรับรุ่น pilot โดยเทียบ cohort |

Unit ใช้ metadata mocks และ parser, Integration ใช้ SQLite แยกและ fake Provider, E2E ใช้ Playwright กับ draft จริงใน fixture, AI evaluation เรียกรุ่นจริงด้วยข้อมูลสังเคราะห์, Security ทดสอบ policy/ACL/egress/redaction, Performance วัดโหลดร่วม, Recovery จำลอง process interruption รอบ commit และ retry ด้วย key เดิม

### เกณฑ์ก่อนเปิดใช้จริง

- [ ] เปิดเฉพาะรายการ app/actor pilot และมี kill switch ฝั่ง server
- [ ] ยืนยัน provider/model/ข้อตกลงข้อมูลและ secret rotation
- [ ] ผ่าน cross-app, stale, injection, audit และ recovery fixtures
- [ ] ผ่าน eval holdout, latency/cost gates และตรวจ Runtime เมื่อ Provider ล่ม
- [ ] ซ้อม restore ฉบับร่าง, migration ของ SQLite และแผนปิด feature flag โดย UI เดิมยังทำงาน
- [ ] เตรียม dashboard/error rate/quota alert, runbook, owner และเงื่อนไขหยุด pilot
