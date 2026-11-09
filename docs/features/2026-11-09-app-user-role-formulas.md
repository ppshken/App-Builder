# ตารางผู้ใช้และบทบาทสำหรับสูตร

เพิ่มตารางระบบอ่านอย่างเดียวใน **ตัวช่วยสูตร → ตาราง** และ autocomplete โดยไม่เพิ่มตารางธุรกิจหรือเปิด CRUD ของบัญชี

| ตาราง | คอลัมน์ |
| --- | --- |
| `_app_users` | `id`, `name`, `nickname`, `role_id`, `role_name`, `app_id` |
| `_app_user_roles` | `id`, `name`, `app_id` |

`_app_users.id` เป็น ID บัญชีจริงที่ใช้กับ `USERID()` และชนิด User ส่วน `_app_users.role_id` / `_app_user_roles.id` เป็นคีย์ข้อความจริงของบทบาท เปรียบเทียบกับ `USERROLEKEY()` ได้ ไม่ใช่ชื่อแสดงหรือเลขลำดับที่สร้างใหม่ บทบาทของบัญชีเดียวกันเปลี่ยนตามแอปที่ใช้งาน

## ตัวอย่าง

ผู้ใช้ที่เข้าแอปปัจจุบันได้:

```text
_app_users[id]
```

ผู้ใช้ที่มีบทบาทเดียวกับผู้ใช้ปัจจุบัน:

```text
SELECT(_app_users[id], [role_id] = USERROLEKEY())
```

ผู้ใช้ตาม ID บทบาทที่เลือกไว้ในคอลัมน์ `assigned_role` ของแถวปัจจุบัน:

```text
SELECT(_app_users[id], [role_id] = [_THISROW].[assigned_role])
```

ตัวเลือก ID บทบาท พร้อมแสดงชื่อบทบาทเมื่อใช้เป็นตัวเลือก Enum / EnumList:

```text
_app_user_roles[id]
```

ชื่อบทบาทปัจจุบันผ่านตาราง:

```text
INDEX(SELECT(_app_user_roles[name], [id] = USERROLEKEY()), 1)
```

## ขอบเขตและความปลอดภัย

- ใช้เฉพาะแอปปัจจุบัน ไม่รับ app ID จากข้อความสูตรเพื่อเปิดข้อมูลแอปอื่น
- ใช้สิทธิ์เข้าแอปเดิม รวม membership, การปฏิเสธ, Builder และโหมดแยกสิทธิ์ เทียบผลกับ `canUseApplication` ในการทดสอบ
- แสดงเฉพาะบัญชีเปิดใช้งาน บทบาทในแอป และบทบาทระบบ/สืบทอดที่ผู้ใช้ในแอปใช้จริง เช่น owner
- แอป default ที่ยังใช้สิทธิ์สืบทอดจะเห็นผู้ใช้ตามนโยบายเดิม ไม่ได้แปลว่าแสดงเฉพาะสมาชิกที่เพิ่มด้วยมือ
- เป็น public directory สำหรับผู้ที่มีสิทธิ์เข้าแอป เช่นเดียวกับตัวเลือก User; ไม่ส่ง email, username, แผนก, password hash, session, token, สิทธิ์ตาราง หรือ private user settings
- ขอชื่อคอลัมน์นอก whitelist ไม่ได้ และ `_users` / `_roles` จริงยังไม่ใช่ตารางที่สูตรอ่านได้
- ใช้ SELECT/INDEX/IN/COUNT/ORDERBY และ expression engine เดิม ไม่สร้าง SQL จากสูตร
- อ่านแบบ lazy และ cache เฉพาะ expression context ของ request ไม่มี cache ข้อมูลผู้ใช้ข้าม request/app/actor
- จำกัดผู้ใช้/บทบาทไม่เกิน 10,000 รายการต่อ snapshot ตามขอบเขต engine
- ไม่เปิด Ref ไปตารางระบบจริง และไม่ขยายบริบทที่ตั้งใจจำกัดเป็นสูตรแถวเดียว เช่น row permissions/decoration บางบริบท

## การทดสอบ

- Unit: สองแอปมีสมาชิกต่างกันและใช้ role ID จริง; ปฏิเสธบัญชีนอกแอป; ไม่ส่งฟิลด์ส่วนตัว; legacy/separated/builder scope; anonymous; metadata validation; parser; completion; role ID เป็นข้อความและ user ID เป็นตัวเลข
- Integration: บัญชีเดียวกันอ่านสูตรในสองแอปได้ ID บทบาทต่างกัน, scalar/list expressions, snapshots ของ runtime user, enum role choices, ห้ามฟิลด์รหัสผ่าน/ชื่อ SQL จริง และใช้สูตรใน existing Action condition/values
- Browser: ตารางระบบปรากฏในตัวช่วยสูตร และประเมิน ID บทบาทได้ชนิดข้อมูลถูกต้อง
- Logs: `.test-data/system-formula-unit-final.log`, `system-formula-browser.log`, `system-formula-build.log`, `system-formula-production.log`, `system-formula-permissions.log`

ไม่มี migration/การเปลี่ยน production database/deploy; ทดสอบบนฐานข้อมูลจำลองแยก ไม่ได้ทดสอบ iPhone จริงหรือ load ระดับล้านบัญชี
