// Test-runner preload only. Production code has no test URL/IP bypass.
const https=require('node:https'),dns=require('node:dns').promises,{EventEmitter}=require('node:events'),{Readable}=require('node:stream');
const realRequest=https.request,realLookup=dns.lookup;
dns.lookup=async function(host,...args){if(host==='api.fixture.test')return [{address:'93.184.216.34',family:4}];return realLookup.call(this,host,...args);};
https.request=function(raw,options,callback){const url=new URL(raw);if(url.hostname!=='api.fixture.test')return realRequest.apply(this,arguments);const request=new EventEmitter();let destroyed=false;request.write=()=>{};request.destroy=error=>{destroyed=true;request.emit('error',error||Error('fixture aborted'));request.emit('close');};request.end=()=>{const respond=()=>{if(destroyed)return;const socket=new EventEmitter();socket.remoteAddress='93.184.216.34';request.emit('socket',socket);socket.emit('secureConnect');if(destroyed)return;let status=200,headers={'content-type':'application/json'},data;
 const version=url.searchParams.get('version')||'1',rows=version==='2'?[{id:'A',name:'Updated product',amount:15,updated_at:'2026-10-30T02:00:00Z'},{id:'C',name:'New product',amount:30,updated_at:'2026-10-30T02:00:00Z'}]:[{id:'A',name:'Product one',amount:10,updated_at:'2026-10-30T01:00:00Z'},{id:'B',name:'Product two',amount:20,updated_at:'2026-10-30T01:00:00Z'}];data={data:{items:rows},echo:options.headers.Authorization||options.headers['X-API-Key']||'',email:'private@example.test',token:'upstream-token-not-for-preview'};
 if(url.pathname==='/private-redirect'){status=302;headers.location='https://127.0.0.1/private';}
 if(url.pathname==='/cross-redirect'){status=302;headers.location='https://other.fixture.test/private';}
 if(url.pathname==='/error'){status=500;data={error:'upstream-private-error'};}
 if(url.pathname==='/429'){status=429;headers['retry-after']='0';}
 if(url.pathname==='/large')data={blob:'x'.repeat(2*1024*1024+1)};
 if(url.pathname==='/compressed')headers['content-encoding']='gzip';
 if(url.pathname==='/invalid-json')headers['content-type']='text/html';
 if(url.pathname==='/empty')data={data:{items:[]}};
 if(url.pathname==='/drift')data={data:{items:[{id:'A',amount:999}]}};
 if(url.pathname==='/page'){const n=Number(url.searchParams.get('page')||1);data={data:{items:n===1?rows:n===2?[{id:'C',name:'Third',amount:30,updated_at:'2026-10-30T01:00:00Z'}]:[]}};}
 if(url.pathname==='/cursor')data={data:{items:url.searchParams.has('cursor')?[rows[1]]:[rows[0]]},next_cursor:url.searchParams.has('cursor')?null:'opaque-page-2'};
 if(url.pathname==='/next')data={data:{items:url.searchParams.get('page')==='2'?[rows[1]]:[rows[0]]},next_link:url.searchParams.get('page')==='2'?null:'https://api.fixture.test/next?page=2'};
 if(url.pathname==='/loop')data={data:{items:[rows[0]]},next_cursor:'same'};
 if(options.headers.Authorization&&options.headers.Authorization!=='Bearer synthetic-fixture-credential'){status=401;data={};}
 const response=Readable.from([Buffer.from(JSON.stringify(data))]);response.statusCode=status;response.headers=headers;callback(response);response.on('end',()=>request.emit('close'));
 };if(url.pathname==='/slow')setTimeout(respond,2000);else queueMicrotask(respond);};return request;};
