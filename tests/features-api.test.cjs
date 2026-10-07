const { test } = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const base = process.env.NOCODE_TEST_URL;
if (!base || !process.env.NOCODE_TEST_DB?.includes('integration-')) throw new Error('Use isolated integration runner');
async function api(route, method = 'GET', body, status = 200, email = '') {
  const r = await fetch(base + route, { method, headers: { 'Content-Type': 'application/json', 'x-nocode-preview-email': email }, body: body === undefined ? undefined : JSON.stringify(body) });
  const j = await r.json(); assert.equal(r.status, status, JSON.stringify(j)); return j;
}
const col = (name, extra = {}) => ({ name, label: name, type: 'text', ...extra });
test('Key/Label, EnumList storage, view integrity and preview identity end to end', async () => {
  await api('/api/tables', 'POST', { name: 'feature_items', columns: [col('code', { is_key: true, default_expr: 'UNIQUEID()' }), col('name', { is_label: true }), col('tags', { type: 'enumlist', options: 'ด่วน,สำคัญ', required: true, default_expr: 'LIST("ด่วน")' }), col('owner', { default_expr: 'USEREMAIL()' }), col('count', { type: 'number', is_virtual: true, virtual_expr: 'COUNT([tags])' }), col('spare')] });
  const one = await api('/api/data/feature_items', 'POST', { code: 'A', name: 'รายการ ก', tags: ['ด่วน', 'สำคัญ', 'ด่วน'] }, 200, 'owner@example.com');
  let rows = await api('/api/data/feature_items');
  assert.deepEqual(rows[0].tags, ['ด่วน', 'สำคัญ']); assert.equal(rows[0].count, 2); assert.equal(rows[0].__label, 'รายการ ก'); assert.equal(rows[0].owner, process.env.NOCODE_TEST_EMAIL);
  await api('/api/data/feature_items', 'POST', { code: 'A' }, 400);
  await api('/api/data/feature_items', 'POST', { code: ' ' }, 400);
  await api('/api/data/feature_items', 'POST', { code: null }, 400);
  await api('/api/data/feature_items', 'POST', { code: 'B', tags: [] }, 400);
  await api('/api/data/feature_items', 'POST', { code: 'B', tags: ['ปลอม'] }, 400);
  await api(`/api/data/feature_items?id=${one.id}`, 'PUT', { code: 'Z' });
  await api(`/api/data/feature_items?id=${one.id}`, 'PUT', { code: 'A' });
  await api(`/api/data/feature_items?id=${one.id}`, 'PUT', { tags: ['สำคัญ'] });
  await api('/api/data/feature_items', 'POST', { name: 'อัตโนมัติ' });
  await api('/api/tables/feature_items', 'PATCH', { op: 'drop_column', name: 'code' }, 400);
  await api('/api/tables/feature_items', 'PATCH', { op: 'edit_column', name: 'name', is_key: true });
  let meta = (await api('/api/tables')).find(t => t.name === 'feature_items'); assert.equal(meta.columns.find(c => c.name === 'code').is_key, 0); assert.equal(meta.columns.find(c => c.name === 'name').is_key, 1);
  await api('/api/tables/feature_items', 'PATCH', { op: 'edit_column', name: 'code', is_key: true });
  const defaultViews = (await api('/api/views')).filter(v => v.table_name === 'feature_items'); assert.equal(defaultViews.length, 3); assert.equal(defaultViews.filter(v => v.position === 'ref').length, 2);
  const view = { name: 'feature_menu', label: 'งานด่วน', table_name: 'feature_items', kind: 'table', position: 'menu', pos: 7, columns: ['code', 'name', 'tags'], sort_column: 'code', sort_dir: 'asc' };
  await api('/api/views', 'POST', view); await api('/api/views', 'POST', { ...view, name: 'bad_view', columns: ['fake'] }, 400);
  await api('/api/views', 'PUT', { ...view, position: 'primary', pos: 1 });
  await api('/api/tables/feature_items', 'PATCH', { op: 'rename_column', name: 'code', new_name: 'item_code' });
  let saved = (await api('/api/views')).find(v => v.name === 'feature_menu'); assert.deepEqual(saved.columns, ['item_code', 'name', 'tags']); assert.equal(saved.sort_column, 'item_code');
  await api('/api/tables/feature_items', 'PATCH', { op: 'drop_column', name: 'spare' });
  await api('/api/data/feature_items', 'POST', { item_code: 'A' }, 400); // UNIQUE index survives rebuild.
  await api('/api/tables', 'POST', { name: 'feature_refs', columns: [col('name'), col('item', { type: 'ref', ref_table: 'feature_items' })] });
  await api('/api/data/feature_refs', 'POST', { name: 'อ้างอิง', item: one.id });
  assert.equal((await api('/api/data/feature_refs'))[0].item__label, 'รายการ ก');
  await api('/api/tables/feature_items', 'PATCH', { op: 'edit_column', name: 'item_code', is_label: true });
  assert.equal((await api('/api/data/feature_refs'))[0].item__label, 'A');
  const db = new Database(process.env.NOCODE_TEST_DB, { readonly: true });
  try { assert.equal(db.prepare('SELECT tags FROM t_feature_items WHERE id=?').get(one.id).tags, '["สำคัญ"]'); assert.deepEqual(db.pragma('foreign_key_check'), []); } finally { db.close(); }
  await api('/api/views?name=feature_menu', 'DELETE');
  await api('/api/data/feature_refs?id=1', 'DELETE'); await api('/api/tables/feature_refs', 'DELETE'); await api('/api/tables/feature_items', 'DELETE');
  assert.equal((await api('/api/views')).some(v => v.table_name === 'feature_items'), false);
  await api('/api/tables', 'POST', { name: 'key_conflicts', columns: [col('name')] });
  await api('/api/data/key_conflicts', 'POST', { name: 'ซ้ำ' }); await api('/api/data/key_conflicts', 'POST', { name: 'ซ้ำ' });
  await api('/api/tables/key_conflicts', 'PATCH', { op: 'edit_column', name: 'name', is_key: true }, 400);
  assert.equal((await api('/api/tables')).find(t => t.name === 'key_conflicts').columns[0].is_key, 0);
  await api('/api/tables/key_conflicts', 'DELETE');
});
