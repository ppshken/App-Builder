const {test}=require('node:test'),assert=require('node:assert/strict'),Database=require('better-sqlite3');
const {AUTH_SCHEMA}=require('../.test-build/auth-schema.js');
const auth=require('../.test-build/auth.js');
function database(){const db=new Database(':memory:');db.pragma('foreign_keys=ON');db.exec(AUTH_SCHEMA);return db;}
test('password hashing, atomic owner setup and generic login failures',async()=>{const db=database();try{
 const result=await auth.setupOwner({name:'Owner',email:'OWNER@example.com',password:'StrongPassword123'},db);assert.equal(result.user.email,'owner@example.com');assert.ok(!JSON.stringify(result.user).includes('password'));
 const stored=db.prepare('SELECT password_hash FROM _users').get().password_hash;assert.notEqual(stored,'StrongPassword123');assert.ok(await auth.verifyPassword('StrongPassword123',stored));assert.equal(await auth.verifyPassword('wrong',stored),false);
 await assert.rejects(auth.setupOwner({name:'Other',email:'other@example.com',password:'StrongPassword123'},db),e=>e.status===409);
 for(const email of ['owner@example.com','missing@example.com'])await assert.rejects(auth.login({email,password:'bad'},db),e=>e.status===401&&e.message.includes('อีเมลหรือรหัสผ่าน'));
 const signed=await auth.login({email:'owner@example.com',password:'StrongPassword123'},db);assert.equal(signed.user.id,result.user.id);
 assert.equal(db.prepare('SELECT token_hash FROM _sessions LIMIT 1').get().token_hash.length,64);assert.equal(auth.cookieToken('nocode_session='+signed.token),signed.token);
 auth.revokeSession(signed.token,db);assert.equal(auth.sessionUser(signed.token,db),null);
 }finally{db.close();}});
test('sessions reject expired leases and inactive users and generate distinct tokens',()=>{const db=database();try{db.prepare("INSERT INTO _users(name,email,password_hash,created_at) VALUES('Owner','owner@example.com','x',0)").run();const user={id:1,name:'Owner',email:'owner@example.com',role:'owner'},now=100000;
 const first=auth.createSession(user,db,now),second=auth.createSession(user,db,now);assert.notEqual(first.token,second.token);assert.deepEqual(auth.sessionUser(first.token,db,now+60001),user);
 assert.equal(auth.sessionUser(first.token,db,now+60001+auth.SESSION_IDLE),null);
 const third=auth.createSession(user,db,now);db.prepare('UPDATE _sessions SET last_seen=?').run(now+auth.SESSION_AGE-1);assert.equal(auth.sessionUser(third.token,db,now+auth.SESSION_AGE),null);
 db.prepare('UPDATE _users SET active=0').run();assert.equal(auth.sessionUser(second.token,db,now),null);
 }finally{db.close();}});
test('login rate limit survives requests and same-origin mutations reject cross-site requests',async()=>{const db=database();try{for(let i=0;i<5;i++)await assert.rejects(auth.login({email:'missing@example.com',password:'bad'},db),e=>e.status===401);await assert.rejects(auth.login({email:'missing@example.com',password:'bad'},db),e=>e.status===429);
 assert.throws(()=>auth.assertSameOrigin(new Request('http://localhost:3000/api/auth/login',{headers:{origin:'https://other.example'}})),e=>e.status===403);
 assert.throws(()=>auth.assertSameOrigin(new Request('http://localhost:3000/api/auth/login',{headers:{'sec-fetch-site':'cross-site'}})),e=>e.status===403);
 }finally{db.close();}});

test('auth migration backs up existing data; restore preserves current owner and revokes sessions',()=>{
 const fs=require('node:fs'),path=require('node:path'),{initializeDatabase}=require('../.test-build/schema.js'),{inspectBackup,restoreBackup}=require('../.test-build/backups.js');
 const folder=fs.mkdtempSync(path.join(process.cwd(),'.test-data','auth-restore-')),file=path.join(folder,'data.db'),sourceFile=path.join(folder,'source.db'),stageFile=path.join(folder,'stage.db');
 const db=new Database(file),source=new Database(sourceFile);try{
 initializeDatabase(db,':memory:');db.exec("DROP TABLE _push_deliveries; DROP TABLE _push_subscriptions; DROP TABLE _sessions; DROP TABLE _auth_attempts; DROP TABLE _users");
 db.prepare("INSERT INTO _tables(name,label) VALUES('items','Items')").run();db.prepare("INSERT INTO _columns(table_name,name,label,type,pos) VALUES('items','name','Name','text',0)").run();db.exec('CREATE TABLE t_items(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT)');db.prepare("INSERT INTO t_items(id,name) VALUES(17,'preserved')").run();
 initializeDatabase(db,file);const files=fs.readdirSync(path.join(folder,'backups'));assert.equal(files.length,1);assert.match(files[0],/before-authentication/);assert.equal(db.prepare('SELECT name FROM t_items WHERE id=17').get().name,'preserved');
 const before=new Database(path.join(folder,'backups',files[0]),{readonly:true});assert.equal(before.prepare("SELECT 1 FROM sqlite_master WHERE name='_users'").get(),undefined);before.close();
 db.prepare("INSERT INTO _users(id,name,email,password_hash,created_at) VALUES(9,'Current Owner','current@example.com','x',0)").run();const session=auth.createSession({id:9,name:'Current Owner',email:'current@example.com',role:'owner'},db);
 initializeDatabase(source,':memory:');source.prepare("INSERT INTO _users(name,email,password_hash,created_at) VALUES('Backup Owner','backup@example.com','x',0)").run();source.close();
 inspectBackup(sourceFile,stageFile);restoreBackup(db,file,stageFile);
 assert.equal(db.prepare('SELECT email FROM _users').get().email,'current@example.com');assert.equal(auth.sessionUser(session.token,db),null);assert.equal(db.prepare("SELECT seq FROM sqlite_sequence WHERE name='_users'").get().seq,9);assert.deepEqual(db.pragma('foreign_key_check'),[]);
 }finally{db.close();if(source.open)source.close();}
});

test('active sessions renew beyond their original lifetime and keep created time unchanged',()=>{const db=database();try{
 db.prepare("INSERT INTO _users(name,email,password_hash,created_at) VALUES('Owner','rolling@example.com','x',0)").run();const user={id:1,name:'Owner',email:'rolling@example.com',role:'owner'},now=100000,session=auth.createSession(user,db,now),day=24*60*60*1000;
 assert.equal(auth.SESSION_AGE,30*day);
 assert(auth.sessionUser(session.token,db,now+29*day));assert(auth.sessionUser(session.token,db,now+58*day));
 const row=db.prepare('SELECT created_at,last_seen,expires_at FROM _sessions WHERE token_hash=?').get(auth.tokenHash(session.token));assert.equal(row.created_at,now);assert.equal(row.expires_at,now+88*day);
 auth.revokeSession(session.token,db);assert.equal(auth.sessionUser(session.token,db,now+59*day),null);
 }finally{db.close();}});
test('legacy valid sessions upgrade to the rolling lease but expired sessions cannot be resurrected',()=>{const db=database();try{
 db.prepare("INSERT INTO _users(name,email,password_hash,created_at) VALUES('Owner','legacy@example.com','x',0)").run();const user={id:1,name:'Owner',email:'legacy@example.com',role:'owner'},now=100000,session=auth.createSession(user,db,now);
 db.prepare('UPDATE _sessions SET expires_at=?').run(now+12*60*60*1000);assert(auth.sessionUser(session.token,db,now+1));assert.equal(db.prepare('SELECT expires_at FROM _sessions').get().expires_at,now+1+auth.SESSION_AGE);
 db.prepare('UPDATE _sessions SET expires_at=?').run(now+10);assert.equal(auth.sessionUser(session.token,db,now+10),null);assert.equal(db.prepare('SELECT count(*) n FROM _sessions').get().n,0);
 }finally{db.close();}});

test('rolling cookies retain HTTPS flags and app selection without overriding an intentional switch',()=>{
 const {setSessionCookie}=require('../.test-build/auth-response.js');
 const request=new Request('https://example.test/api/settings',{headers:{cookie:'nocode_session='+ 'a'.repeat(43)+'; nocode_app=default'}}),response=new Response('ok');
 setSessionCookie(response,request,'a'.repeat(43));const cookies=response.headers.getSetCookie();assert.equal(cookies.length,2);
 const session=cookies.find(c=>c.startsWith('nocode_session='));assert.match(session,/HttpOnly/);assert.match(session,/Secure/);assert.match(session,/SameSite=lax/);assert.match(session,/Max-Age=2592000/);
 assert.match(cookies.find(c=>c.startsWith('nocode_app=')),/SameSite=strict/);
 const switchResponse=new Response('ok',{headers:{'Set-Cookie':'nocode_app=a_'+ 'f'.repeat(24)+'; Path=/; HttpOnly'}});setSessionCookie(switchResponse,request,'a'.repeat(43));assert.equal(switchResponse.headers.getSetCookie().filter(c=>c.startsWith('nocode_app=')).length,1);assert.match(switchResponse.headers.getSetCookie().find(c=>c.startsWith('nocode_app=')),/a_ffff/);
 const logout=new Response('ok');setSessionCookie(logout,request,'');assert.equal(logout.headers.getSetCookie().length,1);assert.match(logout.headers.get('set-cookie'),/Max-Age=0/);
});

test('an explicit session clear from restore or logout always wins over automatic renewal',()=>{
 const {setSessionCookie}=require('../.test-build/auth-response.js');
 const response=new Response('ok',{headers:{'Set-Cookie':'nocode_session=; Path=/; Max-Age=0; HttpOnly; SameSite=lax'}});
 setSessionCookie(response,new Request('https://example.test/api/backups/restore',{headers:{cookie:'nocode_session='+ 'b'.repeat(43)}}),'b'.repeat(43));
 assert.equal(response.headers.getSetCookie().length,1);assert.match(response.headers.get('set-cookie'),/Max-Age=0/);assert(!response.headers.get('set-cookie').includes('b'.repeat(43)));
});
