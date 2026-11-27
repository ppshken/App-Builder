// Uses an isolated in-memory database; requires compiled test modules.
const Database=require('better-sqlite3'),assert=require('node:assert/strict'),fs=require('node:fs');
const {initializeDatabase}=require('../.test-build/schema');
const {withDatabase}=require('../.test-build/db');
const {expressionContext}=require('../.test-build/expression-context');
const database=new Database(':memory:');
try{
 initializeDatabase(database,':memory:');
 database.exec("INSERT INTO _tables(name,label) VALUES('bench_parent','Parent'),('bench_child','Child');CREATE TABLE t_bench_parent(id INTEGER PRIMARY KEY);");
 const extras=Array.from({length:20},(_,i)=>'extra_'+i);
 database.exec('CREATE TABLE t_bench_child(id INTEGER PRIMARY KEY,parent_id INTEGER,amount REAL,'+extras.map(name=>name+' TEXT').join(',')+');CREATE INDEX bench_parent_index ON t_bench_child(parent_id)');
 const metadata=database.prepare('INSERT INTO _columns(table_name,name,label,type,ref_table) VALUES(?,?,?,?,?)');
 metadata.run('bench_child','parent_id','Parent','ref','bench_parent');
 metadata.run('bench_child','amount','Amount','number',null);
 for(const name of extras)metadata.run('bench_child',name,name,'text',null);
 const insert=database.prepare('INSERT INTO t_bench_child VALUES('+Array(23).fill('?').join(',')+')');
 database.transaction(()=>{for(let id=1;id<=20000;id++)insert.run(id,Math.ceil(id/200),1,...extras.map(()=> 'x'.repeat(256)));})();
 const original=database.prepare;
 const results=[];
 for(const mode of ['before','after']){
  database.prepare=function(sql){
   if(mode==='before'&&sql.includes('FROM "t_bench_child" WHERE')&&sql.includes('json_each'))sql=sql.replace(/^SELECT .*? FROM /,'SELECT * FROM ');
   return original.call(this,sql);
  };
  const timings=[];
  for(let trial=-1;trial<5;trial++){
   const start=performance.now();let total=0;
   withDatabase(database,()=>{
    const context=expressionContext(new Date(),'',database);
    for(let parent=1;parent<=100;parent++){
     const rows=context.getRelatedTable('bench_child','amount',{ownerTable:'bench_parent',parentIds:[parent],columns:[]}).rows;
     assert.equal(rows.length,200);
     total+=rows.reduce((sum,row)=>sum+row.amount,0);
    }
   });
   assert.equal(total,20000);
   if(trial>=0)timings.push(performance.now()-start);
  }
  results.push({mode,timingsMs:timings,medianMs:[...timings].sort((a,b)=>a-b)[2]});
 }
 database.prepare=original;
 const report={childRows:20000,parents:100,unusedTextColumns:20,textBytesPerColumn:256,trials:5,results,speedup:results[0].medianMs/results[1].medianMs};
 console.log(JSON.stringify(report,null,2));
 if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2));
}finally{database.close();}
