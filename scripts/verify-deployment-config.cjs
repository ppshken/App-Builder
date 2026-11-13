// Read-only checks. Uses example values, never starts/stops Docker services.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),results=[];
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
function command(args){const r=spawnSync('docker',args,{cwd:root,env,encoding:'utf8',maxBuffer:8*1024*1024});assert.equal(r.status,0,r.stderr);return r.stdout;}
const env={...process.env};
for(const key of Object.keys(env))if(key.startsWith('NOCODE_')||key.startsWith('COMPOSE_')||/^(APP_|NODE_IMAGE$|CADDY_IMAGE$|ACME_EMAIL$|HTTP_|HTTPS_|PUBLIC_)/.test(key))delete env[key];
function check(name,fn){try{fn();results.push({name,status:'VERIFIED'});}catch(e){results.push({name,status:'FAILED',message:e.message});}}
let http,https,nginx;
check('Compose HTTP renders with example configuration',()=>{http=JSON.parse(command(['compose','--env-file','.env.docker.example','-f','compose.yaml','config','--format','json']));});
check('Compose HTTPS renders with example configuration',()=>{https=JSON.parse(command(['compose','--env-file','.env.docker.example','-f','compose.yaml','-f','compose.https.yaml','config','--format','json']));});
check('Compose host Nginx exposes loopback only and disables bundled proxy by default',()=>{
 nginx=JSON.parse(command(['compose','--env-file','.env.docker.example','-f','compose.yaml','-f','compose.nginx.yaml','config','--format','json']));
 assert.deepEqual(nginx.services.app.ports.map(p=>[p.host_ip,String(p.published),p.target]),[['127.0.0.1','3001',3000]]);
 assert(!nginx.services.proxy,'bundled proxy must be absent when its profile is disabled');
 const enabled=JSON.parse(command(['compose','--env-file','.env.docker.example','--profile','bundled-caddy','-f','compose.yaml','-f','compose.nginx.yaml','config','--format','json']));
 assert(enabled.services.proxy.profiles.includes('bundled-caddy'));
});
check('ports match Next startup and app has no public host port',()=>{
 assert(http&&https);for(const cfg of [http,https]){assert(!cfg.services.app.ports?.length);assert(cfg.services.app.expose.includes('3000'));assert.equal(cfg.services.app.environment.PORT,'3000');assert.equal(cfg.services.app.environment.HOSTNAME,'0.0.0.0');}
 assert.deepEqual(http.services.proxy.ports.map(p=>[p.host_ip,String(p.published),p.target,p.protocol]),[['127.0.0.1','8080',8080,'tcp']]);
 assert.deepEqual(https.services.proxy.ports.map(p=>[String(p.published),p.target,p.protocol]),[['80',80,'tcp'],['443',443,'tcp'],['443',443,'udp']]);
});
check('SQLite, WAL and sibling storage share a persistent volume',()=>{
 const app=https.services.app;assert.equal(app.environment.NOCODE_DB_PATH,'/data/data.db');assert(app.volumes.some(v=>v.type==='volume'&&v.target==='/data'&&v.source==='app_data'));
 assert.match(read('lib/db.ts'),/process\.env\.NOCODE_DB_PATH/);assert.match(read('lib/schema.ts'),/journal_mode = WAL/);assert.match(read('lib/releases.ts'),/dirname\(databasePath\)/);assert.match(read('lib/image-files.ts'),/dirname\(dbPath\)/);assert.match(read('lib/backups.ts'),/dirname\(resolve\(path\)\)/);
});
check('container hardening and writable runtime paths are declared',()=>{
 const app=https.services.app;assert.equal(app.read_only,true);assert(app.cap_drop.includes('ALL'));assert(app.security_opt.includes('no-new-privileges:true'));assert(app.tmpfs.some(v=>v.startsWith('/tmp:')));assert(app.tmpfs.some(v=>v.startsWith('/app/.next/cache:')));
 const dockerfile=read('Dockerfile');assert.match(dockerfile,/USER node/);assert.match(dockerfile,/chmod 0700 \/data/);assert.match(read('deploy/start-app.sh'),/umask 077/);
});
check('build/start commands and runtime font assets match source',()=>{
 assert.equal(JSON.parse(read('package.json')).scripts.build,'node scripts/build-rehearsal-worker.cjs && next build --webpack');assert.match(read('Dockerfile'),/RUN npm run build && npm prune/);assert.match(read('Dockerfile'),/CMD \["sh", "deploy\/start-app.sh"\]/);assert.match(read('deploy/start-app.sh'),/exec node node_modules\/next\/dist\/bin\/next start/);
 assert.match(read('scripts/build-rehearsal-worker.cjs'),/lib\/rehearsal-worker-entry\.ts/);assert.match(read('scripts/build-rehearsal-worker.cjs'),/lib\/publication-validation-worker-entry\.ts/);assert.match(read('Dockerfile'),/COPY --from=build \/app\/\.rehearsal-worker \/\.rehearsal-worker|COPY --from=build \/app\/\.rehearsal-worker \.\/\.rehearsal-worker/);
 assert(read('.dockerignore').split(/\r?\n/).includes('/.rehearsal-worker/'),'host worker artifacts must be rebuilt inside the image');
 for(const file of ['public/fonts/sarabun-0.woff2','app/fonts.css','deploy/start-app.sh','deploy/healthcheck.cjs','deploy/setup-owner.cjs'])assert(fs.existsSync(path.join(root,file)),file);
});
check('optional code environment variables are passed to the container',()=>{
 for(const key of ['NOCODE_API_ORIGINS','NOCODE_API_WORKSPACE_ORIGINS','NOCODE_API_CREDENTIALS','NOCODE_API_READ_QUERY_PATHS','NOCODE_USAGE_RETENTION_DAYS','NOCODE_PWA_VERSION','NOCODE_PDF_BROWSER_PATH','NOCODE_WEBHOOK_ORIGINS','NOCODE_SCHEMA_PUBLICATION'])assert(Object.hasOwn(https.services.app.environment,key),key);
});
check('Caddy routes whole app including API, PWA and Next assets without rewriting',()=>{
 for(const file of ['deploy/Caddyfile','deploy/Caddyfile.https']){assert.match(read(file),/reverse_proxy app:3000/);assert.match(read(file),/flush_interval -1/);assert(!/handle_path|uri strip_prefix/.test(read(file)));}
 assert(https.services.proxy.volumes.some(v=>v.target==='/etc/caddy/Caddyfile'&&v.source.replace(/\\/g,'/').endsWith('/deploy/Caddyfile.https')));
});
check('build context excludes private data while preserving backup source',()=>{
 const ignore=read('.dockerignore').split(/\r?\n/);for(const entry of ['.git','node_modules','.env*','*.db','*.db-*','uploads','backups','.app-releases','.aws','.ssh','.codex','.npmrc','*.pem','*.key'])assert(ignore.includes(entry),entry);
 for(const entry of ['!app/backups/**','!app/api/backups/**'])assert(ignore.includes(entry),entry);
});
const git=spawnSync('git',['ls-files','-z'],{cwd:root,encoding:'utf8'});assert.equal(git.status,0);const files=git.stdout.split('\0').filter(Boolean);
check('current tracked files do not include dotenv secrets, DBs or machine credentials',()=>{
 const forbidden=files.filter(f=>/(^|\/)(\.env(?:\..*)?|\.npmrc|\.netrc|credentials)$/.test(f)&&!/(?:example|sample)$/.test(f)||/\.(?:db|sqlite|pem|key)(?:-|$)/.test(f)||/^\.aws\//.test(f));assert.deepEqual(forbidden,[]);
});
const secretPatterns=[/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,/\bAKIA[A-Z0-9]{16}\b/,/\bgh[pousr]_[A-Za-z0-9]{36,}\b/],suspects=[];
for(const f of files){const p=path.join(root,f);if(!fs.existsSync(p)||fs.statSync(p).size>2*1024*1024)continue;const s=fs.readFileSync(p,'utf8');if(s.includes('\0'))continue;for(const [line,text]of s.split('\n').entries())if(secretPatterns.some(re=>re.test(text)))suspects.push({file:f,line:line+1});}
check('heuristic scan of current tracked text files finds no private-key/AWS/GitHub token pattern',()=>assert.deepEqual(suspects,[]));
const history=spawnSync('git',['log','--all','--format=','--name-only','--','.env','.env.local','.env.production','.env.docker','.npmrc','.netrc','.aws/credentials','*.pem','*.key'],{cwd:root,encoding:'utf8'});
check('selected sensitive filenames absent from reachable Git history',()=>{assert.equal(history.status,0);assert.equal(history.stdout.trim(),'');});
results.push({name:'real domain, ACME email, image release, offsite backup and external-service secrets',status:'NEEDS CONFIGURATION'});
let privateConfig={present:false};
const privateFile=path.join(root,'.env.docker');
if(fs.existsSync(privateFile)){
 privateConfig={present:true,mode:(fs.statSync(privateFile).mode&0o777).toString(8)};
 // Capture real values in memory only. Never print a private Compose rendering,
 // domain, email, credential JSON, or CLI error that could contain those values.
 const rendered=spawnSync('docker',['compose','--env-file','.env.docker','-f','compose.yaml','-f','compose.https.yaml','config','--format','json'],{cwd:root,env,encoding:'utf8',maxBuffer:8*1024*1024});
 privateConfig.render=rendered.status===0?'VERIFIED':'NEEDS CONFIGURATION';
 if(rendered.status===0){try{const cfg=JSON.parse(rendered.stdout),p=cfg.services.proxy.environment,domain=p.APP_DOMAIN||'',email=p.ACME_EMAIL||'';
  privateConfig.domain_and_email=/example\.|\.example$|\.invalid$|localhost|^$/.test(domain)||/example\.|\.invalid$|^$/.test(email)?'NEEDS CONFIGURATION':'values provided; DNS/TLS not verified';
  privateConfig.release_image=/:local$|:latest$|smoke|^$/.test(cfg.services.app.image||'')?'NEEDS CONFIGURATION':'tag provided; release approval/digest still required';
 }catch{privateConfig.render='NEEDS CONFIGURATION';}}
}
console.log(JSON.stringify({scope:'example Compose + source + current tracked text; not a complete historical secret audit or Docker runtime test',checks:results,private_config_metadata_only:privateConfig},null,2));
if(results.some(r=>r.status==='FAILED'))process.exitCode=1;
