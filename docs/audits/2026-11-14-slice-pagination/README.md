# Slice pagination — 14 พฤศจิกายน 2026

## สาเหตุและผลหลังแก้

RuntimeTable ใช้ page/page_size อยู่แล้วในรายการธรรมดา แต่ส่ง all=1 สำหรับกลุ่มหลายระดับและตาราง/รายการใน Dashboard จึงโหลดทุกแถวก่อนแบ่งหน้าบน browser การเพิ่ม DOM ทีละส่วนใน Dashboard ไม่ได้ลดข้อมูลที่ดาวน์โหลด

เปลี่ยน RuntimeTable ทุกบริบทให้ใช้การแบ่งหน้าจาก API ค่าเริ่มต้น 25 รายการ เลือก 10/25/50/100 ตามมาตรฐานเดิมของระบบ Dashboard แสดงตัวควบคุมหน้าในแต่ละ panel การค้นหายังค้นทั้งขอบเขต Slice และกลับหน้าแรกเมื่อเปลี่ยนคำค้น

กลุ่มหลายระดับส่ง group_by/group_path ไป API แยกจำนวนรวมของทุกกลุ่มออกจากแถวในหน้าปัจจุบัน GroupNode ใช้ count ที่เซิร์ฟเวอร์คืน ไม่ใช้จำนวนแถวที่โหลดมาเป็นยอดรวม เมนูกลุ่มมี sample ไม่เกิน 1 แถวต่อ node เพื่อแสดงชื่อและ Ref decoration จึงไม่ขนสมาชิกทั้งหมดในแต่ละกลุ่ม

เส้นทาง SQL ใช้ GROUP BY/COUNT และ LIMIT เฉพาะช่วงแถวที่ต้องแสดง คงการเรียงกลุ่มตามชื่อ/ทิศทางเดิมและเรียงแถวภายในกลุ่ม รองรับหน้าเดียวที่คร่อมหลายกลุ่ม รวม null/ข้อความว่างและการคืน path ที่ถูกต้องเมื่อกลุ่มหาย ขอบเขต Slice และ row permissions ใช้กับทั้งสถิติและแถวที่ส่งกลับ คำขอ 403 ล้างสถิติกลุ่มที่ค้างใน client ด้วย

ตัวเลือก/จำนวนบนแท็บและ Quick Filter ของ Slice ที่ compile SQL ได้ ใช้ SQL DISTINCT/GROUP BY แทนการคำนวณทุก virtual column ในทุกแถว ยังคง interpreter fallback และ row permissions สำหรับเงื่อนไขที่ไม่รองรับ

## ผลทดสอบจริง

SQLite แยก 20,000 แถว มี 10,000 แถวตรง Slice:

| รายการ | ก่อน: all=1 ตาม UI เดิม | หลัง: หน้าแรกพร้อมกลุ่ม |
| --- | ---: | ---: |
| แถวข้อมูลที่ส่ง | 10,000 | 25 |
| ขนาด JSON | 2,635,004 bytes | 7,094 bytes |
| คำขอ all=1 จาก browser ใน flow ใหม่ | — | 0 |

ขนาดข้อมูลลดประมาณ 99.73% ใน fixture นี้ ไม่ใช่การรับประกัน latency บน Production ค่า firstGroupedRequestMs ใน results.json รวมการ compile ของ development server จึงไม่ใช้เป็น benchmark ความเร็ว Production

VERIFIED:
- npm test: 614 ผ่าน
- API integration: 18 ผ่าน
- slicepaging: เปลี่ยนหน้า 10/25/50/100, หน้าคร่อมกลุ่ม, เลือกกลุ่ม, ค้นหา, virtual sort/filter fallback, จำนวน tab/filter, สิทธิ์แถว, mobile/Desktop, Dashboard pagination และ global search/reset ผ่าน
- nestedgroups: editor/save/reorder, ทิศทางกลุ่ม, ยอดรวมข้ามหน้า, drilldown/All/back และ single-group pagination เดิมผ่าน
- npx tsc --noEmit, npm run build และ git diff --check ผ่าน
- ตรวจภาพ artifacts/slice-pagination-mobile.png และ artifacts/slice-pagination-desktop.png แล้ว

FAILED ในการตรวจเสริม:
- ชุด dashboardsearch เก่าหยุดที่ breadcrumb หลังเปิดแถว: คาดชื่อ dash_table แต่ได้ Global dashboard / row 0 จึงยังไม่ยืนยัน scenario breadcrumb ชุดนั้น ไม่ได้แก้ระบบ navigation ในงานนี้ การแบ่งหน้าและ global search ตรวจแยกผ่านด้วย slicepaging แล้ว

## ขอบเขตที่ยังมีต้นทุน

- Slice/การค้นหา/การเรียงที่ใช้ virtual column หรือสูตรซึ่ง compile SQL อย่างปลอดภัยไม่ได้ ยังอาจคำนวณข้อมูลที่เกี่ยวข้องทั้งหมดบน server เพื่อหายอดและลำดับที่ถูกต้อง แต่ส่งเฉพาะแถวหน้าปัจจุบันกลับ browser
- เมนูกลุ่มยังต้องมี metadata ตามจำนวนกลุ่มที่ไม่ซ้ำ หากกำหนดคอลัมน์ที่แทบไม่ซ้ำทุกแถวเป็นกลุ่ม metadata จะมากขึ้น
- กราฟ/ปฏิทิน/แผนที่ใช้เส้นทางข้อมูลเฉพาะของตนเอง ไม่เอา page ของรายการไปใช้ตัดยอดกราฟ
- คำขอ all=1 แบบ explicit ยังคงทำงานสำหรับผู้เรียกที่จำเป็น ไม่ได้เปลี่ยน contract การส่งออกหรือทำลายข้อมูล

ทดสอบเฉพาะ environment นี้ ไม่แก้ฐานข้อมูลผู้ใช้หรือ Production และไม่ได้ Deploy
