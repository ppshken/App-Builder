const {test}=require('node:test'),assert=require('node:assert/strict'),Database=require('better-sqlite3');
const {formState,validateRow,normalizeValue}=require('../.test-build/columns'),{initializeDatabase,readColumns}=require('../.test-build/schema'),{withDatabase}=require('../.test-build/db'),{normalizeColumns,insertColumn,saveColumn}=require('../.test-build/metadata');
const c={name:'amount',label:'Amount',type:'number',valid_if:'AND([_THIS] >= 1, [_THIS] <= 100)',invalid_value_error:'Enter 1 to 100'};
test('custom invalid value text is consistent in form and server validation; blank uses default',()=>{
 assert.equal(formState([c],{amount:101}).validation.amount,c.invalid_value_error);assert.throws(()=>validateRow([c],{amount:0}),/Enter 1 to 100/);assert.equal(validateRow([c],{amount:10}).amount,10);assert.match(formState([{...c,invalid_value_error:'  '}],{amount:0}).validation.amount,/Valid_If/);
});
test('custom message supports enum/list choices without hiding required/type/formula errors',()=>{
 for(const type of ['enum','enumlist']){const col={name:'choice',label:'Choice',type,options:'A,B',invalid_value_error:'Choose A or B'};assert.throws(()=>normalizeValue(col,type==='enum'?'C':['C']),/Choose A or B/);assert.equal(formState([{...col,valid_if:'LIST("A","B")'}],{choice:type==='enum'?'C':['C']}).validation.choice,'Choose A or B');}
 assert.match(formState([{...c,required:true}],{amount:''}).validation.amount,/Amount/);assert.doesNotMatch(formState([c],{amount:'oops'}).errors.amount,/Enter 1 to 100/);assert.ok(formState([{...c,valid_if:'MISSING_FUNCTION()'}],{amount:0}).errors.amount);
});
test('message metadata saves, updates and migrates old databases without data loss',()=>{
 const db=new Database(':memory:');try{initializeDatabase(db,':memory:');withDatabase(db,()=>{db.exec("INSERT INTO _tables(name,label) VALUES('items','Items')");const col=normalizeColumns([c])[0];insertColumn('items',col);assert.equal(readColumns(db,'items')[0].invalid_value_error,c.invalid_value_error);saveColumn('items',{...col,invalid_value_error:'Changed'});assert.equal(readColumns(db,'items')[0].invalid_value_error,'Changed');for(const bad of [123,{},'x'.repeat(1001)])assert.throws(()=>normalizeColumns([{...c,invalid_value_error:bad}]));db.exec('ALTER TABLE _columns DROP COLUMN invalid_value_error');initializeDatabase(db,':memory:');assert.equal(readColumns(db,'items')[0].name,'amount');assert.equal(readColumns(db,'items')[0].invalid_value_error,null);});}finally{db.close();}
});
test('old shared-table snapshots remain writable when the new message is empty',()=>{
 const {physicalHash}=require('../.test-build/shared-table-columns');const old=[{id:1,...c}];delete old[0].invalid_value_error;assert.equal(physicalHash(old),physicalHash(old.map(c=>({...c,invalid_value_error:null}))));assert.notEqual(physicalHash(old),physicalHash(old.map(c=>({...c,invalid_value_error:'Changed'}))));
});

test('custom English messages are public errors while internal SQL errors remain private',()=>{const {InvalidValueError}=require('../.test-build/invalid-value-error'),{errorMessage}=require('../.test-build/api');assert.equal(errorMessage(new InvalidValueError('Enter a positive amount')),'Enter a positive amount');assert.throws(()=>validateRow([c],{amount:0}),InvalidValueError);const warn=console.error;console.error=()=>{};try{assert.notEqual(errorMessage(new Error('synthetic internal failure')),'synthetic internal failure');}finally{console.error=warn;}});
