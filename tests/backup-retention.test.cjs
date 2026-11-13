const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const retention=require('../.test-build/backup-retention');
function fixture(work){const root=fs.mkdtempSync(path.join(os.tmpdir(),'backup-retention-')),source=path.join(root,'data.db'),folder=path.join(root,'backups');fs.mkdirSync(folder);const now=Date.now();const add=(kind,age,bytes=10)=>{const name='data.backup-'+kind+'-2026-01-01T00-00-00-000Z-'+crypto.randomUUID()+'.db',file=path.join(folder,name);fs.writeFileSync(file,Buffer.alloc(bytes));fs.utimesSync(file,new Date(now-age*86400000),new Date(now-age*86400000));return name;};try{return work({root,source,folder,now,add});}finally{fs.rmSync(root,{recursive:true,force:true});}}
test('retention defaults disabled and protects manual, newest and latest per kind',()=>fixture(({source,now,add})=>{
 const recent=[add('schema',1),add('schema',2),add('schema',3)],old=[add('schema',10),add('schema',20)],restore=add('restore',30),manual=add('manual',60);
 const review=retention.previewBackupRetention(source,now);assert.equal(review.policy.enabled,false);assert.deepEqual(new Set(review.candidates.map(f=>f.name)),new Set(old));assert.equal(review.reclaimableBytes,20);assert.ok(!review.candidates.some(f=>[...recent,restore,manual].includes(f.name)));
 assert.equal(retention.runAutomaticBackupRetention(source,now).status,'disabled');
}));
test('manual cleanup requires owner-bound preview and exact confirmation, executes once and leaves newest/manual files',()=>fixture(({source,now,add,folder})=>{
 add('schema',1);add('schema',2);add('schema',3);const old=add('schema',10),manual=add('manual',20);
 const p=retention.createBackupCleanupPreview(source,1,now);
 assert.throws(()=>retention.executeBackupCleanup(source,2,p.token,'ล้างไฟล์สำรอง',now),/สิทธิ์/);
 assert.throws(()=>retention.executeBackupCleanup(source,1,p.token,'',now),/ยืนยัน/);
 const r=retention.executeBackupCleanup(source,1,p.token,'ล้างไฟล์สำรอง',now);assert.equal(r.deleted,1);assert.equal(r.freedBytes,10);assert.ok(!fs.existsSync(path.join(folder,old)));assert.ok(fs.existsSync(path.join(folder,manual)));
 assert.deepEqual(retention.executeBackupCleanup(source,1,p.token,'ล้างไฟล์สำรอง',now),r);
}));
test('file or policy changes invalidate preview before deletion',()=>fixture(({source,now,add,folder})=>{
 add('schema',1);add('schema',2);add('schema',3);const old=add('schema',10);const p=retention.createBackupCleanupPreview(source,1,now);add('manual',1);
 assert.throws(()=>retention.executeBackupCleanup(source,1,p.token,'ล้างไฟล์สำรอง',now),/เปลี่ยน/);assert.ok(fs.existsSync(path.join(folder,old)));
 const next=retention.createBackupCleanupPreview(source,1,now);retention.saveBackupRetentionPolicy(source,{...next.policy,days:14},1);
 assert.throws(()=>retention.executeBackupCleanup(source,1,next.token,'ล้างไฟล์สำรอง',now),/เปลี่ยน/);
}));
test('count/size limits are soft around protected files and do not delete recent/in-progress or unrelated paths',()=>fixture(({source,now,add,folder})=>{
 add('schema',1);add('schema',2);add('schema',3);const extra=add('schema',4,20);const manual=add('manual',50,30);const fresh=add('schema',0,40);fs.writeFileSync(path.join(folder,'unrelated.db'),'keep');fs.writeFileSync(path.join(folder,'data.backup-schema-pending.db.partial'),'keep');
 retention.saveBackupRetentionPolicy(source,{enabled:false,days:7,keepLatest:3,maxAutomaticFiles:1,maxAutomaticMB:0},1);
 const p=retention.previewBackupRetention(source,now);assert.ok(p.candidates.some(f=>f.name===extra));assert.ok(!p.candidates.some(f=>[fresh,manual,'unrelated.db'].includes(f.name)));assert.equal(p.limitExceeded,true);
}));

test('automatic retention runs only after explicit enable and records reclaimed bytes',()=>fixture(({source,now,add,folder})=>{
 add('schema',1);add('schema',2);add('schema',3);const old=add('schema',8),manual=add('manual',40),unknown=add('legacy',40);
 retention.saveBackupRetentionPolicy(source,{...retention.DEFAULT_BACKUP_RETENTION,enabled:true},1);
 const result=retention.runAutomaticBackupRetention(source,now);assert.equal(result.deleted,1);assert.equal(result.freedBytes,10);assert.equal(result.status,'completed');assert.ok(!fs.existsSync(path.join(folder,old)));assert.ok(fs.existsSync(path.join(folder,manual)));assert.ok(fs.existsSync(path.join(folder,unknown)));assert.equal(retention.backupRetentionOverview(source).lastRun.deleted,1);
 assert.equal(retention.runAutomaticBackupRetention(source,now).deleted,0);
}));
test('expired previews and active publication never delete candidates',()=>fixture(({source,root,now,add,folder})=>{
 add('schema',1);add('schema',2);add('schema',3);const old=add('schema',8),p=retention.createBackupCleanupPreview(source,1,now);
 assert.throws(()=>retention.executeBackupCleanup(source,1,p.token,'ล้างไฟล์สำรอง',now+11*60000),e=>e.status===409);
 const Database=require('better-sqlite3');fs.mkdirSync(path.join(root,'.app-releases'));const q=new Database(path.join(root,'.app-releases','publications.db'));q.exec('CREATE TABLE attempts(status TEXT,lease_until INTEGER)');q.prepare('INSERT INTO attempts VALUES(?,?)').run('preparing',now+60000);q.close();
 assert.throws(()=>retention.executeBackupCleanup(source,1,p.token,'ล้างไฟล์สำรอง',now),e=>e.status===409);assert.ok(fs.existsSync(path.join(folder,old)));
 retention.saveBackupRetentionPolicy(source,{...retention.DEFAULT_BACKUP_RETENTION,enabled:true},1);assert.equal(retention.runAutomaticBackupRetention(source,now).status,'skipped');assert.ok(fs.existsSync(path.join(folder,old)));
}));
test('invalid policies fail before saving and size cap protects mandatory recovery points',()=>fixture(({source,now,add})=>{
 for(const change of [{days:0},{keepLatest:0},{maxAutomaticMB:-1},{enabled:'yes'},{days:1.2}])assert.throws(()=>retention.saveBackupRetentionPolicy(source,{...retention.DEFAULT_BACKUP_RETENTION,...change},1));
 const latest=[add('schema',1,1024**2),add('schema',2,1024**2),add('schema',3,1024**2)],extra=add('schema',4,1024**2);
 retention.saveBackupRetentionPolicy(source,{...retention.DEFAULT_BACKUP_RETENTION,maxAutomaticMB:1},1);const r=retention.previewBackupRetention(source,now);assert.deepEqual(r.candidates.map(f=>f.name),[extra]);assert.equal(r.limitExceeded,true);assert.ok(!r.candidates.some(f=>latest.includes(f.name)));
}));
