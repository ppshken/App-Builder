const Database=require('better-sqlite3'),assert=require('node:assert/strict');
const {initializeDatabase}=require('../.test-build/schema'),{withDatabase}=require('../.test-build/db'),{expressionContext}=require('../.test-build/expression-context');
const db=new Database(':memory:');
try{
 initializeDatabase(db,':memory:');
 db.exec("INSERT INTO _tables(name,label) VALUES('repeat_ref','Ref');INSERT INTO _columns(table_name,name,label,type) VALUES('repeat_ref','amount','Amount','number');CREATE TABLE t_repeat_ref(id INTEGER PRIMARY KEY,amount INTEGER);INSERT INTO t_repeat_ref VALUES(1,42)");
 const original=db.prepare;let checks=0;
 db.prepare=function(sql){if(sql==='SELECT 1 FROM _tables WHERE name=?')checks++;return original.call(this,sql);};
 const times=[];let last;
 for(let trial=-1;trial<5;trial++){
  checks=0;const start=performance.now();
  withDatabase(db,()=>{const ctx=expressionContext(new Date(),'',db);for(let i=0;i<10000;i++)assert.equal(ctx.getReferenceTable('repeat_ref','amount',1).rows[0].amount,42);});
  if(trial>=0)times.push(performance.now()-start);last=checks;
 }
 console.log(JSON.stringify({reads:10000,metadataQueries:last,timingsMs:times,medianMs:[...times].sort((a,b)=>a-b)[2]}));
}finally{db.close();}
