const {test}=require('node:test'),assert=require('node:assert/strict');
const base=process.env.NOCODE_TEST_URL;
if(!base||!process.env.NOCODE_TEST_DB?.includes('integration-'))throw Error('Use isolated runner');
async function api(method,body,status=200){const r=await fetch(base+'/api/settings',{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)}),j=await r.json();assert.equal(r.status,status,JSON.stringify(j));return j;}
test('App name, icon, color and mode persist; invalid settings cannot overwrite the saved configuration',async()=>{
 const initial=await api('GET');assert.deepEqual(initial,{icon_image:'',home_view:'',image_max_edge:0,image_quality:85,image_format:'original',image_max_mb:5,image_storage:'database',image_folder:'images',name:'No-code Builder',icon:'grid',color:'blue',mode:'auto',font:'sarabun',font_size:14,loading_style:'text',loading_text:'กำลังโหลด…',custom_color:'#2563EB',display_defaults:{}});
 const config={...initial,name:'ระบบงานส่วนตัว',icon:'phone',color:'purple',mode:'dark'};await api('PUT',config);assert.deepEqual(await api('GET'),config);
 for(const changes of [{name:''},{name:' '.repeat(20)},{name:'x'.repeat(101)},{icon:'<svg onload=alert(1)>'},{color:'url(javascript:bad)'},{mode:'invalid'}]){await api('PUT',{...config,...changes},400);assert.deepEqual(await api('GET'),config);}
 await api('PUT',{...config,icon:'package'});assert.equal((await api('GET')).icon,'package');await api('PUT',initial);
});

test('Appearance settings accept all 10 fonts, persist canonical hex and reject invalid requests without data loss',async()=>{const initial=await api('GET');const options={...initial,font:'prompt',font_size:18,color:'custom',custom_color:'#09f',loading_style:'both',loading_text:' กำลังเปิดหน้า… '};await api('PUT',options);const saved=await api('GET');assert.equal(saved.custom_color,'#0099FF');assert.equal(saved.loading_text,'กำลังเปิดหน้า…');for(const font of ['sarabun','noto-sans-thai','prompt','kanit','ibm-plex-sans-thai','bai-jamjuree','chakra-petch','krub','mitr','anuphan'])await api('PUT',{...saved,font});await api('PUT',saved);for(const change of [{font:'Comic Sans'},{font_size:11},{font_size:25},{font_size:14.5},{font_size:'18'},{loading_style:'other'},{loading_text:''},{loading_text:'a'.repeat(81)},{custom_color:'red'},{custom_color:'#12'},{custom_color:'#GGGGGG'},{custom_color:'url(javascript:bad)'}]){await api('PUT',{...saved,...change},400);assert.deepEqual(await api('GET'),saved);}await api('PUT',{name:saved.name,icon:saved.icon,color:saved.color,mode:saved.mode});assert.deepEqual(await api('GET'),saved);await api('PUT',initial);});

test('global screen defaults persist and invalid or table-specific defaults cannot overwrite them',async()=>{
 const initial=await api('GET'),display_defaults={list:{list_style:'card'},table:{table_density:'compact',row_click:'edit'},detail:{detail_image_mode:'cover',detail_padding:24},form:{form_columns:2}};await api('PUT',{display_defaults});const saved=await api('GET');assert.deepEqual(saved.display_defaults,display_defaults);assert.equal(saved.name,initial.name);
 for(const display_defaults of [[],{unknown:{}},{detail:{detail_cover_height:601}},{list:{title_column:'name'}},{table:{row_click:'action'}},{form:{form_columns:3}}]){await api('PUT',{display_defaults},400);assert.deepEqual(await api('GET'),saved);}
 await api('PUT',{name:saved.name});assert.deepEqual((await api('GET')).display_defaults,saved.display_defaults);await api('PUT',initial);
});
