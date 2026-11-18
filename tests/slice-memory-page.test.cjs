const {test}=require('node:test'),assert=require('node:assert/strict'),Database=require('better-sqlite3');
const {initializeDatabase,readColumns}=require('../.test-build/schema'),{withDatabase}=require('../.test-build/db'),{expressionContext}=require('../.test-build/expression-context'),{readRows,withReferenceLabels}=require('../.test-build/view-records');
test('virtual Slice filters and sorts before preparing full rows without changing the page or errors',()=>{
 const {sliceMemoryPage}=require('../.test-build/slice-memory-page'),d=new Database(':memory:');try{initializeDatabase(d,':memory:');withDatabase(d,()=>{
 d.exec(`INSERT INTO _tables(name,label) VALUES('slice_page','Rows');CREATE TABLE t_slice_page(id INTEGER PRIMARY KEY,title TEXT,amount INTEGER);
 INSERT INTO _columns(table_name,name,label,type,is_virtual,virtual_expr,is_label) VALUES('slice_page','title','Title','text',0,NULL,1),('slice_page','amount','Amount','number',0,NULL,0),('slice_page','eligible','Eligible','yesno',1,'[amount]>5',0),('slice_page','broken','Broken','number',1,'1/0',0);`);
 const insert=d.prepare('INSERT INTO t_slice_page VALUES(?,?,?)');for(let i=1;i<=60;i++)insert.run(i,'Row '+i,i%10);
 const cols=readColumns(d,'slice_page'),raw=d.prepare('SELECT * FROM t_slice_page').all(),now=new Date('2026-11-18T00:00:00Z'),ctx=expressionContext(now,'',d),page=sliceMemoryPage('slice_page',cols,'[eligible]',raw,now,'',ctx,{page:2,size:10,sort:'id',direction:-1,filters:[]});
 const actual=readRows('slice_page',cols,now,'',ctx,page.rawRows,undefined,page.prepared);
 const expected=readRows('slice_page',cols,now,'',expressionContext(now,'',d),raw).filter(r=>r.eligible).sort((a,b)=>b.id-a.id).slice(10,20);
 assert.equal(page.total,24);assert.equal(page.page,2);assert.deepEqual(actual,expected);assert.ok([...page.prepared.values()].every(p=>!Object.hasOwn(p.row,'broken')));assert.ok(actual.every(r=>r.__errors.broken));
 const last=sliceMemoryPage('slice_page',cols,'[eligible]',raw,now,'',ctx,{page:99,size:10,sort:'amount',direction:1,filters:[{column:'amount',op:'gte',value:'8'}]});assert.equal(last.page,2);assert.equal(last.total,12);assert.equal(last.rawRows.length,2);
 });}finally{d.close();}
});
test('Slice filtering preserves volatile values for the selected page and applies row permissions first',()=>{
 const {sliceMemoryPage}=require('../.test-build/slice-memory-page'),{runAuthorized}=require('../.test-build/permissions'),d=new Database(':memory:');try{initializeDatabase(d,':memory:');withDatabase(d,()=>{
 d.exec(`INSERT INTO _tables(name,label) VALUES('slice_tokens','Tokens');CREATE TABLE t_slice_tokens(id INTEGER PRIMARY KEY,title TEXT);INSERT INTO t_slice_tokens VALUES(1,'One'),(2,'Two'),(3,'Three');INSERT INTO _columns(table_name,name,label,type,is_virtual,virtual_expr) VALUES('slice_tokens','title','Title','text',0,NULL),('slice_tokens','token','Token','text',1,'UNIQUEID()');INSERT INTO _roles(name,label,builder) VALUES('slice_reader','Reader',0);INSERT INTO _role_row_rules VALUES('slice_reader','slice_tokens','read','[id]>1');`);
 const cols=readColumns(d,'slice_tokens'),raw=d.prepare('SELECT * FROM t_slice_tokens').all(),now=new Date();runAuthorized({id:9,name:'Reader',email:'reader@example.test',role:'slice_reader'},{owner:false,builder:false,tables:{slice_tokens:{read:true,create:false,update:false,delete:false}},actions:[]},()=>{const ctx=expressionContext(now,'',d),p=sliceMemoryPage('slice_tokens',cols,'ISNOTBLANK([token])',raw,now,'',ctx,{page:1,size:10,sort:'id',direction:1,filters:[]}),rows=readRows('slice_tokens',cols,now,'',ctx,p.rawRows,undefined,p.prepared);assert.equal(p.total,2);assert.deepEqual(rows.map(r=>r.id),[2,3]);for(const r of rows)assert.equal(r.token,p.prepared.get(r.id).row.token);});
 });}finally{d.close();}
});
