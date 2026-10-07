const {selectChoice,assertControlValue}=require("./dropdown-helpers.cjs");
const { chromium, expect } = require('@playwright/test');
const fs = require('node:fs');
const base = process.env.NOCODE_TEST_URL;
if (!base || !process.env.NOCODE_TEST_DB?.includes('integration-')) throw new Error('Use npm run test:features');
async function api(route, method = 'GET', body) {
  const r = await fetch(base + route, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }); const j = await r.json(); if (!r.ok) throw new Error(JSON.stringify(j)); return j;
}
async function main() {
  const browser = await chromium.launch({ channel: process.env.NOCODE_BROWSER_CHANNEL || 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'th-TH', timezoneId: 'Asia/Bangkok', reducedMotion: 'reduce' });
  const page = await context.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message)); fs.mkdirSync('artifacts', { recursive: true });
  try {
    await api('/api/tables', 'POST', { name: 'tasks', label: 'งานของฉัน', columns: [
      { name: 'code', label: 'รหัสงาน', type: 'text', default_expr: 'UNIQUEID()' },
      { name: 'name', label: 'ชื่องาน', type: 'text', required: true },
      { name: 'tags', label: 'หมวดหมู่', type: 'enumlist', options: 'ด่วน,สำคัญ,ติดตาม', required: true, default_expr: 'LIST("ด่วน")' },
      { name: 'owner', label: 'ผู้รับผิดชอบ', type: 'text', default_expr: 'USEREMAIL()' },
      { name: 'private_note', label: 'หมายเหตุเฉพาะผู้จัดการ', type: 'text', show_if: 'USEREMAIL() = "manager@example.com"' }
    ] });
    await page.goto(base + '/t/tasks/edit');
    await page.getByRole('button', { name: 'แก้ไขคอลัมน์ รหัสงาน', exact: true }).click();
    let dialog = page.getByRole('dialog');
    await dialog.getByRole('checkbox', { name: /Key · รหัสที่ใช้ในแอป/ }).check();
    await dialog.getByRole('button', { name: 'บันทึกการแก้ไข', exact: true }).click();
    await expect(page.locator('.table-identities')).toContainText('รหัสงาน');
    await page.getByRole('button', { name: 'แก้ไขคอลัมน์ ชื่องาน', exact: true }).click();
    dialog = page.getByRole('dialog');
    await dialog.getByRole('checkbox', { name: /Label · ชื่อที่แสดงของแถว/ }).check();
    await dialog.getByRole('button', { name: 'บันทึกการแก้ไข', exact: true }).click();
    await expect(page.locator('.table-identities')).toContainText('ชื่องาน');
    await page.screenshot({ path: 'artifacts/features-columns.png', fullPage: true });
    await page.locator('.data-table-tabs').getByRole('link', { name: 'ข้อมูล', exact: true }).click();
    await page.getByRole('button', { name: 'เพิ่มข้อมูล', exact: true }).click();
    dialog = page.getByRole('dialog');
    await expect(dialog.getByLabel('รหัสงาน *', { exact: true })).not.toHaveValue('');
    await dialog.getByLabel('ชื่องาน *', { exact: true }).fill('ตรวจเอกสาร');
    await expect(dialog.getByRole('checkbox', { name: 'ด่วน', exact: true })).toBeChecked();
    await dialog.getByRole('checkbox', { name: 'สำคัญ', exact: true }).check();
    await page.screenshot({ path: 'artifacts/features-enumlist.png', fullPage: true });
    await dialog.getByRole('button', { name: 'บันทึกข้อมูล', exact: true }).click();
    await expect(page.getByRole('cell', { name: 'ด่วน · สำคัญ', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'แก้ไข ตรวจเอกสาร', exact: true }).click();
    dialog = page.getByRole('dialog'); await expect(dialog.getByLabel('รหัสงาน *', { exact: true })).toBeDisabled();
    await dialog.getByRole('button', { name: 'ยกเลิก', exact: true }).click();
    await page.getByRole('link', { name: 'View', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Primary Navigation', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'เพิ่ม Menu Navigation', exact: true }).click();
    dialog = page.getByRole('region', { name: 'ตั้งค่า View', exact: true });
    await dialog.getByLabel('ชื่อที่แสดงของ View', { exact: true }).fill('รายการงานทั้งหมด');
    await dialog.getByRole('group', { name: 'รูปแบบหน้าจอ', exact: true }).getByRole('button', { name: 'ตาราง', exact: true }).click();
    await page.getByRole('button', { name: 'บันทึก View', exact: true }).click();
    await expect(page.getByRole('button', { name: 'แก้ไข View รายการงานทั้งหมด', exact: true })).toBeVisible();
    const views = await api('/api/views'), detail = views.find(v => v.kind === 'detail' && v.position === 'ref');
    await page.getByRole('button', { name: `แก้ไข View ${detail.label}`, exact: true }).click();
    dialog = page.getByRole('region', { name: 'ตั้งค่า View', exact: true });
    await dialog.getByLabel('ชื่อที่แสดงของ View', { exact: true }).fill('รายละเอียดงาน');
    await dialog.getByRole('button', { name: 'กำหนดเอง', exact: true }).click();
    await dialog.getByRole('checkbox', { name: 'รหัสงาน', exact: true }).uncheck();
    await dialog.getByRole('checkbox', { name: 'ผู้รับผิดชอบ', exact: true }).uncheck();
    await dialog.getByRole('checkbox', { name: 'หมายเหตุเฉพาะผู้จัดการ', exact: true }).uncheck();
    await page.getByRole('button', { name: 'บันทึก View', exact: true }).click();
    await expect(page.getByRole('button', { name: 'บันทึก View', exact: true })).toBeDisabled();
    await page.screenshot({ path: 'artifacts/features-views.png', fullPage: true });
    await selectChoice(page.getByLabel('View ที่เปิดใน Preview', { exact: true }),views.find(v=>v.position==='primary').name);
    const app = page.frameLocator('iframe[title="ตัวอย่างแอป"]');
    await expect(app.getByRole('navigation', { name: 'Primary Navigation', exact: true })).toBeVisible();
    await expect(app.getByRole('navigation', { name: 'Primary Navigation', exact: true }).getByRole('button', { name: 'งานของฉัน', exact: true })).toBeVisible();
    await expect(app.getByRole('navigation', { name: 'Primary Navigation', exact: true }).getByText('รายละเอียดงาน', { exact: true })).toHaveCount(0);
    await app.getByRole('button', { name: 'ดูรายละเอียด ตรวจเอกสาร', exact: true }).filter({ visible: true }).click();
    await expect(app.getByRole('region', { name: 'รายละเอียดงาน', exact: true })).toBeVisible();
    await expect(app.locator('.runtime-screen').getByText('รหัสงาน', { exact: true })).toHaveCount(0);
    await app.getByRole('button', { name: 'กลับหน้าก่อนหน้า', exact: true }).click();
    await app.getByRole('button', { name: 'เปิดเมนูแอป', exact: true }).click();
    await expect(app.getByRole('navigation', { name: 'Menu Navigation', exact: true })).toBeVisible();
    await app.getByRole('navigation', { name: 'Menu Navigation', exact: true }).getByRole('button', { name: 'รายการงานทั้งหมด', exact: true }).click();
    await expect(app.getByRole('heading', { name: 'รายการงานทั้งหมด', exact: true })).toBeVisible();
    await expect(page.getByLabel('Preview App As', { exact: true })).toHaveCount(0);
    await page.locator('iframe').scrollIntoViewIfNeeded();
    await app.getByRole('button', { name: 'เพิ่มข้อมูล', exact: true }).click();
    await assertControlValue(app.getByLabel('ผู้รับผิดชอบ', { exact: true }),'');
    await expect(app.getByLabel('หมายเหตุเฉพาะผู้จัดการ', { exact: true })).toHaveCount(0);
    await app.getByRole('button', { name: 'ยกเลิก', exact: true }).click();
    await page.screenshot({ path: 'artifacts/features-preview.png', fullPage: true });
    await page.getByRole('button',{name:'คอมพิวเตอร์',exact:true}).click();
    await expect(page.locator('.designer-preview-frame.desktop')).toBeVisible();
    await page.getByRole('button',{name:'แท็บเล็ต',exact:true}).click();
    await expect(page.locator('.designer-preview-frame.tablet')).toBeVisible();
    await page.getByRole('button',{name:'มือถือ',exact:true}).click();
    const formView = views.find(v => v.kind === 'form');
    await selectChoice(page.getByLabel('View ที่เปิดใน Preview', { exact: true }),formView.name);
    await page.locator('iframe').scrollIntoViewIfNeeded();
    await expect(app.getByRole('region', { name: formView.label, exact: true })).toBeVisible();
    await app.getByRole('button', { name: 'ยกเลิก', exact: true }).click();
    await api('/api/tables', 'POST', { name: 'teams', label: 'ทีม', columns: [{ name: 'name', label: 'ชื่อทีม', type: 'text', is_label: true }] });
    const team = await api('/api/data/teams', 'POST', { name: 'ฝ่ายเอกสาร' });
    await api('/api/tables/tasks', 'PATCH', { op: 'add_column', column: { name: 'team', label: 'ทีมที่รับผิดชอบ', type: 'ref', ref_table: 'teams' } });
    const task = (await api('/api/data/tasks'))[0]; await api(`/api/data/tasks?id=${task.id}`, 'PUT', { team: team.id });
    const latest = await api('/api/views'), teamsDetail = latest.find(v => v.table_name === 'teams' && v.kind === 'detail');
    const taskDetail = latest.find(v => v.name === detail.name); await api('/api/views', 'PUT', { ...taskDetail, columns: [...taskDetail.columns, 'team'] });
    await page.goto(base + '/run?view=' + views.find(v => v.kind === 'table').name);
    await page.getByRole('button', { name: 'ดูรายละเอียด ตรวจเอกสาร', exact: true }).filter({ visible: true }).click();
    await page.locator('.runtime-screen').getByRole('button', { name: 'ฝ่ายเอกสาร ↗', exact: true }).click();
    await expect(page.getByRole('region', { name: teamsDetail.label, exact: true })).toBeVisible();
    await expect(page.locator('.runtime-screen').getByText('ฝ่ายเอกสาร', { exact: true }).last()).toBeVisible();
    await page.goBack();
    await expect(page.getByRole('heading', { name: 'รายการงานทั้งหมด', exact: true })).toBeVisible();
    await page.goto(base + '/preview?view=' + views.find(v => v.position === 'primary').name);
    await expect(page.frameLocator('iframe').getByRole('heading', { name: 'งานของฉัน', exact: true })).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 }); await page.emulateMedia({ colorScheme: 'dark' });await page.getByRole('tab',{name:'Preview',exact:true}).click();
    await page.screenshot({ path: 'artifacts/features-preview-mobile-dark.png', fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    expect(errors).toEqual([]);
    console.log('Feature browser tests passed: Key/Label, EnumList, View creation/configuration, Primary/Menu/Reference navigation, removed email controls and devices, mobile/dark mode.');
  } catch (e) { await page.screenshot({ path: 'artifacts/features-failure.png', fullPage: true }); console.error(await page.locator('body').innerText()); throw e; }
  finally { await browser.close(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
