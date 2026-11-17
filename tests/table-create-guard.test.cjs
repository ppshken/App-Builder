const {test}=require('node:test'),assert=require('node:assert/strict'),Database=require('better-sqlite3');
const {initializeDatabase}=require('../.test-build/schema'),{withDatabase}=require('../.test-build/db'),{runAuthorized,accessFor}=require('../.test-build/permissions'),{validateCreateGuard,tableCreateEligibility,assertTableCreateAllowed,DEFAULT_CREATE_ERROR}=require('../.test-build/table-create-guard'),{errorStatus}=require('../.test-build/api');
test('เงื่อนไขเพิ่มใช้บัญชีและ SELECT ได้ แต่ไม่อ้างแถวที่ยังไม่มีหรือค่าผู้ใช้แก้เอง',()=>{
 assert.equal(validateCreateGuard(' COUNT(SELECT(guard_jobs[id], [inspector] = USERID())) = 0 ',' ข้อความ ').create_error,'ข้อความ');
 for(const source of ['[status] = 1','COUNT([Related_guard_jobs]) = 0','USERSETTINGS("branch") = 1'])assert.throws(()=>validateCreateGuard(source,''));
 assert.throws(()=>validateCreateGuard('TRUE','x'.repeat(501)));assert.throws(()=>validateCreateGuard('TRUE'.repeat(1001),''));assert.deepEqual(validateCreateGuard('  ',''),{create_if:'',create_error:''});
});
test('ตรวจงานค้างตามบัญชี ไม่ข้ามเจ้าของ และประเมินใหม่เมื่อข้อมูลเปลี่ยน',()=>{
 const db=new Database(':memory:');initializeDatabase(db,':memory:');db.exec("INSERT INTO _tables(name,label) VALUES('guard_jobs','งานทดสอบ'); INSERT INTO _columns(table_name,name,label,type) VALUES('guard_jobs','inspector','ผู้ตรวจ','number'),('guard_jobs','status','สถานะ','number');CREATE TABLE t_guard_jobs(id INTEGER PRIMARY KEY,inspector INTEGER,status INTEGER)");
 const actor={id:1,email:'fixture@example.test',name:'Fixture',role:'owner'};
 try{withDatabase(db,()=>runAuthorized(actor,accessFor(actor),()=>{
  assert.equal(tableCreateEligibility('guard_jobs').allowed,true);const source='COUNT(SELECT(guard_jobs[id], AND([inspector] = USERID(), IN([status], LIST(1,2))))) = 0';db.prepare('UPDATE _tables SET create_if=? WHERE name=?').run(source,'guard_jobs');
  db.prepare('INSERT INTO t_guard_jobs VALUES(1,2,1)').run();assert.equal(tableCreateEligibility('guard_jobs').allowed,true);db.prepare('INSERT INTO t_guard_jobs VALUES(2,1,2)').run();assert.deepEqual(tableCreateEligibility('guard_jobs'),{allowed:false,message:DEFAULT_CREATE_ERROR});assert.throws(()=>assertTableCreateAllowed('guard_jobs'),e=>errorStatus(e)===422);
  db.prepare('UPDATE t_guard_jobs SET status=3 WHERE id=2').run();assert.equal(tableCreateEligibility('guard_jobs').allowed,true);db.prepare("UPDATE _tables SET create_if='1 / 0'").run();assert.deepEqual(tableCreateEligibility('guard_jobs'),{allowed:false,message:'ตรวจเงื่อนไขเพิ่มข้อมูลไม่สำเร็จ กรุณาติดต่อผู้ดูแลระบบ'});
 }));}finally{db.close();}
});
