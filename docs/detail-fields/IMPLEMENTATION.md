# Detail View — ระยะ 1 และ 2

พัฒนาและตรวจสอบวันที่ 2026-10-30 ใช้ฐานข้อมูลทดสอบแยก ไม่มีการ Deploy หรือเปลี่ยนฐานข้อมูล Production

## วิธีใช้งาน

ไปที่ **View → เลือกหน้ารายละเอียด → รูปแบบหน้าจอ → ลำดับและคอลัมน์ที่แสดง → กำหนดเอง**

- ตัวเลือกเดียวกันปรากฏในแท็บ **การตั้งค่า View → คอลัมน์ที่แสดง** และใช้ state/metadata เดียวกัน
- Checkbox, ลำดับ, ขึ้น–ลง และปุ่มตั้งค่ารายช่องอยู่แถวเดียวกัน รวม Related / Inline
- รายการสูงสุดประมาณ 10 แถวก่อนเลื่อนภายใน; การเปิดตัวเลือกจะใช้พื้นที่ในกรอบเดียวกัน
- ค้นหาไม่เปลี่ยนลำดับจริง ระหว่างค้นหาปิดปุ่มย้ายลำดับ เพื่อไม่ย้ายข้ามรายการที่ซ่อนโดยไม่ตั้งใจ
- ต้องเหลืออย่างน้อยหนึ่งคอลัมน์ เพราะระบบเดิมใช้ `columns=[]` หมายถึงอัตโนมัติ

## รูปแบบรายคอลัมน์

| รูปแบบ | ผล |
|---|---|
| ตามค่าของหน้า | คง layout/style ที่ View หรือค่าตั้งต้นแอปกำหนด |
| ชื่อด้านบน · ค่าด้านล่าง | Override การวางชื่อและค่าของช่องนี้ |
| ชื่อซ้าย · ค่าขวา | แสดงชื่อ/ค่าเป็นสองส่วน |
| ค่าเด่น | เพิ่มขนาดและน้ำหนักข้อความค่า |
| ค่ารอง | ใช้สีข้อความรอง |
| กล่องข้อมูล | เพิ่มพื้นหลังและกรอบของช่อง |
| ข้อความยาวแบบย่อ | เฉพาะ Text/LongText; 1–10 บรรทัด พร้อมอ่านเพิ่มเติม/แสดงน้อยลงเมื่อข้อความล้นจริง |

ตัวเลือกประกอบ: ตามค่าหน้า/ครึ่งแถว/เต็มแถว, ชื่อที่แสดงเฉพาะ View, แสดง/ซ่อนชื่อ, จัดแนวซ้าย/กลาง/ขวา, แสดง/ซ่อนเมื่อว่าง โดยเลือกสืบทอดค่ารวมได้

Related ตั้งได้เฉพาะความกว้างและชื่อหัวข้อ ซึ่งชื่อใช้ `related.title` เดิม ไม่เก็บชื่อซ้ำใน field config รูปแบบที่ไม่เหมาะกับ Related ไม่แสดงและ Backend ปฏิเสธด้วย

ความกว้างครึ่งแถวเปิด grid สองช่องได้ แม้ค่ารวมเป็นหนึ่งช่อง ส่วนช่องที่สืบทอดค่าหน้ายังคงเต็มแถวตามเดิม หน้าจอ ≤600px บังคับเต็มแถว

## โครงสร้างและความเข้ากันได้

- `DetailColumnEditor.tsx`: ใช้ Component เดียวทั้งสองแท็บ ส่ง `{columns,display}` ใน state update เดียว ป้องกัน selection กับ detail_order ไม่ตรงกัน
- คง `columns`, `detail_order`, `related` เดิม เพิ่ม `display.detail_fields` เฉพาะ View
- `detail-field-config.ts`: ชนิดข้อมูลและ Backend validation แบบ allowlist ไม่รับ CSS/HTML อิสระ
- `DetailField.tsx`: ครอบ renderer เดิมด้วย layout/typography; รูปภาพ แผนที่ Ref User EnumList และชนิดอื่นยัง render ด้วยระบบเดิม
- `RuntimeTable.tsx`: รวมค่ารายช่องกับค่ารวมของหน้า รองรับ hide-empty รายช่องโดยไม่ซ่อน 0/false หรือ formula errors
- `view-display.ts`: ตรวจ/ค้น dependency และเปลี่ยนชื่อ/นำการตั้งค่าออกเมื่อคอลัมน์เปลี่ยน
- `inline-views.ts`: ตรวจ Related จริงและย้าย key/order/field config เมื่อชื่อ Ref เปลี่ยน
- `view-api.ts`: จำกัดการตั้งค่ารายช่องเฉพาะหน้ารายละเอียด
- เปลี่ยน Slice จะกรองการตั้งค่าและลำดับให้เหลือคอลัมน์ที่มีอยู่จริง เปลี่ยนชนิด View ออกจากรายละเอียดจะล้าง options เฉพาะรายละเอียด เพื่อไม่ค้างจนบันทึกไม่ได้
- Preview ผ่าน `/api/views/preview` และ Runtime เดิม ไม่สร้าง Preview renderer แยก
- ไม่มี migration ของ business columns; View เดิมไม่มี detail_fields จะใช้การแสดงผลเดิม รวม root classes เดิม
- ฟอร์ม ตาราง รายการ และ Bulk Actions ยังคงเส้นทางเดิม

## หลักฐานทดสอบ

| Check | ผล | Evidence |
|---|---|---|
| `node scripts/test.cjs` | Passed 375/375 | `.test-data/detail-fields-unit.log` |
| `node scripts/integration.cjs detailfields` | Passed ทุก assertion | `.test-data/detail-fields-browser.log` |
| `node scripts/integration.cjs detaildesign` | Passed ชุดทดสอบรายละเอียดเดิม | `.test-data/detail-fields-design-regression.log` |
| `node scripts/integration.cjs api` | Passed 15/15 | `.test-data/detail-fields-api.log` |
| TypeScript noEmit | Passed ไม่มี diagnostics | `.test-data/detail-fields-types.log` |
| git diff --check | Passed | `.test-data/detail-fields-diff.log` |

Browser ใช้ Chromium/Edge กับ Next test server และ SQLite ที่ runner สร้างใหม่ ตรวจ:

- Selection/order ตรงกันสองแท็บ, กรอบเลื่อน, ค้นหาไม่เปลี่ยนลำดับ, Related แทรกในลำดับจริงของ DOM
- รูปแบบ/ชื่อ/ความกว้างรายช่อง, save/reload/undo, Preview ก่อนบันทึกโดย API ยังไม่มีค่าที่แก้
- Typed EnumList ยังคงชิป, ค่า 0 ไม่หาย, empty override, read-more/collapse
- ค่ารายช่อง override global edges / hidden labels / hide-empty ได้, Related ครึ่งแถว
- Rename column และ Ref รักษา configuration และลำดับ, ถอด options แล้วกลับสู่ renderer ค่าเริ่มต้น
- เปลี่ยน Slice แล้วบันทึกได้โดยไม่มี stale field keys และเปลี่ยนชนิด View เป็นตารางได้หลังเคยกำหนดรูปแบบรายช่อง
- viewport 390 / 820 / 1440 ไม่มี document overflow, mobile full span, dark mode, ไม่มี pageerror
- รอ Related โหลดข้อมูลลูกจริงก่อนตรวจภาพ

ตรวจภาพ `artifacts/detail-column-editor.png` และ `artifacts/detail-fields-mobile.png` แล้ว

ระหว่างพัฒนาพบ regression ที่ root class `detail-labels-hidden` หาย จึงคืน class เดิมและทำ override รายช่องแทน โดยไม่เปลี่ยน Expected Result ของชุดทดสอบเดิม

## ขอบเขตที่ยังไม่ทำ

หมวดข้อมูล, หมวดพับ–ขยาย และแท็บภายในรายละเอียดเป็นระยะ 3 จึงยังไม่เพิ่ม ไม่ได้ทดสอบ iPhone จริงหรือ Safari; การทดสอบ mobile เป็น Chromium viewport ไม่ใช่ผลวัดประสิทธิภาพ Production
