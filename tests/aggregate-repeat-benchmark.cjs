const Database=require('better-sqlite3'),assert=require('node:assert/strict');
const {initializeDatabase,readColumns}=require('../.test-build/schema');
const {withDatabase}=require('../.test-build/db');
const {expressionContext}=require('../.test-build/expression-context');
const {calculateRow}=require('../.test-build/columns');
const db=new Database(':memory:');
try{
 initializeDatabase(db,':memory:');
 db.exec("INSERT INTO _tables(name,label) VALUES('agg_rows','Rows');INSERT INTO _columns(table_name,name,label,type,is_virtual,virtual_expr) VALUES('agg_rows','amount','Amount','number',0,NULL),('agg_rows','counted','Counted','number',1,'COUNT(agg_rows[id])');CREATE TABLE t_agg_rows(id INTEGER PRIMARY KEY,amount INTEGER);WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM n WHERE x<10000) INSERT INTO t_agg_rows SELECT x,1 FROM n");
 const original=db.prepare,columns=readColumns(db,'agg_rows'),now=new Date();let probes=0,metadata=0;
 db.prepare=function(sql){if(sql==='SELECT 1 FROM _tables WHERE name=?')metadata++;if(sql==='SELECT 1 FROM "t_agg_rows" LIMIT 1')probes++;return original.call(this,sql);};
 const trials=[];let lastProbes;
 for(let trial=-1;trial<5;trial++){
  probes=0;metadata=0;const start=performance.now();
  withDatabase(db,()=>{const context=expressionContext(now,'',db);for(let row=1;row<=1000;row++)assert.equal(calculateRow(columns,{id:row,amount:1},false,now,false,'',context).row.counted,10000);});
  if(trial>=0)trials.push(performance.now()-start);lastProbes=probes;
 }
 console.log(JSON.stringify({evaluatedRows:1000,sourceRows:10000,existenceQueries:lastProbes,metadataQueries:metadata,timingsMs:trials,medianMs:[...trials].sort((a,b)=>a-b)[2]}));
}finally{db.close();}
