# แก้แถบแบ่งหน้าทับข้อมูลท้าย Dashboard

## สาเหตุที่ยืนยันได้
แถบ data-pagination ของ View ภายใน Dashboard รับรูปแบบ position: fixed ของหน้าหลัก จึงยึดขอบจอแทนที่จะอยู่ท้ายข้อมูลของ View ทำให้ทับข้อมูลและปุ่มด้านล่างตามภาพ

## การแก้ไข
- app/globals.css: กำหนดแถบแบ่งหน้าเฉพาะใน dashboard-panel-body เป็น position: static พร้อมคืนขนาดและตำแหน่งให้อยู่ในพื้นที่แต่ละ View
- ครอบคลุมมือถือ เดสก์ท็อป และเดสก์ท็อปที่เปิดแถบนำทางด้านล่าง
- คงการแบ่งหน้าและการโหลดข้อมูลเดิม เพื่อไม่ให้ข้อมูลหน้าถัดไปหายจากการเข้าถึง
- ไม่เปลี่ยนหน้ารายการเดี่ยว ฟอร์ม รายละเอียด สิทธิ์ หรือฐานข้อมูลจริง

## หลักฐานการทดสอบ
- tests/dashboard-bottom-navigation-browser.cjs: ทดสอบด้วยฐานข้อมูลแยก ตรวจขนาดเดสก์ท็อป แท็บเล็ต มือถือแบบวางซ้อนและแท็บ
- ก่อนแก้: .test-data/dashboard-bottom-before-static.log — ยืนยันตำแหน่งเดิมเป็น fixed แทน static
- หลังแก้: .test-data/dashboard-bottom-after.log — ผ่าน ตรวจรายการสุดท้ายและแถบแบ่งหน้าอยู่เหนือ Navigation Bar และ View เดี่ยวยังมีแถบแบ่งหน้า
- ภาพหลังแก้: artifacts/dashboard-bottom-navigation.png

## ขอบเขต
ทดสอบ Edge/Chromium จำลองขนาดมือถือ ยังไม่ได้ทดสอบบน iPhone จริง และยังไม่ได้เผยแพร่ระบบ

## ตรวจยืนยันชุดพร้อมใช้งาน
- Build และ TypeScript ผ่าน: .test-data/dashboard-bottom-build-final.log
- ทดสอบบน Production Build ผ่าน: .test-data/dashboard-bottom-production.log รวมข้อมูล 30 แถว กดหน้าถัดไปถึง Row 29 ค้นหา Row 29 และตรวจ View เดี่ยว
- ชุดทดสอบกว้าง dashboardsearch ยังไม่ผ่านที่เส้นทาง breadcrumb หลังเปิดรายการ: คาด dash_table แต่ได้ Global dashboard / row 0 จึงไม่อ้างว่าชุดนี้ผ่านทั้งหมด และไม่ได้แก้การนำทางในงานแก้ CSS นี้ หลักฐาน: .test-data/dashboard-bottom-search-regression.log
