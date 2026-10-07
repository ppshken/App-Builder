const {selectChoice,assertControlValue}=require("./dropdown-helpers.cjs");
const { chromium, expect } = require('@playwright/test');
const fs = require('node:fs');
const base = process.env.NOCODE_TEST_URL;
if (!base || !process.env.NOCODE_TEST_DB?.includes('integration-')) throw new Error('Use npm run test:designer');
async function api(route, method = 'GET', body) { const r = await fetch(base + route, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }); const j = await r.json(); if (!r.ok) throw new Error(JSON.stringify(j)); return j; }
async function main() {
  const browser = await chromium.launch({ channel: process.env.NOCODE_BROWSER_CHANNEL || 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1910, height: 1000 }, locale: 'th-TH', reducedMotion: 'reduce' });
  const page = await context.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message)); fs.mkdirSync('artifacts', { recursive: true });
  try {
    await api('/api/tables', 'POST', { name: 'jobs', label: 'งานของฉัน', columns: [{ name: 'name', label: 'ชื่องาน', type: 'text', required: true, is_label: true }, { name: 'status', label: 'สถานะ', type: 'enum', options: 'รอดำเนินการ,เสร็จแล้ว', default_expr: '"รอดำเนินการ"' }, { name: 'owner', label: 'ผู้รับผิดชอบ', type: 'text', default_expr: 'USEREMAIL()' }] });
    await api('/api/data/jobs', 'POST', { name: 'ตรวจเอกสาร', owner: 'ทีมงาน' }); await api('/api/data/jobs', 'POST', { name: 'ติดตามลูกค้า', status: 'เสร็จแล้ว' });
    await api('/api/tables', 'POST', { name: 'customers', label: 'ลูกค้า', columns: [{ name: 'name', label: 'ชื่อลูกค้า', type: 'text', is_label: true }] });
    await api('/api/data/customers', 'POST', { name: 'ร้านตัวอย่าง' });
    let views = await api('/api/views'); const primary = views.find(v => v.table_name === 'jobs' && v.position === 'primary'), detail = views.find(v => v.table_name === 'jobs' && v.kind === 'detail');
    await api('/api/views', 'POST', { name: 'all_jobs', label: 'รายการงานทั้งหมด', table_name: 'jobs', kind: 'table', position: 'menu', pos: 10, columns: [], sort_column: 'name', sort_dir: 'asc' });
    await page.goto(base + '/views?view=all_jobs');
    const editor = page.getByRole('region', { name: 'ตั้งค่า View', exact: true }); const app = page.frameLocator('iframe[title="ตัวอย่างแอป"]');
    await assertControlValue(editor.getByLabel('ชื่อที่แสดงของ View', { exact: true }),'รายการงานทั้งหมด');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'บันทึก View', exact: true })).toBeDisabled();
    await expect(app.getByRole('heading', { name: 'รายการงานทั้งหมด', exact: true })).toBeVisible();
    await expect(page.locator('.designer-view-list')).toBeVisible(); await expect(page.locator('.designer-preview')).toBeVisible();
    const boxes = await Promise.all(['.designer-view-list', '.designer-editor', '.designer-preview-pane'].map(s => page.locator(s).boundingBox())); expect(boxes[0].x).toBeLessThan(boxes[1].x); expect(boxes[1].x).toBeLessThan(boxes[2].x);
    await page.screenshot({ path: 'artifacts/designer-desktop.png', fullPage: true });
    await editor.getByLabel('ชื่อที่แสดงของ View', { exact: true }).fill('รายการงานล่าสุด');
    await page.getByRole('button', { name: `แก้ไข View ${primary.label}`, exact: true }).click();
    const discard = page.getByRole('dialog', { name: 'ยังไม่ได้บันทึก View', exact: true });
    await expect(discard).toBeVisible(); await discard.getByRole('button', { name: 'กลับไปแก้ต่อ', exact: true }).click();
    await assertControlValue(editor.getByLabel('ชื่อที่แสดงของ View', { exact: true }),'รายการงานล่าสุด');
    await page.getByRole('button', { name: 'แสดงใน Preview', exact: true }).click();
    await expect(editor.getByRole('alert')).toContainText('บันทึก View ก่อน');
    await page.getByRole('button', { name: 'บันทึก View', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('บันทึก View แล้ว');
    await expect(app.getByRole('heading', { name: 'รายการงานล่าสุด', exact: true })).toBeVisible();
    await editor.getByRole('group', { name: 'รูปแบบหน้าจอ', exact: true }).getByRole('button', { name: 'รายการ', exact: true }).click();
    await editor.getByRole('group', { name: 'ตำแหน่งนำทาง', exact: true }).getByRole('button', { name: 'Primary', exact: true }).click();
    await editor.getByLabel('ลำดับในเมนู', { exact: true }).fill('0');
    await editor.getByRole('button', { name: 'กำหนดเอง', exact: true }).click(); await editor.getByRole('checkbox', { name: 'ผู้รับผิดชอบ', exact: true }).uncheck();
    await page.getByRole('button', { name: 'บันทึก View', exact: true }).click();
    await expect(app.getByRole('navigation', { name: 'Primary Navigation', exact: true }).getByRole('button', { name: 'รายการงานล่าสุด', exact: true })).toBeVisible();
    await expect(app.locator('.record-list')).toBeVisible();
    expect((await api('/api/views')).find(v => v.name === 'all_jobs').columns).toEqual(['name', 'status']);
    await page.getByRole('button', { name: 'แท็บเล็ต', exact: true }).click(); await expect(page.locator('.designer-preview-frame.tablet iframe')).toHaveCSS('width', '768px');
    await page.getByRole('button', { name: 'คอมพิวเตอร์', exact: true }).click(); await expect(page.locator('.designer-preview-frame.desktop iframe')).toHaveCSS('width', '1280px');
    await page.getByRole('button', { name: 'มือถือ', exact: true }).click(); await expect(page.locator('.designer-preview-frame.mobile iframe')).toHaveCSS('width', '390px');
    await expect(page.getByLabel('Preview App As', { exact: true })).toHaveCount(0);
    await app.getByRole('button', { name: 'เพิ่มข้อมูล', exact: true }).click(); await assertControlValue(app.getByLabel('ผู้รับผิดชอบ', { exact: true }),''); await app.getByRole('button', { name: 'ยกเลิก', exact: true }).click();
    await page.getByRole('button', { name: `แก้ไข View ${detail.label}`, exact: true }).click();
    await editor.getByLabel('ชื่อที่แสดงของ View', { exact: true }).fill('ไม่ได้บันทึก'); await page.getByRole('button', { name: 'แก้ไข View รายการงานล่าสุด', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'ปิดโดยไม่บันทึก', exact: true }).click();
    expect((await api('/api/views')).find(v => v.name === detail.name).label).toEqual(detail.label);
    await page.getByLabel('ค้นหา View', { exact: true }).fill('ลูกค้า'); await expect(page.getByRole('button', { name: 'แก้ไข View รายการงานล่าสุด', exact: true })).toHaveCount(0); await page.getByLabel('ค้นหา View', { exact: true }).fill('');
    await page.getByRole('button', { name: 'เพิ่ม Menu Navigation', exact: true }).click(); await page.getByRole('button', { name: 'บันทึก View', exact: true }).click(); await expect(editor.getByRole('alert')).toContainText('ตั้งชื่อ');
    await editor.getByLabel('ชื่อที่แสดงของ View', { exact: true }).fill('ทดสอบลบหน้าจอ'); await page.getByRole('button', { name: 'บันทึก View', exact: true }).click(); await expect(page.getByRole('status')).toContainText('บันทึก View แล้ว');
    await editor.getByText('การตั้งค่าเพิ่มเติม', { exact: true }).click(); await editor.getByRole('button', { name: 'ลบ View นี้', exact: true }).click(); await page.getByRole('dialog').getByRole('button', { name: 'ยืนยันลบ View', exact: true }).click();
    await expect(page.getByRole('button', { name: 'แก้ไข View ทดสอบลบหน้าจอ', exact: true })).toHaveCount(0); expect((await api('/api/data/jobs')).length).toBe(2);
    await page.setViewportSize({ width: 1440, height: 900 }); await page.emulateMedia({ colorScheme: 'dark' }); await page.getByRole('button', { name: 'แก้ไข View รายการงานล่าสุด', exact: true }).click(); await page.getByRole('button', { name: 'แสดงใน Preview', exact: true }).click(); await expect(app.getByRole('heading', { name: 'รายการงานล่าสุด', exact: true })).toBeVisible();
    await page.screenshot({ path: 'artifacts/designer-desktop-dark.png', fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 }); await page.getByRole('tab', { name: 'รายการ View', exact: true }).click(); await expect(page.locator('.designer-view-list')).toBeVisible();
    await page.getByRole('button', { name: 'แก้ไข View รายการงานล่าสุด', exact: true }).click(); await expect(editor).toBeVisible(); await expect.poll(() => page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1)).toBe(true); await page.screenshot({ path: 'artifacts/designer-mobile-settings.png', fullPage: true });
    await page.getByRole('tab', { name: 'Preview', exact: true }).click(); await expect(page.locator('.designer-preview-pane')).toBeVisible(); await expect(app.getByRole('heading', { name: 'รายการงานล่าสุด', exact: true })).toBeVisible(); await page.screenshot({ path: 'artifacts/designer-mobile-preview.png', fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false); expect(errors).toEqual([]);
    console.log('Designer browser tests passed: three panes, inline editing, save/preview updates, unsaved guard, type/position/columns, device scaling, removed email controls, create/delete, mobile/dark mode.');
  } catch (e) { await page.screenshot({ path: 'artifacts/designer-failure.png', fullPage: true }); console.error(await page.locator('body').innerText()); throw e; }
  finally { await browser.close(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
