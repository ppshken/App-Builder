// Real production CLI with a generated LOCAL synthetic DB. Never uses data.db,
// Docker, a production URL, or an existing volume. Bind loopback only.
const fs=require('node:fs'),path=require('node:path'),net=require('node:net'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..'),baseFolder=path.join(root,'.test-data');fs.mkdirSync(baseFolder,{recursive:true});
const folder=fs.mkdtempSync(path.join(baseFolder,'deployment-runtime-')),data=path.join(folder,'data');fs.mkdirSync(data,{mode:0o700});
const dbPath=path.join(data,'data.db'),checks=[];let child,output='',cookie='',base;
const record=name=>checks.push({name,status:'VERIFIED'});
async function freePort(){const s=net.createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const port=s.address().port;await new Promise(r=>s.close(r));return port;}
async function start(){
 const port=await freePort();base='http://127.0.0.1:'+port;
 child=spawn('sh',['deploy/start-app.sh'],{cwd:root,env:{...process.env,NODE_ENV:'production',HOSTNAME:'127.0.0.1',PORT:String(port),NOCODE_DB_PATH:dbPath,NOCODE_BUILD_DIR:'.next',NEXT_TELEMETRY_DISABLED:'1',NOCODE_WEBHOOK_ORIGINS:'',NOCODE_API_ORIGINS:'',NOCODE_API_CREDENTIALS:''},stdio:['ignore','pipe','pipe']});
 child.stdout.on('data',b=>{output+=b;});child.stderr.on('data',b=>{output+=b;});
 for(let i=0;i<150;i++){if(child.exitCode!==null)throw Error('Startup exited: '+output);try{const r=await fetch(base+'/api/health',{signal:AbortSignal.timeout(1000)});if(r.status===200)return;}catch{}await new Promise(r=>setTimeout(r,200));}
 throw Error('Production CLI did not become healthy');
}
async function stop(){if(!child||child.exitCode!==null)return;const stopped=new Promise(r=>child.once('exit',r));child.kill('SIGTERM');const timer=setTimeout(()=>child.kill('SIGKILL'),10000);await stopped;clearTimeout(timer);}
async function request(url,method='GET',body,status=200,extra={}){
 const form=body instanceof FormData;const response=await fetch(base+url,{method,headers:{cookie,...(body===undefined||form?{}:{'Content-Type':'application/json'}),...extra},body:body===undefined?undefined:form?body:JSON.stringify(body)});
 assert.equal(response.status,status,url+' HTTP status');return response;
}
async function api(...args){return (await request(...args)).json();}
async function login(extra={}){const response=await request('/api/auth/login','POST',{username:'deployment_fixture',password:'SyntheticDeployment123!'},200,extra);cookie=response.headers.get('set-cookie').split(';')[0];return response;}
async function main(){
 assert(path.relative(baseFolder,dbPath).startsWith('deployment-runtime-'));await start();record('actual production startup script and health endpoint on loopback');
 await api('/api/auth/setup','POST',{nickname:'Synthetic',name:'Synthetic Deployment',department:'Testing',username:'deployment_fixture',email:'',password:'SyntheticDeployment123!'});
 await login();await api('/api/auth/login','POST',{username:'deployment_fixture',password:'SyntheticDeployment123!'},403,{origin:'https://untrusted.invalid'});
 const secure=await login({'x-forwarded-proto':'https',origin:base.replace('http:','https:')});assert.match(secure.headers.get('set-cookie'),/; Secure/i);record('application honors forwarded HTTPS for Secure cookies and rejects a cross-origin write (proxy headers simulated)');
 await api('/api/tables','POST',{name:'deployment_rows',label:'Synthetic deployment rows',columns:[{name:'name',label:'Name',type:'text',required:true},{name:'file',label:'File',type:'file',file_path:'deployment-fixture'}]});
 const upload=new FormData();upload.append('table','deployment_rows');upload.append('column','file');upload.append('file',new Blob(['synthetic persistent bytes']),'fixture.txt');const file=await api('/api/files','POST',upload);
 const row=await api('/api/data/deployment_rows','POST',{name:'before backup',file:file.url});
 for(const name of ['data.db','data.db-wal','data.db-shm']){const p=path.join(data,name);assert(fs.existsSync(p),name);assert.equal(fs.statSync(p).mode&0o777,0o600,name+' permissions');}record('SQLite DB/WAL/SHM all reside in the same generated data directory and have mode 0600');
 const copies=fs.readdirSync(path.join(data,'uploads','deployment-fixture'));assert.equal(copies.length,1);assert.equal(fs.statSync(path.join(data,'uploads','deployment-fixture',copies[0])).mode&0o777,0o600);record('upload disk copy resides beside DB with mode 0600');
 const backup=(await api('/api/backups','POST',{})).backup;assert.equal(fs.statSync(path.join(data,'backups',backup.name)).mode&0o777,0o600);const bytes=await(await request('/api/backups/'+backup.name)).arrayBuffer();
 await api('/api/data/deployment_rows?id='+row.id,'PUT',{name:'after backup'});const restoreForm=new FormData();restoreForm.append('file',new Blob([bytes]),'synthetic-backup.db');const stage=await api('/api/backups/restore','POST',restoreForm);
 await api('/api/backups/restore','POST',{op:'restore',token:stage.token,confirmation:'กู้คืน'});await api('/api/data/deployment_rows','GET',undefined,401);await login();assert.equal((await api('/api/data/deployment_rows'))[0].name,'before backup');assert.equal(await(await request(file.url)).text(),'synthetic persistent bytes');record('actual backup download, upload/inspection, restore, session invalidation and restored record/file bytes');
 await stop();await start();await login();assert.equal((await api('/api/data/deployment_rows'))[0].name,'before backup');assert.equal(await(await request(file.url)).text(),'synthetic persistent bytes');record('data and attachment bytes survive a genuine application process restart using the same synthetic path');
 console.log(JSON.stringify({status:'VERIFIED',scope:'local production CLI; not Linux container/Caddy/TLS validation',database:'generated synthetic directory only',checks},null,2));
}
main().catch(e=>{console.error(JSON.stringify({status:'FAILED',message:e.message,checks}));process.exitCode=1;}).finally(async()=>{await stop();fs.writeFileSync(path.join(folder,'startup.log'),output);});
