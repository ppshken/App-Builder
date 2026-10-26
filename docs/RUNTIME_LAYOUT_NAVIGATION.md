# Layout และการนำทาง Runtime

แหล่งค่ากลางคือ app/runtime-layout.css ซึ่งนำเข้าหลัง globals.css ใน root layout

- --runtime-header-height ใช้กับ header หลัก Preview breadcrumb drawer overlay และระยะบนของ main/หน้ารายละเอียด/sticky toolbar
- --runtime-sidebar-collapsed-width และ --runtime-sidebar-expanded-width กำหนดความกว้าง sidebar
- --runtime-default-nav-height และ --runtime-pagination-height เป็นค่าเริ่มต้นของแถบล่าง; ความสูง Navigation Bar จริงยังวัดด้วย ResizeObserver
- --runtime-enter-duration / --runtime-exit-duration ใช้กับ motion; useRuntimeExit อ่านค่าระยะปิดจาก CSS และข้าม motion เมื่อ prefers-reduced-motion

RuntimeCloseButton และ RuntimeCloseContext ใช้คำสั่ง request ร่วมกับ RuntimePageTrail และ Escape ไม่ดักจาก aria-label ของปุ่มอีกแล้ว คำสั่งซ้ำระหว่างปิดถูกกันไว้ และหน้าที่เก็บไว้จะล้างสถานะ closing เมื่อถูกซ่อนก่อนนำกลับมาใช้อีกครั้ง

NavigationGuard รับ continuation ของปลายทาง เมื่อตรวจพบฟอร์มยังไม่บันทึกจะแสดง dialog ก่อน motion ผู้ใช้เลือกกลับไปกรอกต่อจะคงข้อมูลและยกเลิก continuation; เลือกปิดโดยไม่บันทึกจะไปยังหน้าที่ร้องขอจริง รองรับ menu, breadcrumb, ปิดฟอร์ม, Escape และ popstate ภายในแอพ

Browser Back จะคืน history เดิมก่อนหากถูก guard ปฏิเสธ และกลับไปยังเป้าหมายเมื่อยืนยัน ไม่ส่งบันทึกหรือแก้ข้อมูลแทนผู้ใช้

ชุดตรวจหลัก: navcontract, backstate, desktopnav ผ่าน scripts/integration.cjs โดยใช้ฐานข้อมูลแยกจากข้อมูลจริง การทดสอบ mobile ใช้ Chromium touch emulation; iPhone จริงยังต้องตรวจแยก

Registry ของ View/Action/ตารางไม่เก็บใน IndexedDB เพื่อให้เปิดหน้าใหม่แล้วอ่านการตั้งค่าล่าสุด ส่วนแคชในหน่วยความจำและแคชข้อมูลอ่านยังใช้ตามอายุที่กำหนด
