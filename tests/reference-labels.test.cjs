const {test} = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const dbModule = require('../.test-build/db.js');
const {initializeDatabase} = require('../.test-build/schema.js');
const {withReferenceLabels} = require('../.test-build/view-records.js');
const {listPage} = require('../.test-build/lists.js');
const {runAuthorized} = require('../.test-build/permissions.js');
const now = new Date('2026-10-13T00:00:00Z');
const image = '/api/images/00000000-0000-4000-8000-000000000001';
const refs = ['first', 'second'].map(name => ({name, label: name, type: 'ref', ref_table: 'products'}));

function fixture(work) {
  const queries = [], database = new Database(':memory:', {verbose: sql => queries.push(sql)});
  const previous = dbModule.db;
  try {
    initializeDatabase(database, ':memory:');
    database.exec(`
      INSERT INTO _tables(name,label) VALUES('products','Products');
      INSERT INTO _columns(table_name,name,label,type,is_virtual,virtual_expr,is_label,ref_table) VALUES
        ('products','name','Name','text',0,NULL,0,NULL),
        ('products','branch','Branch','text',0,NULL,0,NULL),
        ('products','photo','Photo','image',0,NULL,1,NULL),
        ('products','upper_name','Upper name','text',1,'UPPER([name])',0,NULL),
        ('products','title','Title','text',1,'CONCATENATE([upper_name], " · ", [id])',1,NULL),
        ('products','unused','Unused','number',1,'SUM(extras[value])',0,NULL),
        ('products','items','Items','list',0,NULL,0,'extras');
      CREATE TABLE t_products(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT,branch TEXT,photo TEXT,items TEXT);
    `);
    const insert = database.prepare('INSERT INTO t_products(name,branch,photo,items) VALUES(?,?,?,?)');
    database.transaction(() => {
      for (let i = 1; i <= 600; i++) insert.run('Product ' + i, i % 2 ? 'allowed' : 'hidden', i === 1 ? image : null, '[]');
    })();
    dbModule.db = database;
    queries.length = 0;
    work(database, queries);
  } finally {
    dbModule.db = previous;
    database.close();
  }
}

test('Ref labels batch shared targets and skip unrelated formulas and List lookups', () => fixture((database, queries) => {
  const rows = Array.from({length: 600}, (_, i) => ({first: i + 1, second: 600 - i}));
  let formulaReads = 0;
  const result = withReferenceLabels('orders', refs, rows, now, '', {
    getTable() { formulaReads++; throw Error('Unrelated cross-table formula must not run'); }
  });
  assert.equal(result, rows);
  assert.equal(rows[0].first__label, 'PRODUCT 1 · 1');
  assert.equal(rows[0].second__label, 'PRODUCT 600 · 600');
  assert.equal(rows[0].first__image, image);
  assert.equal(rows[0].second__image, null);
  assert.equal(queries.filter(sql => sql.startsWith('SELECT * FROM "t_products"')).length, 2);
  assert.equal(queries.filter(sql => sql.startsWith('SELECT * FROM _columns')).length, 1);
  assert.equal(formulaReads, 0);
  assert.ok(queries.every(sql => !sql.includes('t_extras')));
}));

test('Ref labels retain row policies on raw columns and isolate users and metadata changes', () => fixture(database => {
  database.exec(`INSERT INTO _roles(name,label,builder) VALUES('staff','Staff',0);
    INSERT INTO _role_row_rules VALUES('staff','products','read','[branch] = "allowed"');`);
  const access = {owner: false, builder: false, tables: {products: {read: true, create: false, update: false, delete: false}}, actions: []};
  const user = {id: 2, name: 'Staff', email: 'staff@example.com', role: 'staff'};
  runAuthorized(user, access, () => {
    const [row] = withReferenceLabels('orders', refs, [{first: 1, second: 2}], now, '', {});
    assert.equal(row.first__label, 'PRODUCT 1 · 1');
    assert.equal(row.first__image, image);
    assert.equal(row.second__label, null);
    assert.equal(row.second__image, null);
  });
  const [ownerRow] = withReferenceLabels('orders', refs, [{first: 1, second: 2}], now, '', {});
  assert.equal(ownerRow.second__label, 'PRODUCT 2 · 2');
  database.prepare('UPDATE t_products SET name=? WHERE id=1').run('Changed');
  assert.equal(withReferenceLabels('orders', refs, [{first: 1}], now, '', {})[0].first__label, 'CHANGED · 1');
  runAuthorized(user, {...access, tables: {}}, () => {
    assert.deepEqual(withReferenceLabels('orders', refs, [{first: 1}], now, '', {}), [{first: 1}]);
  });
}));

test('Ref labels keep missing, empty and invalid formula fallbacks', () => fixture((database, queries) => {
  const empty = withReferenceLabels('orders', refs, [{first: null, second: 9999}], now, '', {});
  assert.equal(empty[0].first__label, null);
  assert.equal(empty[0].second__label, null);
  queries.length = 0;
  withReferenceLabels('orders', refs, [{first: null, second: null}], now, '', {});
  assert.ok(queries.every(sql => !sql.includes('FROM "t_products"') && !sql.includes('FROM _columns')));
  database.exec(`UPDATE _columns SET virtual_expr='IF(' WHERE name='title'`);
  assert.equal(withReferenceLabels('orders', refs, [{first: 1}], now, '', {})[0].first__label, 1);
  database.exec(`UPDATE _columns SET is_label=0 WHERE name='title'; UPDATE _columns SET is_label=1 WHERE name='name'`);
  assert.equal(withReferenceLabels('orders', refs, [{first: 1}], now, '', {})[0].first__label, 'Product 1');
}));

test('virtual Ref label dependencies preserve dereferences and image formulas', () => fixture(database => {
  database.exec(`
    INSERT INTO _columns(table_name,name,label,type,is_virtual,virtual_expr,ref_table,is_label) VALUES
      ('products','category','Category','ref',0,NULL,'categories',0),
      ('products','label_photo','Label photo','image',1,'[photo]',NULL,1);
    ALTER TABLE t_products ADD COLUMN category INTEGER;
    UPDATE t_products SET category=7 WHERE id=1;
    UPDATE _columns SET is_label=0 WHERE name='photo';
    UPDATE _columns SET virtual_expr='CONCATENATE([category].[name], " · ", [upper_name])' WHERE name='title';
  `);
  let reads = 0;
  const [row] = withReferenceLabels('orders', refs, [{first: 1}], now, '', {
    getTable(name) {
      assert.equal(name, 'categories'); reads++;
      return {key: 'id', columns: ['id', 'name'], rows: [{id: 7, name: 'Category'}]};
    }
  });
  assert.equal(row.first__label, 'Category · PRODUCT 1');
  assert.equal(row.first__image, image);
  assert.equal(reads, 1);
}));

test('Inline pages batch repeated Ref labels once and retain paging, images and row policies', () => fixture((database, queries) => {
  database.exec(`
    INSERT INTO _tables(name,label) VALUES('parents','Parents'),('lines','Lines');
    INSERT INTO _columns(table_name,name,label,type,is_label,ref_table) VALUES
      ('parents','name','Name','text',1,NULL),
      ('lines','name','Name','text',1,NULL),
      ('lines','parent','Parent','ref',0,'parents'),
      ('lines','first','First','ref',0,'products'),
      ('lines','second','Second','ref',0,'products');
    CREATE TABLE t_parents(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT);
    INSERT INTO t_parents VALUES(1,'Parent');
    CREATE TABLE t_lines(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT,parent INTEGER,first INTEGER,second INTEGER);
    INSERT INTO _views(name,label,table_name,kind,position,inline_ref,columns_json,sort_dir)
      VALUES('lines_inline','Lines','lines','table','inline','parent','["name","first","second"]','asc');
  `);
  const insert = database.prepare('INSERT INTO t_lines(name,parent,first,second) VALUES(?,1,1,2)');
  for (let i = 1; i <= 23; i++) insert.run('Line ' + i);
  const query = new URLSearchParams({mode: 'related', owner: 'parents', id: '1', column: 'parent', view: 'lines_inline', limit: '10'});
  queries.length = 0;
  let result = listPage('lines', query);
  assert.equal(result.total, 23);
  assert.equal(result.rows.length, 10);
  assert.equal(result.rows[0].values.first__label, 'PRODUCT 1 · 1');
  assert.equal(result.rows[0].values.first__image, image);
  assert.equal(result.rows[0].values.second__label, 'PRODUCT 2 · 2');
  assert.equal(queries.filter(sql => sql.startsWith('SELECT * FROM "t_products"')).length, 1);
  assert.equal(queries.filter(sql => sql.includes('FROM _columns') && sql.includes("'products'")).length, 1);
  query.set('page', '3');
  result = listPage('lines', query);
  assert.equal(result.rows.length, 3);
  assert.equal(result.rows[0].id, 21);
  database.exec(`INSERT INTO _roles(name,label,builder) VALUES('staff','Staff',0);
    INSERT INTO _role_row_rules VALUES('staff','products','read','[branch] = "allowed"');`);
  const rights = {read: true, create: false, update: false, delete: false};
  runAuthorized({id: 2, name: 'Staff', email: 'staff@example.com', role: 'staff'}, {
    owner: false, builder: false, tables: {parents: rights, lines: rights, products: rights}, actions: []
  }, () => {
    const restricted = listPage('lines', query);
    assert.equal(restricted.rows[0].values.first__image, image);
    assert.equal(restricted.rows[0].values.second__label, undefined);
    assert.equal(restricted.rows[0].values.second__image, undefined);
    assert.equal(restricted.rows[0].permissions.update, false);
  });
}));
