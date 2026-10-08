const assert=require('node:assert/strict'),ExcelJS=require('exceljs');
const base=process.env.NOCODE_TEST_URL,cookie=process.env.NOCODE_TEST_COOKIE;
if(!base||!process.env.NOCODE_TEST_DB?.includes('integration-'))throw Error('Isolated runner required');
async function api(path,method='GET',body){const r=await fetch(base+path,{method,headers:{cookie,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});const j=await r.json();assert.ok(r.ok,JSON.stringify(j));return j;}
async function transfer(rows,phase='preview',mode='append'){const w=new ExcelJS.Workbook(),s=w.addWorksheet('Data');rows.forEach(row=>s.addRow(row));const f=new FormData();f.set('file',new Blob([await w.xlsx.writeBuffer()]),'codes.xlsx');f.set('phase',phase);f.set('mode',mode);const r=await fetch(base+'/api/excel/codes',{method:'POST',headers:{cookie},body:f});const j=await r.json();assert.ok(r.ok,JSON.stringify(j));return j;}
(async()=>{
await api('/api/tables','POST',{name:'codes',label:'Codes',columns:[{name:'code',label:'Code',type:'text',required:1},{name:'notes',label:'Notes',type:'longtext'}]});
const rows=[['code','notes'],[610005,123],[610006,456],[610007,789],[610008,0],['001234','001234']];
let report=await transfer(rows);assert.equal(report.valid,true,JSON.stringify(report));assert.equal(report.samples[0].code,'610005');assert.equal(report.samples[0].notes,'123');assert.equal((await api('/api/data/codes')).length,0);
report=await transfer(rows,'commit');assert.equal(report.committed,true,JSON.stringify(report));let saved=await api('/api/data/codes');assert.deepEqual(saved.map(r=>r.code).sort(),['001234','610005','610006','610007','610008']);assert.ok(saved.every(r=>typeof r.code==='string'&&typeof r.notes==='string'));
const id=saved.find(r=>r.code==='610005').id;report=await transfer([['id','code'],[id,610009]],'commit','update');assert.equal(report.committed,true);assert.equal((await api('/api/data/codes?id='+id))[0].code,'610009');
report=await transfer([['code'],[999],[{formula:'1+1',result:2}]],'commit');assert.equal(report.valid,false);assert.match(report.issues[0].message,/สูตร Excel/);assert.equal((await api('/api/data/codes')).length,5);
const Database=require('better-sqlite3'),db=new Database(process.env.NOCODE_TEST_DB,{readonly:true});assert.equal(db.prepare('SELECT typeof(code) AS kind FROM t_codes WHERE id=?').get(id).kind,'text');db.close();
console.log('PASS: numeric Excel cells import as text/longtext, 610005–610008, leading zeros in text, preview rollback, update, formula rejection, atomic rollback and SQLite TEXT storage');
})().catch(e=>{console.error(e);process.exitCode=1;});
