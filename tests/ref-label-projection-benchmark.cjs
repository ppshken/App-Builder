const Database=require('better-sqlite3'),assert=require('node:assert/strict');
const {initializeDatabase}=require('../.test-build/schema'),{withDatabase}=require('../.test-build/db'),{withReferenceLabels}=require('../.test-build/reference-labels');
const db=new Database(':memory:');
try{
 initializeDatabase(db,':memory:');
 const extras=Array.from({length:20},(_,i)=>'extra_'+i);
 db.exec("INSERT INTO _tables(name,label) VALUES('label_items','Items');INSERT INTO _columns(table_name,name,label,type,is_label) VALUES('label_items','title','Title','text',1);CREATE TABLE t_label_items(id INTEGER PRIMARY KEY,title TEXT,"+extras.map(name=>name+' TEXT').join(',')+')');
 const insert=db.prepare('INSERT INTO t_label_items VALUES('+Array(22).fill('?').join(',')+')');
 db.transaction(()=>{for(let id=1;id<=500;id++)insert.run(id,'Item '+id,...extras.map(()=> 'x'.repeat(1024)));})();
 const now=new Date(),columns=[{name:'item',label:'Item',type:'ref',ref_table:'label_items'}],times=[];
 for(let trial=-1;trial<5;trial++){
  const start=performance.now();
  withDatabase(db,()=>{for(let n=0;n<10;n++){
   const rows=Array.from({length:500},(_,i)=>({item:i+1}));
   const result=withReferenceLabels('orders',columns,rows,now,'');
   assert.equal(result[499].item__label,'Item 500');
  }});
  if(trial>=0)times.push(performance.now()-start);
 }
 console.log(JSON.stringify({rowsPerBatch:500,batches:10,unusedColumns:20,unusedBytesPerColumn:1024,timingsMs:times,medianMs:[...times].sort((a,b)=>a-b)[2]}));
}finally{db.close();}
