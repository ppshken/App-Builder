const { test } = require('node:test');
test('EnumList values and list formulas preserve empty/duplicate/invalid choices; preview context stays isolated', () => {
  const { evaluateExpression, isBlank } = require('../.test-build/expression.js');
  const { normalizeValue, formState } = require('../.test-build/columns.js');
  const assert = require('node:assert/strict');
  const col = { name: 'tags', label: 'หมวดหมู่', type: 'enumlist', options: 'ด่วน,สำคัญ', required: true };
  assert.deepEqual(normalizeValue(col, '["ด่วน","สำคัญ","ด่วน"]'), ['ด่วน', 'สำคัญ']);
  assert.deepEqual(normalizeValue(col, null), []); assert.equal(isBlank([]), true);
  assert.throws(() => normalizeValue(col, ['ปลอม']), /เลือกค่า/);
  assert.throws(() => normalizeValue(col, 'ด่วน,สำคัญ'), /รายการ/);
  assert.throws(() => normalizeValue(col, [2]), /รายการ/);
  assert.equal(evaluateExpression('COUNT([tags])', { tags: ['ด่วน', 'สำคัญ'] }), 2);
  assert.equal(evaluateExpression('IN("ด่วน", [tags])', { tags: ['ด่วน'] }), true);
  assert.deepEqual(evaluateExpression('LIST("ด่วน", "สำคัญ")'), ['ด่วน', 'สำคัญ']);
  assert.equal(evaluateExpression('USEREMAIL()', {}, { userEmail: 'a@example.com' }), 'a@example.com');
  assert.equal(evaluateExpression('USEREMAIL()'), '');
  assert.notEqual(evaluateExpression('UNIQUEID()'), evaluateExpression('UNIQUEID()'));
  assert.match(formState([col], { tags: [] }).validation.tags, /กรุณากรอก/);
  assert.equal(formState([{ ...col, show_if: 'USEREMAIL() = "a@example.com"' }], { tags: ['ด่วน'] }, new Date(), 'a@example.com').visible.tags, true);
});
const assert = require('node:assert/strict');
const { evaluateExpression: run, parseExpression, references, renameReference, asBoolean } = require('../.test-build/expression.js');
const { calculateRow, formulaErrors, formState, validateRow, normalizeValue } = require('../.test-build/columns.js');
const col = (name, extra = {}) => ({ name, label: name, type: 'number', ...extra });
const now = new Date('2026-10-04T18:30:45Z');

test('arithmetic, precedence, negatives, grouping and comparison', () => {
  assert.equal(run('[qty] * [price] + 5', { qty: 3, price: 20 }), 65);
  assert.equal(run('-(2 + 3) * .5'), -2.5);
  assert.equal(run('1e2 / 4 % 3'), 1);
  assert.equal(run('2 - 3 - 4'), -5);
  for (const formula of ['1 < 2', '2 <= 2', '3 > 2', '3 >= 3', '3 = 3', '3 <> 2', '3 != 2', '3 == 3']) assert.equal(run(formula), true);
  assert.equal(run('NULL < 2'), false);
});
test('IF, IFS, AND and OR skip unused branches; NOT and boolean columns', () => {
  assert.equal(run('IF(TRUE, 5, 1 / 0)'), 5);
  assert.equal(run('if(false, 1 / 0, 6)'), 6);
  assert.equal(run('IFS(FALSE, 1 / 0, TRUE, 7, TRUE, 1 / 0)'), 7);
  assert.equal(run('IFS(FALSE, 7)'), null);
  assert.equal(run('AND(FALSE, 1 / 0 > 0)'), false);
  assert.equal(run('OR(TRUE, 1 / 0 > 0)'), true);
  assert.equal(run('NOT([active])', { active: 0 }), true);
  assert.equal(run('[active] = TRUE', { active: 1 }), true);
  assert.equal(run('FALSE = [active]', { active: 0 }), true);
  assert.equal(run('[active] <> TRUE', { active: 0 }), true);
  assert.throws(() => asBoolean('false'), /TRUE.*FALSE/);
});
test('blank, false and zero are distinct', () => {
  assert.equal(run('ISBLANK(NULL)'), true);
  assert.equal(run('ISBLANK("")'), true);
  assert.equal(run('ISNOTBLANK(0)'), true);
  assert.equal(run('ISNOTBLANK(FALSE)'), true);
  assert.equal(run('NULL = ""'), true);
  assert.equal(run('NULL + 5'), 5);
});
test('text functions, Thai text, quotation and escaped characters', () => {
  assert.equal(run('CONCATENATE("ไทย", " ", UPPER("abc"), NULL)'), 'ไทย ABC');
  assert.equal(run('TRIM("  a   b  ")'), 'a b');
  assert.equal(run('LOWER("ABC") & "!"'), 'abc!');
  assert.equal(run('LEN("🐈ไทย")'), 4);
  assert.equal(run('"พูดว่า ""ใช่"""'), 'พูดว่า "ใช่"');
  assert.equal(run('"a\\nb"'), 'a\nb');
});
test('Thai date boundary, date functions and signed rounding', () => {
  assert.equal(run('TODAY()', {}, { now }), '2026-10-05');
  assert.equal(run('NOW()', {}, { now }), '2026-10-05T01:30:45+07:00');
  assert.equal(run('YEAR(TODAY()) + MONTH(TODAY()) + DAY(TODAY())', {}, { now }), 2041);
  assert.equal(run('ROUND(-1.5)'), -2);
  assert.equal(run('MAX(ABS(-3), MIN(4, 6))'), 4);
  assert.throws(() => run('DAY("2026-02-30")'), /วันที่/);
});
test('Thai syntax errors, unsupported calls, unknown columns and hostile code', () => {
  for (const formula of ['[qty', '"abc', 'IF(TRUE, 1)', 'IFS(TRUE, 1, FALSE)', '2 3', '2 +', 'TODAY(1)', 'SELECT("x")', 'process.exit()', 'new Function("x")', '(()=>1)()', '[constructor]', 'constructor()', '__proto__()', 'AND()'])
    assert.throws(() => run(formula), /[ก-๙]/, formula);
  assert.throws(() => run('1 / 0'), /หารด้วยศูนย์/);
  assert.throws(() => run('1e999'), /ใหญ่เกิน/);
  assert.throws(() => run('"abc" + 1'), /ตัวเลข/);
});
test('bounded parser, string output and no stack overflow', () => {
  assert.throws(() => parseExpression('('.repeat(70) + '1' + ')'.repeat(70)), /64/);
  assert.throws(() => parseExpression('1'.repeat(4001)), /4,000/);
  assert.throws(() => parseExpression('1+'.repeat(600) + '1'), /ซับซ้อน/);
  assert.throws(() => run('CONCATENATE(' + Array(4).fill('"' + 'x'.repeat(3000) + '"').join(',') + ')'), /4,000/);
  const row = { text: 'x'.repeat(4000) };
  assert.throws(() => run('CONCATENATE([text], [text], [text])', row), /10,000/);
});
test('column dependencies and rename preserve text literals and whitespace', () => {
  assert.deepEqual(references('[qty] + [qty] * [price]'), ['qty', 'price']);
  assert.equal(renameReference('CONCATENATE("[qty]", [ qty ], [price], [qty])', 'qty', 'amount'), 'CONCATENATE("[qty]", [amount], [price], [amount])');
});
test('metadata rejects cycles, unknown columns, bad syntax and invalid _THIS use', () => {
  assert.equal(Object.keys(formulaErrors([col('qty'), col('total', { is_virtual: 1, virtual_expr: '[qty] * 2' })])).length, 0);
  assert.match(Object.values(formulaErrors([col('a', { is_virtual: 1, virtual_expr: '[b]' }), col('b', { is_virtual: 1, virtual_expr: '[a]' })]))[0], /วนกัน/);
  assert.match(Object.values(formulaErrors([col('a', { default_expr: '[a]' })]))[0], /วนกัน/);
  assert.match(Object.values(formulaErrors([col('a', { default_expr: '[b]' }), col('b', { is_virtual: 1, virtual_expr: '[a]' })]))[0], /วนกัน/);
  assert.match(Object.values(formulaErrors([col('a', { show_if: '[_THIS] > 0' })]))[0], /ไม่พบ/);
  assert.match(Object.values(formulaErrors([col('a', { valid_if: '[missing] > 0' })]))[0], /ไม่พบ/);
});
test('virtual dependency ordering, spoof protection, initial values applied once', () => {
  const cols = [col('total', { is_virtual: 1, virtual_expr: '[qty] * [price]' }), col('price', { default_expr: '10' }), col('qty', { default_expr: '2' })];
  assert.equal(calculateRow(cols, { total: 999 }, true, now).row.total, 20);
  assert.equal(calculateRow(cols, { qty: null }, true, now).row.qty, null);
  assert.equal(calculateRow(cols, { qty: 3, price: 5 }, false, now).row.total, 15);
  const chained = [col('a', { default_expr: '[b] + 1' }), col('b', { default_expr: '3' })];
  assert.equal(calculateRow(chained, {}, true, now).row.a, 4);
});
test('Show_If, Required_If, Valid_If and hidden required fields use full row', () => {
  const cols = [col('qty', { required: 1, valid_if: '[_THIS] >= 0' }), col('note', { type: 'text', show_if: '[qty] > 5', required_if: '[qty] > 5' }), col('total', { is_virtual: 1, virtual_expr: '[qty] * 2' })];
  const state = formState(cols, { qty: '6', note: '' }, now);
  assert.equal(state.visible.note, true); assert.equal(state.required.note, true); assert.equal(state.row.total, 12);
  assert.throws(() => validateRow(cols, { qty: 6, note: '' }, now), /กรุณากรอก.*note/);
  assert.throws(() => validateRow(cols, { qty: -1 }, now), /Valid_If/);
  assert.throws(() => validateRow(cols, {}, now), /กรุณากรอก.*qty/);
  assert.equal(validateRow(cols, { qty: 0 }, now).qty, 0);
  assert.throws(() => validateRow([col('hidden', { required: 1, show_if: 'FALSE' })], {}, now), /ถูกซ่อน/);
  assert.throws(() => validateRow([col('a', { show_if: '"yes"' })], { a: 1 }, now), /TRUE.*FALSE/);
});
test('strict input types, enum, date, reference and false required', () => {
  assert.equal(normalizeValue(col('ok', { type: 'yesno' }), false), 0);
  assert.equal(normalizeValue(col('date', { type: 'date' }), '2026-10-05T01:00:00+07:00'), '2026-10-05');
  for (const [column, value] of [[col('a'), Infinity], [col('a'), true], [col('a'), ' '], [col('a', { type: 'ref' }), 1.5], [col('a', { type: 'date' }), '2026-02-30'], [col('a', { type: 'enum', options: 'A,B' }), 'C'], [col('a', { type: 'yesno' }), 'false']])
    assert.throws(() => normalizeValue(column, value), /[ก-๙]/);
  assert.equal(validateRow([col('a', { type: 'yesno', required: 1 })], { a: false }).a, 0);
});
test('bad formulas on historical rows are isolated and reported', () => {
  const cols = [col('qty'), col('result', { is_virtual: 1, virtual_expr: '10 / [qty]' })];
  const state = calculateRow(cols, { qty: 0 }, false, now, true);
  assert.equal(state.row.result, null); assert.match(state.errors.result, /หารด้วยศูนย์/);
  assert.throws(() => calculateRow(cols, { qty: 0 }, false, now), /หารด้วยศูนย์/);
});

test('Cross-table shorthand and SELECT preserve row scope, outer references, labels and bounded evaluation',()=>{
 const {tableReferences,listSource}=require('../.test-build/expression.js'),{enumListLabel}=require('../.test-build/columns.js');
 const tables={permission:{columns:['id','permission_key','name','active','role'],key:'permission_key',labels:{read:'อ่านข้อมูล',write:'แก้ไขข้อมูล',disabled:'ปิดใช้งาน'},rows:[{id:1,permission_key:'read',name:'อ่านข้อมูล',active:1,role:'staff'},{id:2,permission_key:'write',name:'แก้ไขข้อมูล',active:1,role:'admin'},{id:3,permission_key:'disabled',name:'ปิดใช้งาน',active:0,role:'staff'}]}},ctx={tables};
 assert.deepEqual(run('permission[permission_key]',{},ctx),['read','write','disabled']);
 assert.deepEqual(run('SELECT(permission[permission_key], [active] = TRUE)',{},ctx),['read','write']);
 assert.deepEqual(run('SELECT(permission[permission_key], AND([active] = TRUE, [role] = [_THISROW].[role]))',{role:'staff'},ctx),['read']);
 assert.deepEqual(run('SELECT(permission[permission_key], OR([role] = "admin", [role] = [_THISROW].[role]), TRUE)',{role:'staff'},ctx),['read','write','disabled']);
 assert.deepEqual(references('SELECT(permission[permission_key], [role] = [_THISROW].[role])'),['role']);
 assert.deepEqual(tableReferences('SELECT(permission[permission_key], [active] = TRUE)'),[{table:'permission',column:'permission_key'},{table:'permission',column:'active'}]);
 assert.equal(renameReference('SELECT(permission[permission_key], [role] = [_THISROW].[role])','role','team'),'SELECT(permission[permission_key], [role] = [_THISROW].[team])');
 assert.equal(renameReference('SELECT(permission[permission_key], [role] = [_THISROW].[role])','role','team','permission'),'SELECT(permission[permission_key], [team] = [_THISROW].[role])');
 assert.deepEqual(listSource('SELECT(permission[permission_key], TRUE)'),{table:'permission',column:'permission_key'});
 const c={name:'permissions',label:'สิทธิ์',type:'enumlist',valid_if:'SELECT(permission[permission_key], AND([active] = TRUE, [role] = [_THISROW].[role]))'},cols=[{name:'role',label:'บทบาท',type:'text'},c];
 let state=formState(cols,{role:'staff',permissions:['read']},now,'',ctx);assert.deepEqual(state.choices.permissions,['read']);assert.deepEqual(state.validation,{});assert.equal(enumListLabel(c,'read',ctx),'อ่านข้อมูล');assert.equal(enumListLabel(c,'removed',ctx),'removed');
 state=formState(cols,{role:'staff',permissions:['write']},now,'',ctx);assert.match(state.validation.permissions,/Valid_If/);assert.throws(()=>validateRow(cols,{role:'staff',permissions:['fake']},now,'',ctx),/Valid_If/);
 assert.deepEqual(formState([{...c,valid_if:'LIST("A", "B")'}],{permissions:['A']}).choices.permissions,['A','B']);
 assert.match(formState([{...c,valid_if:'TRUE',options:'read'}],{permissions:['fake']}).validation.permissions,/เลือกค่า/);
 assert.match(formulaErrors(cols,{permission:[{name:'permission_key',type:'text'}]})['permissions.valid_if'],/active/);
 for(const source of ['SELECT([permissions], TRUE)','SELECT(permission[permission_key])','SELECT(permission[permission_key], TRUE, TRUE, FALSE)','[_THISROW]','permission[__proto__]','Permission[permission_key]'])assert.throws(()=>parseExpression(source),/[ก-๙]/);
 assert.throws(()=>run('permission[missing]',{},ctx),/ไม่พบคอลัมน์/);assert.throws(()=>run('missing[permission_key]',{},ctx),/ไม่พบข้อมูลตาราง/);
 assert.throws(()=>run('SELECT(permission[permission_key], TRUE)',{}, {tables:{permission:{...tables.permission,rows:Array(10001).fill(tables.permission.rows[0])}}}),/10,000/);
});

test('Decimal and Ref property expressions retain numeric types, row scope, empty refs and dependency names',()=>{
 const {referencePaths,renameDereference}=require('../.test-build/expression.js');
 const tables={products:{columns:['id','name','product_price'],key:'id',labels:{1:'สินค้า A',2:'สินค้า B'},rows:[{id:1,name:'สินค้า A',product_price:23.5},{id:2,name:'สินค้า B',product_price:7.25}]}},context={tables,refTables:{product:'products'}};
 assert.equal(normalizeValue({name:'price',label:'ราคา',type:'decimal'},'23.50'),23.5);assert.equal(normalizeValue({name:'price',label:'ราคา',type:'decimal'},'-0.125'),-0.125);
 for(const value of ['bad',Infinity,NaN,true,[1]])assert.throws(()=>normalizeValue({name:'price',label:'ราคา',type:'decimal'},value),/ตัวเลข/);
 assert.equal(run('[product].[product_price]',{product:1},context),23.5);assert.equal(run('[product].[product_price] * [qty]',{product:2,qty:3},context),21.75);assert.equal(run('[product].[name]',{product:1},context),'สินค้า A');assert.equal(run('[product].[product_price]',{product:null},context),null);
 assert.throws(()=>run('[product].[product_price]',{product:999},context),/ไม่พบแถว/);assert.throws(()=>run('[product].[missing]',{product:1},context),/ไม่พบคอลัมน์/);assert.throws(()=>run('[text].[product_price]',{text:1},context),/Ref/);
 assert.deepEqual(references('[product].[product_price] * [qty]'),['qty','product']);assert.deepEqual(referencePaths('[product].[product_price]'),[{column:'product',property:'product_price',table:undefined}]);
 assert.equal(renameReference('[product].[product_price]','product','item'),'[item].[product_price]');assert.equal(renameReference('[product].[product_price]','product_price','changed'),'[product].[product_price]');assert.equal(renameDereference('[product].[product_price] & "[product_price]"','products','product_price','unit_price',{product:'products'},{}),'[product].[unit_price] & "[product_price]"');
 const cols=[{name:'product',label:'สินค้า',type:'ref',ref_table:'products'},{name:'qty',label:'จำนวน',type:'number'},{name:'total',label:'รวม',type:'decimal',is_virtual:true,virtual_expr:'[product].[product_price] * [qty]'}];assert.equal(calculateRow(cols,{product:1,qty:2},false,now,false,'',context).row.total,47);
 assert.deepEqual(formulaErrors(cols,{products:[{name:'product_price',type:'decimal'},{name:'name',type:'text'}]}),{});assert.match(formulaErrors(cols,{products:[{name:'name',type:'text'}]})['total.virtual_expr'],/product_price/);assert.match(formulaErrors([{...cols[0],type:'text'},cols[1],cols[2]])['total.virtual_expr'],/Ref/);
 const withRows={...tables,orders:{columns:['id','product'],key:'id',labels:{1:'a',2:'b'},refs:{product:'products'},rows:[{id:1,product:1},{id:2,product:2}]}};assert.deepEqual(run('SELECT(orders[id], [product].[product_price] > 10)',{}, {tables:withRows}),['1']);
});

test('List results accept SELECT keys, reject nested or hostile values and support list Valid_If',()=>{
 const {normalizeValue,formState}=require('../.test-build/columns.js');const column={name:'items',label:'รายการ',type:'list',valid_if:'LIST("a","b")'};
 assert.deepEqual(normalizeValue(column,['a',2,'a']),['a','2']);assert.deepEqual(normalizeValue(column,'["a","b"]'),['a','b']);assert.deepEqual(normalizeValue(column,null),[]);assert.throws(()=>normalizeValue(column,[{}]),/รายการ/);assert.throws(()=>normalizeValue(column,['a',NaN]),/รายการ/);assert.throws(()=>normalizeValue(column,'process.exit()'),/รายการ/);
 assert.equal(Object.keys(formState([column],{items:['a']}).validation).length,0);assert.match(formState([column],{items:['c']}).validation.items,/Valid_If/);
});

test('IN matches numeric IDs serialized in lists without conflating text business keys', () => {
  assert.equal(run('IN([id], [permissions])', { id: 2, permissions: ['2'] }), true);
  assert.equal(run('IN([id], [permissions])', { id: 2, permissions: ['3'] }), false);
  for (const text of ['', ' ', '0x2', 'Infinity', 'user.add'])
    assert.equal(run('IN([id], [permissions])', { id: 2, permissions: [text] }), false);
  assert.equal(run('IN(0, LIST(""))'), false);
  assert.equal(run('IN("01", LIST("1"))'), false);
  const tables = { permission: { columns: ['id', 'permission_key'], key: 'permission_key', labels: {}, rows: [
    { id: 1, permission_key: 'user.view' }, { id: 2, permission_key: 'user.add' }
  ] } };
  const formula = 'SELECT(permission[permission_key], IN([id],[_THISROW].[permission]))';
  assert.deepEqual(run(formula, { permission: ['2'] }, { tables }), ['user.add']);
  assert.deepEqual(run(formula, { permission: ['user.add'] }, { tables }), []);
  assert.deepEqual(run('SELECT(permission[permission_key], IN([permission_key], [_THISROW].[permission]))',
    { permission: ['user.add'] }, { tables }), ['user.add']);
});
