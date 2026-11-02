const {test:baseTest}=require('node:test'),assert=require('node:assert/strict');
const test=(name,run)=>baseTest(name,{skip:process.platform==='win32'?'POSIX deployment helpers; run in Linux/WSL':false},run);
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process'),Database=require('better-sqlite3');
const repo=path.resolve(__dirname,'..');
function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'app-builder-deployment-'));
 let db;
 t.after(()=>{if(db?.open)db.close();fs.rmSync(root,{recursive:true,force:true});});
 const data=path.join(root,'data'),bin=path.join(root,'bin'),log=path.join(root,'calls.jsonl');fs.mkdirSync(data);fs.mkdirSync(bin);
 db=new Database(path.join(data,'data.db'));db.pragma('journal_mode=WAL');db.pragma('wal_autocheckpoint=0');
 db.exec("CREATE TABLE _tables(name TEXT PRIMARY KEY); INSERT INTO _tables VALUES('synthetic_committed_in_wal')");
 fs.mkdirSync(path.join(data,'uploads'));fs.writeFileSync(path.join(data,'uploads','fixture.bin'),Buffer.from([0,1,2,255]));
 fs.mkdirSync(path.join(data,'.app-releases'));fs.writeFileSync(path.join(data,'.app-releases','fixture.json'),'{}');
 const archive=path.join(root,'fixture.tar.gz');assert.equal(spawnSync('tar',['-czf',archive,'-C',data,'.']).status,0);
 const mock=`#!/usr/bin/env node
const fs=require('node:fs'),a=process.argv.slice(2);fs.appendFileSync(process.env.MOCK_LOG,JSON.stringify(a)+String.fromCharCode(10));
if(a[0]==='compose'){
 const c=a[5];if(c==='ps'){if(process.env.MOCK_NO_APP!=='1'&&!(a.includes('--status')&&process.env.MOCK_STOPPED==='1'))console.log('synthetic-container');}
 else if(c==='stop')process.exit(0);
 else if(c==='start')process.exit(process.env.MOCK_RESTART_FAIL==='1'?7:0);
 else if(c==='run'){if(process.env.MOCK_TAR_FAIL==='1'){process.stdout.write('partial');process.exit(8);}process.stdout.write(fs.readFileSync(process.env.MOCK_ARCHIVE));}
 else process.exit(99);
}else if(a[0]==='image'&&a[1]==='inspect')console.log('[]');
else if(a[0]==='volume'&&a[1]==='inspect')process.exit(process.env.MOCK_VOLUME_EXISTS==='1'?0:1);
else if(a[0]==='volume'&&['create','rm'].includes(a[1]))console.log(a.at(-1));
else if(a[0]==='run')process.stdin.resume();
else process.exit(99);
`;
 fs.writeFileSync(path.join(root,'mock.cjs'),mock);
 fs.writeFileSync(path.join(bin,'docker'),'#!/bin/sh\nexec \"$MOCK_NODE\" -- \"$MOCK_SCRIPT\" \"$@\"\n',{mode:0o700});
 const env={...process.env,PATH:bin+path.delimiter+process.env.PATH,MOCK_NODE:process.execPath,MOCK_SCRIPT:path.join(root,'mock.cjs'),MOCK_LOG:log,MOCK_ARCHIVE:archive};
 return {root,data,bin,archive,env,calls:()=>fs.existsSync(log)?fs.readFileSync(log,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse):[]};
}
function shell(script,args=[],env=process.env){return spawnSync('sh',[path.join(repo,script),...args],{cwd:repo,env,encoding:'utf8'});}
test('deployment shell scripts parse; startup forwards the real Next CLI arguments with a private umask',t=>{
 for(const p of ['deploy/start-app.sh','deploy/backup.sh','deploy/restore-drill.sh'])assert.equal(spawnSync('sh',['-n',path.join(repo,p)]).status,0,p);
 const f=fixture(t),probe=path.join(f.root,'probe');
 fs.writeFileSync(path.join(f.bin,'node'),'#!/bin/sh\nprintf "%s\\n" "$@"\nprintf private > "$PROBE_FILE"\n',{mode:0o700});
 const result=shell('deploy/start-app.sh',[],{...f.env,HOSTNAME:'127.0.0.1',PORT:'43210',PROBE_FILE:probe});
 assert.equal(result.status,0,result.stderr);assert.deepEqual(result.stdout.trim().split('\n'),['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','43210']);assert.equal(fs.statSync(probe).mode&0o777,0o600);
 const defaults=shell('deploy/start-app.sh',[],{...f.env,HOSTNAME:'',PORT:'',PROBE_FILE:probe});assert.equal(defaults.status,0,defaults.stderr);assert.deepEqual(defaults.stdout.trim().split(String.fromCharCode(10)).slice(-4),['--hostname','0.0.0.0','--port','3000']);
});
test('cold archive keeps committed WAL data, upload bytes and draft files in an independent restore',t=>{
 const f=fixture(t),restore=path.join(f.root,'restore');fs.mkdirSync(restore);
 assert(fs.existsSync(path.join(f.data,'data.db-wal')));assert.equal(spawnSync('tar',['-xzf',f.archive,'-C',restore]).status,0);
 assert(fs.existsSync(path.join(restore,'data.db-wal')));
 const copy=new Database(path.join(restore,'data.db'),{readonly:true,fileMustExist:true});
 assert.equal(copy.prepare('SELECT name FROM _tables').get().name,'synthetic_committed_in_wal');assert.equal(copy.pragma('integrity_check',{simple:true}),'ok');assert.equal(copy.pragma('foreign_key_check').length,0);copy.close();
 assert.deepEqual(fs.readFileSync(path.join(restore,'uploads','fixture.bin')),Buffer.from([0,1,2,255]));assert(fs.existsSync(path.join(restore,'.app-releases','fixture.json')));
});
test('backup helper uses cold tar without TTY, creates a private archive and resumes the same app',t=>{
 const f=fixture(t),out=path.join(f.root,'backups');const r=shell('deploy/backup.sh',['synthetic.env',out],f.env);assert.equal(r.status,0,r.stderr);
 const archives=fs.readdirSync(out).filter(n=>n.endsWith('.tar.gz'));assert.equal(archives.length,1);assert.equal(fs.statSync(path.join(out,archives[0])).mode&0o777,0o600);
 const calls=f.calls();assert.deepEqual(calls.map(a=>a[5]),['ps','ps','stop','run','start']);assert(calls[3].includes('-T'));assert(!calls.some(a=>a.includes('down')||a.includes('--volumes')));
});
test('backup restart failure is reported, and tar failure still resumes without publishing a broken archive',t=>{
 const f=fixture(t),out=path.join(f.root,'backups');const restart=shell('deploy/backup.sh',['synthetic.env',out],{...f.env,MOCK_RESTART_FAIL:'1'});assert.notEqual(restart.status,0);assert.match(restart.stderr,/could not restart/);
 const failedOut=path.join(f.root,'failed');const failure=shell('deploy/backup.sh',['synthetic.env',failedOut],{...f.env,MOCK_TAR_FAIL:'1'});assert.notEqual(failure.status,0);assert.equal(fs.readdirSync(failedOut).filter(n=>n.endsWith('.tar.gz')).length,0);assert.equal(f.calls().at(-1)[5],'start');
});
test('backup helper never starts an originally stopped app and refuses an absent app',t=>{
 const f=fixture(t);assert.equal(shell('deploy/backup.sh',['synthetic.env',path.join(f.root,'stopped')],{...f.env,MOCK_STOPPED:'1'}).status,0);assert(!f.calls().some(a=>a[5]==='start'));
 const before=f.calls().length;assert.notEqual(shell('deploy/backup.sh',['synthetic.env',path.join(f.root,'absent')],{...f.env,MOCK_NO_APP:'1'}).status,0);assert.equal(f.calls().length,before+1);
});
test('restore drill targets only a generated disposable volume, without network, app startup or production mounts',t=>{
 const f=fixture(t),r=shell('deploy/restore-drill.sh',[f.archive,'synthetic-image:local'],f.env);assert.equal(r.status,0,r.stderr);
 const calls=f.calls(),create=calls.find(a=>a[0]==='volume'&&a[1]==='create'),name=create.at(-1);assert.match(name,/^nocode-restore-drill-/);
 const runs=calls.filter(a=>a[0]==='run');assert.equal(runs.length,2);for(const a of runs){assert(a.includes('none'));assert(a.includes('--read-only'));assert(a.includes('1000:1000'));assert(a.includes('type=volume,source='+name+',target=/data'));}
 assert.deepEqual(calls.at(-1),['volume','rm',name]);assert(!calls.some(a=>a[0]==='compose'||a.includes('start')||a.includes('up')||a.includes('stop')));
});
test('restore drill refuses an existing target and unsafe archives without deleting anything',t=>{
 const f=fixture(t);assert.notEqual(shell('deploy/restore-drill.sh',[f.archive,'synthetic-image:local'],{...f.env,MOCK_VOLUME_EXISTS:'1'}).status,0);assert(!f.calls().some(a=>a[0]==='run'||a[1]==='rm'||a[1]==='create'));
 const unsafe=path.join(f.root,'link.tar.gz');fs.symlinkSync('/etc/passwd',path.join(f.data,'unsafe-link'));assert.equal(spawnSync('tar',['-czf',unsafe,'-C',f.data,'.']).status,0);const before=f.calls().length;assert.notEqual(shell('deploy/restore-drill.sh',[unsafe,'synthetic-image:local'],f.env).status,0);assert.equal(f.calls().length,before);
});
