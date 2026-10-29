const assert=require('node:assert/strict');
const base=process.env.NOCODE_TEST_URL,owner=process.env.NOCODE_TEST_COOKIE;
if(!process.env.NOCODE_TEST_DB?.includes('integration-'))throw Error('Isolated database required');
async function api(path,method='GET',body,cookie=owner,status=200){const r=await fetch(base+path,{method,headers:{cookie,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});assert.equal(r.status,status,path);return r.json();}
async function upload(cookie){const data=new FormData();data.set('table','boundary_docs');data.set('column','file');data.set('file',new Blob(['SYNTHETIC-ONLY'],{type:'text/plain'}),'synthetic.txt');const r=await fetch(base+'/api/files',{method:'POST',headers:{cookie},body:data});assert.equal(r.status,200);return (await r.json()).url;}
(async()=>{
 await api('/api/tables','POST',{name:'boundary_docs',label:'Synthetic documents',columns:[{name:'name',label:'Name',type:'text',is_label:true},{name:'file',label:'File',type:'file'}]});const file=await upload(owner);await api('/api/data/boundary_docs','POST',{name:'Synthetic record',file});
 const app=await api('/api/applications','POST',{label:'Synthetic app A',description:''},owner,201);await api('/api/users','POST',{op:'separate_builder_security'});const overview=await api('/api/users');const user=await api('/api/users','POST',{op:'create_user',name:'Synthetic developer',username:'syntheticdev',nickname:'Synthetic',department:'Testing',email:'',role:overview.builder_security.basic_role,password:'Synthetic-test-only',active:true});await api('/api/users','POST',{op:'set_application_builder',app_id:app.id,user_id:user.id,can_manage:true});
 const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',cookie:''},body:JSON.stringify({username:'syntheticdev',password:'Synthetic-test-only'})});assert.equal(login.status,200);const session=login.headers.get('set-cookie').split(';')[0],cookie=session+'; nocode_app='+app.id;
 assert.equal((await fetch(base+'/api/data/boundary_docs',{headers:{cookie}})).status,403);
 assert.equal((await fetch(base+file,{headers:{cookie}})).status,403,'AUD-001 cross-app attachment must be denied');
 assert.equal((await fetch(base+file+'?pwa_app='+app.id,{headers:{cookie:session}})).status,403,'PWA scope must enforce attachment boundary');
 await api('/api/applications','PUT',{op:'dataset',id:app.id,table:'boundary_docs',rights:{read:true,create:false,update:false,delete:false,export:false}});
 let r=await fetch(base+file,{headers:{cookie}});assert.equal(r.status,200);assert.equal(await r.text(),'SYNTHETIC-ONLY');
 await api('/api/applications','PUT',{op:'dataset',id:app.id,table:'boundary_docs',rights:{read:false,create:false,update:false,delete:false,export:false}});assert.equal((await fetch(base+file,{headers:{cookie}})).status,403);
 await api('/api/users','POST',{op:'set_application_builder',app_id:'default',user_id:user.id,can_manage:true});const pending=await upload(session+'; nocode_app=default');assert.equal((await fetch(base+pending,{headers:{cookie:session+'; nocode_app=default'}})).status,200,'same-app pending upload stays readable');assert.equal((await fetch(base+pending,{headers:{cookie}})).status,403,'same uploader cannot move pending access across apps');
 console.log('AUD-001 Passed: HTTP cross-app/default/PWA denial, shared-table allow/revoke, own pending upload provenance.');
})().catch(e=>{console.error(e);process.exitCode=1;});
