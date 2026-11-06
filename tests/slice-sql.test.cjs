const {test}=require('node:test');const assert=require('node:assert/strict');const Database=require('better-sqlite3');
const {sliceSql}=require('../.test-build/slice-sql');const {evaluateExpression,asBoolean}=require('../.test-build/expression');
const cols=[{name:'status',type:'text'},{name:'qty',type:'decimal'},{name:'flag',type:'yesno'},{name:'owner',type:'text'},{name:'computed',type:'number',is_virtual:true}];
test('Slice SQL matches evaluator for supported predicates and binds literals',()=>{
 const db=new Database(':memory:');db.exec('CREATE TABLE rows(id INTEGER,status TEXT,qty REAL,flag INTEGER,owner TEXT)');const rows=[{id:1,status:'open',qty:2,flag:1,owner:'test@example.test'},{id:2,status:null,qty:null,flag:0,owner:null},{id:3,status:'',qty:0,flag:null,owner:''},{id:4,status:"O'Reilly",qty:-2,flag:1,owner:'other'}];for(const r of rows)db.prepare('INSERT INTO rows VALUES(@id,@status,@qty,@flag,@owner)').run(r);
 for(const expr of ['TRUE','FALSE','[status]="open"','[status]<>"open"','[status]=""','[qty]=2','[qty]="2"','[qty]>=0','[qty]<-1','[flag]=TRUE','[flag]=FALSE','[flag]','NOT([flag]=TRUE)','AND([qty]>=0,[flag]=TRUE)','OR(ISBLANK([status]),[owner]=USEREMAIL())','ISNOTBLANK([status])','[status]="O\'Reilly"']){const plan=sliceSql(expr,cols,'test@example.test');assert.ok(plan,expr);const actual=db.prepare('SELECT id FROM rows WHERE '+plan.where).all(...plan.args).map(r=>r.id);const expected=rows.filter(r=>asBoolean(evaluateExpression(expr,r,{userEmail:'test@example.test'}))).map(r=>r.id);assert.deepEqual(actual,expected,expr);}
 db.close();
});
test('Unsupported Slice expressions fall back as a whole',()=>{for(const expr of ['[computed]>0','[status]>"a"','[owner].[name]="a"','TODAY()=DATE("2026-01-01")','AND([qty]>0,[computed]>0)','IN([status],LIST("a"))','[missing]=1'])assert.equal(sliceSql(expr,cols,''),null,expr);});
test('Static enum options and invalid yes/no values keep tolerant-read semantics',()=>{
 const db=new Database(':memory:');db.exec("CREATE TABLE rows(id INTEGER,status TEXT,flag INTEGER); INSERT INTO rows VALUES(1,'open',1),(2,'invalid',2),(3,NULL,NULL)");
 const columns=[{name:'status',type:'enum',options:"open,O'Reilly"},{name:'flag',type:'yesno'}];
 for(const [expr,expected]of [['[status]="open"',[1]],['ISBLANK([status])',[2,3]],['[status]<>"open"',[2,3]],['ISBLANK([flag])',[2,3]]]){const plan=sliceSql(expr,columns,'');assert.ok(plan);assert.deepEqual(db.prepare('SELECT id FROM rows WHERE '+plan.where).all(...plan.args).map(r=>r.id),expected,expr);}db.close();
});
test('Date and relationship expressions use interpreter fallback',()=>{
 const columns=[...cols,{name:'day',type:'date'},{name:'moment',type:'datetime'},{name:'ref',type:'ref',ref_table:'other'}];
 for(const source of ['[day]="2026-01-01"','[moment]>NOW()','[ref].[name]="open"'])assert.equal(sliceSql(source,columns,''),null);
 assert.ok(sliceSql('[ref]=2',columns,''));
});
