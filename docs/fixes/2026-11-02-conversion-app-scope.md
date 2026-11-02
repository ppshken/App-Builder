# TEXT → EnumList: application-scoped conversion validation

วันที่ตรวจ 2026-11-02

## Confirmed bug / reproduction

สร้าง SQLite isolated fixture ที่มีตารางเป้าหมาย `inspection_groups` ว่างและอีกตารางอยู่นอก app datasets แล้วเรียก preview ภายใต้ authenticated app scope

Expected: preview อนุญาตการเปลี่ยนโครงสร้างเมื่อไม่มีข้อมูลผิด ไม่อ่านข้อมูลตารางอื่นนอกแอป

Actual ก่อนแก้: `allowed=false,total=0,converted=0,failed=1` พร้อมข้อความ `inspection_groups: ตารางนี้ไม่ได้เชื่อมกับแอป หรือไม่มีสิทธิ์อ่านข้อมูล` ตรงกับอาการที่แจ้ง ทั้งที่เป้าหมายอยู่ใน app scope

Evidence: `.test-data/conversion-app-scope-before.log`, `tests/conversion.test.cjs` test `app-scoped TEXT to EnumList ...` ซึ่ง Fail ก่อนแก้

## Root cause และการแก้

`lib/column-conversion.ts:checkDependencies` ไล่ทุกตารางใน registry แล้ว prepare query ของ baseline ผ่าน scoped DB proxy ทำให้ถูกปฏิเสธเมื่อถึงตารางอื่นนอกแอป แม้ตารางนั้นไม่เกี่ยวกับการแปลง ข้อความถูกนำไปแสดงใต้ชื่อตารางเป้าหมายจึงทำให้เข้าใจผิด

อีกจุดคือ snapshot database ไม่ได้ route metadata ตาม application ID จึงตรวจ `_views/_actions/...` ของแอปเริ่มต้นแทนของแอปปัจจุบัน

แก้เฉพาะ:

- ตรวจข้อมูลแถวเฉพาะตารางที่อยู่ใน app datasets
- Snapshot ใช้ applicationDatabase routing ของแอปปัจจุบัน โดยยังเปลี่ยนเฉพาะสำเนาระหว่าง preview
- ยังตรวจ metadata เพื่อพบ dependency จากตารางนอกแอป หากพบจะหยุดด้วยข้อความทั่วไป โดยไม่อ่านหรือเผยชื่อ/ข้อมูลแถวของตารางนั้น
- ไม่เพิ่มสิทธิ์ ไม่ถอด application SQL boundary ไม่เปลี่ยนกติกาแปลงค่า และไม่แก้ฐานข้อมูลจริง

## Expected / Actual หลังแก้

| Test | Expected | Actual |
|---|---|---|
| ตารางว่าง มีตารางอื่นนอก scope | allowed=true, total=0, failed=0; source ไม่เปลี่ยน | Passed |
| แอปแยก มี TEXT A/B | ตรวจ metadata ของแอปนั้น; preview ไม่เขียนจริง; apply ได้ `["A"]` / `["B"]` | Passed |
| พยายามอ่านตารางนอก scope | ยังคงถูกปฏิเสธ | Passed ทั้ง Unit และ HTTP |
| dependency จริงอยู่นอกแอป | ไม่ผ่าน และไม่เผยชื่อ/ข้อมูลอีกตาราง | Passed |
| กติกา conversion เดิม | invalid values, Key ซ้ำ, stale preview, Ref/Inline และ confirmation ยังตรวจเหมือนเดิม | Passed |

Commands / evidence:

- `node --test tests/conversion.test.cjs`: **13 Passed** — `.test-data/conversion-app-scope-after.log`
- `node scripts/test.cjs`: **395 Passed, 0 Failed, 7 Skipped** — `.test-data/conversion-app-scope-unit.log`
- 7 Skipped เป็นชุด POSIX deployment helpers ที่ต้อง Linux/WSL ไม่ใช่ผลผ่าน
- `node scripts/integration.cjs conversion`: **Passed** — `.test-data/conversion-app-scope-browser.log`; เพิ่ม real HTTP กรณี default app ตารางว่างและ named app มีข้อมูล พร้อมตรวจว่า private table ยังถูกปิดกั้น
- TypeScript noEmit: **Passed** — `.test-data/conversion-app-scope-types.log`
- `git diff --check`: **Passed**

## Environment limitation

Repository ประกาศ Next 16.4.3 / React 19.3.1 แต่ node_modules ในเครื่องนี้ยังเป็น Next 14.2.15 / React 18.3.1 การทดสอบ Browser/API ข้างต้นใช้รุ่นที่ติดตั้งจริง ยังไม่ได้ยืนยันบน Next 16 / React 19 และไม่ได้อัปเกรด dependency ในงานนี้

Test server รุ่นเก่าปรับ generated configuration/optional SWC lock entry ระหว่างเริ่มงาน ได้คืนเฉพาะ generated diffs ใน next-env.d.ts, tsconfig.json และ package-lock.json แล้ว ไฟล์เหล่านั้นไม่อยู่ใน diff ของการแก้บัคนี้

ไม่ Deploy ไม่แก้ Credentials หรือข้อมูลผู้ใช้จริง การแก้เป็น source + regression tests เท่านั้น

## Follow-up: Next 16 upgrade

The previous Next 14 environment limitation is superseded by the Next 16.4.3 / React 19.3.1 installation and successful isolated conversion HTTP/browser tests in both development and production mode. See [upgrade verification](../upgrades/2026-11-02-next16.md). Historical test results above remain unchanged.
