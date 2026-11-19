const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {ICON_CATALOG,ICON_NAMES,EXTRA_ICONS,SOLID_ICONS}=require('../.test-build/icons');
const {EXPANDED_OUTLINE_ICONS,EXPANDED_SOLID_ICONS}=require('../.test-build/expanded-icons');
test('expanded catalog adds 2000 distinct named icons while preserving legacy names',()=>{
 assert.equal(EXPANDED_OUTLINE_ICONS.length,1400);assert.equal(EXPANDED_SOLID_ICONS.length,600);assert.ok(ICON_CATALOG.length>=2418);assert.equal(ICON_NAMES.size,ICON_CATALOG.length);
 for(const name of ['grid','truck','sparkles','bot','sparkles-solid','tabler-ambulance','tabler-forklift','tabler-motorbike-solid'])assert.ok(ICON_NAMES.has(name),name);
 assert.match(fs.readFileSync('public/licenses/tabler-icons-LICENSE.txt','utf8'),/MIT License[\s\S]*Permission is hereby granted/);
});
test('all new glyphs are local path-only graphics with searchable labels and no external SVG references',()=>{
 const all=[...EXPANDED_OUTLINE_ICONS,...EXPANDED_SOLID_ICONS];assert.equal(new Set(all.map(i=>i[3])).size,all.length);
 const outline=new Map(EXTRA_ICONS.map(i=>[i[0],i[3]])),solid=new Map(SOLID_ICONS.map(i=>[i[0],i[3]]));
 for(const [name,label,category,d,tags]of all){assert.match(name,/^tabler-[a-z0-9-]+$/);assert.ok(label&&category&&tags);assert.match(d,/^M[MLCQAZHVSTmlcqazhvst0-9 .,\-]+$/);assert.equal((name.endsWith('-solid')?solid:outline).get(name),d);}
 assert.match(ICON_CATALOG.find(i=>i.name==='tabler-building-hospital').keywords,/healthcare/);assert.equal(ICON_CATALOG.find(i=>i.name==='tabler-forklift').label,'รถยก');
});
test('shared app, view, Action and decoration validators accept new icons and reject unknown IDs',()=>{
 const {APP_ICONS}=require('../.test-build/app-settings'),{VIEW_ICONS}=require('../.test-build/views'),{appearance}=require('../.test-build/action-config'),{validateDataStyles}=require('../.test-build/data-decoration');
 const apps=new Set(APP_ICONS),views=new Set(VIEW_ICONS.map(i=>i[0]));
 for(const name of ['tabler-forklift','tabler-ambulance','tabler-motorbike-solid']){assert.ok(apps.has(name));assert.ok(views.has(name));assert.equal(appearance({icon:name},'set').icon,name);assert.doesNotThrow(()=>validateDataStyles({title:{icon:name}},[{name:'title',type:'text'}]));}
 assert.throws(()=>appearance({icon:'tabler-not-a-real-icon'},'set'));assert.ok(!ICON_NAMES.has('tabler-not-a-real-icon'));
});
