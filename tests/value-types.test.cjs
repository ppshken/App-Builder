const {test}=require('node:test'),assert=require('node:assert/strict');const {normalizeValue,SQLTYPE}=require('../.test-build/columns');const {valueLabel}=require('../.test-build/value-types');
test('decimal places format without changing stored precision and reject invalid metadata',()=>{
 const {decimalLabel,normalizeDecimalOptions,decimalPlaces}=require('../.test-build/decimal-format'),{normalizeColumns}=require('../.test-build/metadata');
 const c={name:'amount',label:'Amount',type:'decimal',options:normalizeDecimalOptions('{"decimal_places":2}')};
 assert.equal(decimalLabel(c,12.5),'12.50');assert.equal(decimalLabel(c,1.239),'1.24');assert.equal(decimalLabel(c,-1.239),'-1.24');assert.equal(decimalLabel(c,0),'0.00');assert.equal(decimalLabel(c,null),'');assert.equal(decimalLabel(c,''),'');assert.equal(normalizeValue(c,1.239),1.239);
 assert.equal(decimalLabel({},1.239),'1.239');assert.equal(decimalLabel({options:'{"decimal_places":0}'},1.8),'2');assert.equal(decimalLabel({options:'{"decimal_places":10}'},1.25),'1.2500000000');assert.equal(decimalPlaces({}),null);assert.equal(normalizeColumns([c])[0].options,c.options);
 for(const v of ['{"decimal_places":-1}','{"decimal_places":11}','{"decimal_places":1.5}','{"decimal_places":"2"}','[]','{"other":2}','bad'])assert.throws(()=>normalizeDecimalOptions(v));
 assert.equal(normalizeDecimalOptions(''),null);
});
test('boolean display labels preserve false, blanks and raw values with validated metadata',()=>{
 const {booleanLabel,normalizeBooleanLabels}=require('../.test-build/boolean-labels');
 const c={name:'passed',label:'Result',type:'yesno',options:normalizeBooleanLabels(JSON.stringify({true:'ผ่าน',false:'ไม่ผ่าน'}))};
 for(const v of [true,1,'1','true'])assert.equal(booleanLabel(c,v),'ผ่าน');
 for(const v of [false,0,'0','false'])assert.equal(booleanLabel(c,v),'ไม่ผ่าน');
 for(const v of [null,undefined,''])assert.equal(booleanLabel(c,v),'');
 assert.equal(normalizeValue(c,true),1);assert.equal(normalizeValue(c,false),0);
 assert.equal(booleanLabel({},false),'ไม่ใช่');assert.equal(booleanLabel({options:'legacy'},true),'ใช่');
 assert.throws(()=>normalizeBooleanLabels('{"true":123}'));assert.throws(()=>normalizeBooleanLabels('{"false":"'+ 'x'.repeat(101)+'"}'));
 const {normalizeColumns}=require('../.test-build/metadata');
 assert.equal(normalizeColumns([c])[0].options,c.options);
 assert.equal(booleanLabel({options:normalizeBooleanLabels('{"true":"","false":""}')},false),'ไม่ใช่');
});
test('price percent rating and user normalize finite scalars with distinct empty and zero',()=>{const n=(type,v)=>normalizeValue({name:'v',label:'Value',type},v);for(const type of ['price','percent','rating','user']){assert.ok(SQLTYPE[type]);assert.equal(n(type,null),null);assert.throws(()=>n(type,[]));assert.throws(()=>n(type,{}));assert.throws(()=>n(type,true));assert.throws(()=>n(type,Infinity));}assert.equal(n('price','-1234.567'),-1234.567);assert.equal(n('percent','25%'),.25);assert.equal(n('percent',.25),.25);assert.equal(n('percent',0),0);assert.throws(()=>n('percent',1.1));assert.throws(()=>n('percent',-1));assert.equal(n('rating',0),0);assert.equal(n('rating',5),5);assert.throws(()=>n('rating',2.5));assert.throws(()=>n('rating',6));assert.equal(n('user','12'),12);assert.throws(()=>n('user',0));assert.throws(()=>n('user',1.1));assert.match(valueLabel('percent',.25),/25%/);assert.match(valueLabel('price',1234.5),/1,234.50/);assert.equal(valueLabel('rating',0),'☆☆☆☆☆');assert.equal(valueLabel('rating',null),'—');});

test('User fields exclude inactive and revoked application members and reject forged assignments',()=>{const Database=require('better-sqlite3'),db=new Database(':memory:');const {initializeDatabase}=require('../.test-build/schema'),{withDatabase}=require('../.test-build/db'),{userFieldOptions,assertUserFields}=require('../.test-build/user-fields');initializeDatabase(db);try{withDatabase(db,()=>{db.exec("INSERT INTO _roles(name,label,builder) VALUES('field_member','Member',0);INSERT INTO _users(id,name,email,role,password_hash,created_at,active,username,nickname,department) VALUES(801,'Allowed','a@x.test','field_member','unused',1,1,'allowed','A','Test'),(802,'Inactive','b@x.test','field_member','unused',1,0,'inactive','B','Test'),(803,'Revoked','c@x.test','field_member','unused',1,1,'revoked','C','Test');INSERT INTO _application_members(app_id,user_id,role_name,can_use) VALUES('default',803,NULL,0)");assert.ok(userFieldOptions().some(u=>u.id===801));assert.ok(!userFieldOptions().some(u=>[802,803].includes(u.id)));const cols=[{name:'assigned',type:'user'}];assert.doesNotThrow(()=>assertUserFields(cols,{assigned:801}));assert.throws(()=>assertUserFields(cols,{assigned:803}));assert.throws(()=>assertUserFields(cols,{assigned:999999}));assert.doesNotThrow(()=>assertUserFields(cols,{assigned:803},{assigned:803}));});}finally{db.close();}});
