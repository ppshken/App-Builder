const {test}=require('node:test');const assert=require('node:assert/strict');const {validateDisplay,displaySettings,displayColumnNames,changeDisplayColumn}=require('../.test-build/view-display.js');
const cols=[{name:'name',label:'ชื่อ',type:'text'},{name:'picture',label:'ภาพ',type:'image'},{name:'amount',label:'จำนวน',type:'decimal'}];
test('grid columns validate and inherit defaults for list screens',()=>{const d={list_style:'grid',list_grid_columns:4,list_grid_mobile_columns:2};assert.deepEqual(validateDisplay(d,cols),d);assert.equal(displaySettings({},d).list_grid_columns,4);for(const bad of [{list_grid_columns:0},{list_grid_columns:7},{list_grid_columns:2.5},{list_grid_mobile_columns:4},{list_grid_mobile_columns:'2'}])assert.throws(()=>validateDisplay(bad,cols));});
test('list sizing and styles validate limits and inherit global defaults',()=>{
 const {validateGlobalDisplayDefaults}=require('../.test-build/view-display.js');
 const d={list_style:'outlined',list_padding:20,list_min_height:110,list_gap:8,list_radius:16};assert.deepEqual(validateDisplay(d,cols),d);assert.deepEqual(validateGlobalDisplayDefaults({list:d}),{list:d});assert.equal(displaySettings({},d).list_min_height,110);
 for(const bad of [{list_padding:-1},{list_padding:41},{list_min_height:39},{list_min_height:241},{list_gap:33},{list_radius:1.5},{list_radius:'10'},{list_style:'html'}])assert.throws(()=>validateDisplay(bad,cols));
});
test('screen settings reject invalid columns, HTML-style options and wrong types; defaults keep old layouts',()=>{assert.equal(displaySettings({}).form_columns,1);assert.equal(displaySettings({}).summary_columns,null);const valid={title_column:'name',image_column:'picture',summary_columns:['amount'],form_fields:{name:{width:'full',section:'ทั่วไป',multiline:true,help:'คำแนะนำ'}}};assert.deepEqual(validateDisplay(valid,cols),valid);for(const value of [{image_column:'name'},{title_column:'fake'},{list_style:['card']},{form_columns:'2'},{table_wrap:'true'},{summary_columns:['amount','amount']},{style:'position:fixed'},{form_fields:{amount:{multiline:true}}},{form_fields:{fake:{help:'x'}}},{form_fields:{name:{placeholder:'a'.repeat(151)}}}])assert.throws(()=>validateDisplay(value,cols));});
test('column renames and removals follow every layout reference without replacing user-written text',()=>{const d={title_column:'name',summary_columns:['name','amount'],form_fields:{name:{help:'[name]',section:'name'},amount:{width:'half'}}};assert.deepEqual(displayColumnNames(d),['name','amount']);const renamed=changeDisplayColumn(d,'name','title');assert.equal(renamed.title_column,'title');assert.deepEqual(renamed.summary_columns,['title','amount']);assert.equal(renamed.form_fields.title.help,'[name]');assert.equal(renamed.form_fields.title.section,'name');const removed=changeDisplayColumn(renamed,'title');assert.equal(removed.title_column,'__auto__');assert.deepEqual(removed.summary_columns,['amount']);assert.equal(removed.form_fields.title,undefined);assert.deepEqual(displayColumnNames(removed),['amount']);});

test('Related display validates relationship keys, titles, visibility, limits and selected Inline names',()=>{
 const {validateDisplay}=require('../.test-build/view-display.js'),valid={related:{'orders:customer':{view:'orders_inline',visible:true,title:'รายการขายของลูกค้า',limit:10}}};assert.deepEqual(validateDisplay(valid,[]),valid);
 for(const related of [[],{'orders:customer':{limit:7}},{'orders:customer':{visible:'yes'}},{'orders:customer':{title:'x'.repeat(101)}},{'orders:customer':{view:'bad; SQL'}},{'orders:customer':{unknown:true}},{'unsafe; SQL':{}},{'orders:customer':null}])assert.throws(()=>validateDisplay({related},[]));
});

test('detail cover and spacing validate safely and follow image column renames/removals',()=>{
 const valid={detail_image_mode:'cover',detail_cover_column:'picture',detail_cover_height:320,detail_image_fit:'contain',detail_image_radius:12,detail_padding:24,detail_row_spacing:8,detail_line_height:2.1,detail_separator:'dashed',detail_style:'card',detail_show_labels:false,detail_hide_empty:true};
 assert.deepEqual(validateDisplay(valid,cols),valid);assert.deepEqual(displayColumnNames(valid),['picture']);
 assert.equal(changeDisplayColumn(valid,'picture','photo').detail_cover_column,'photo');assert.equal(changeDisplayColumn(valid,'picture').detail_cover_column,'__auto__');
 for(const bad of [{detail_cover_column:'name'},{detail_cover_column:'missing'},{detail_cover_height:601},{detail_cover_height:'240'},{detail_padding:7},{detail_row_spacing:-1},{detail_image_radius:33},{detail_line_height:0.9},{detail_line_height:Infinity},{detail_separator:'inset'},{detail_show_labels:'false'},{detail_hide_empty:1},{detail_style:'html'}])assert.throws(()=>validateDisplay(bad,cols));
 assert.equal(displaySettings({}).detail_image_mode,'inline');assert.equal(displaySettings({}).detail_hide_empty,false);
});

test('global defaults inherit by screen kind while explicit View overrides win; reject per-table bindings',()=>{
 const {validateGlobalDisplayDefaults}=require('../.test-build/view-display');
 const defaults={detail:{detail_image_mode:'cover',detail_padding:24},list:{list_style:'card'},table:{row_click:'edit'},form:{form_columns:2}};
 assert.deepEqual(validateGlobalDisplayDefaults(defaults),defaults);
 assert.equal(displaySettings({},defaults.detail).detail_padding,24);assert.equal(displaySettings({detail_padding:8},defaults.detail).detail_padding,8);assert.equal(displaySettings({detail_show_labels:false},defaults.detail).detail_show_labels,false);
 for(const value of [null,[],{other:{}},{detail:{detail_cover_column:'photo'}},{list:{title_column:'name'}},{list:{image_column:'photo'}},{table:{row_click:'action'}},{form:{form_fields:{name:{help:'x'}}}},{detail:{detail_padding:900}}])assert.throws(()=>validateGlobalDisplayDefaults(value));
});

test('form save destinations validate, default to previous screen and inherit app defaults with explicit overrides',()=>{const {validateGlobalDisplayDefaults}=require('../.test-build/view-display.js');assert.equal(displaySettings({}).form_after_save,'back');validateDisplay({form_after_save:'detail'},cols);assert.equal(displaySettings({}, {form_after_save:'detail'}).form_after_save,'detail');assert.equal(displaySettings({form_after_save:'back'},{form_after_save:'detail'}).form_after_save,'back');validateGlobalDisplayDefaults({form:{form_after_save:'detail'}});for(const value of ['other','/admin','',true,1,null])assert.throws(()=>validateDisplay({form_after_save:value},cols));});
