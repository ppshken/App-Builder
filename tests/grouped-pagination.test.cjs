const {test}=require('node:test'),assert=require('node:assert/strict'),Database=require('better-sqlite3');
const {parseGrouping,groupedSqlPage,groupedMemoryPage}=require('../.test-build/grouped-pagination'),{initializeDatabase,readColumns}=require('../.test-build/schema'),{withDatabase}=require('../.test-build/db'),{expressionContext}=require('../.test-build/expression-context');
test('grouped SQL pages agree with full grouping across empty values, direction, paths and page boundaries',()=>{
 const db=new Database(':memory:');try{initializeDatabase(db,':memory:');withDatabase(db,()=>{
 db.exec("INSERT INTO _tables(name,label) VALUES('group_items','Items');INSERT INTO _columns(table_name,name,label,type) VALUES('group_items','category','Category','text'),('group_items','status','Status','text');CREATE TABLE t_group_items(id INTEGER PRIMARY KEY,category TEXT,status TEXT)");
 const insert=db.prepare('INSERT INTO t_group_items VALUES(?,?,?)');db.transaction(()=>{for(let i=1;i<=137;i++)insert.run(i,i<5?null:i<10?'':i%2?'A':'B',i%3?'Open':'Done');})();
 const rows=db.prepare('SELECT * FROM t_group_items WHERE id>2 ORDER BY id DESC').all(),cols=readColumns(db,'group_items'),levels=[{column:'category',direction:'desc'},{column:'status',direction:'asc'}],ctx=expressionContext(new Date(),'',db);
 for(const path of [[],[JSON.stringify('A')],[JSON.stringify('A'),JSON.stringify('Open')],[JSON.stringify(null)],['"missing"']])for(const page of [1,2,6,100]){
 const actual=groupedSqlPage('group_items',cols,levels,path,'id>?',[2],'id','DESC',page,10,new Date(),'',ctx),expected=groupedMemoryPage(rows,levels,path,cols,page,10);
 assert.deepEqual(actual.rows.map(r=>r.id),expected.rows.map(r=>r.id));assert.equal(actual.total,expected.total);assert.equal(actual.page,expected.page);assert.deepEqual(actual.group_path,expected.group_path);assert.equal(actual.group_total,135);assert.equal(actual.groups[0].count,expected.groups[0].count);assert.ok(actual.groups.every(g=>g.rows.length<=1));
 }
 });}finally{db.close();}
});
test('group API validates metadata identifiers, directions and path shape',()=>{
 const cols=[{name:'category',type:'text'}];for(const input of ['[]','null','[{"column":"bad","direction":"asc"}]','[{"column":"category","direction":"DROP"}]'])assert.throws(()=>parseGrouping(new URLSearchParams({group_by:input}),cols));
 assert.throws(()=>parseGrouping(new URLSearchParams({group_by:'[{"column":"category","direction":"asc"}]',group_path:'[1]'}),cols));
 assert.equal(parseGrouping(new URLSearchParams(),cols),null);
});
