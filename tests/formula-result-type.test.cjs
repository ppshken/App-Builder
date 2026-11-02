const {test}=require('node:test'),assert=require('node:assert/strict');
const {formulaTypeCheck,formulaResultTypes,validateFormulaResult,FormulaResultTypeError}=require('../.test-build/formula-result-type.js');
const cols=[{name:'amount',label:'Amount',type:'number'},{name:'active',label:'Active',type:'yesno'},{name:'title',label:'Title',type:'text'},{name:'parent',label:'Parent',type:'ref',ref_table:'parent'}],tables=[{name:'parent',columns:[{name:'image',label:'Photo',type:'image'},{name:'amount',label:'Amount',type:'number'}]}];
const check=(source,type='number',field='virtual_expr')=>formulaTypeCheck(source,{name:'result',label:'Result',type},field,cols,tables);
test('formula result checks distinguish scalar, list and boolean with actionable type suggestions',()=>{
 assert.equal(check('COUNT(parent[id])').error,'');
 assert.match(check('SELECT(parent[id], TRUE)').error,/List \/ EnumList/);
 assert.match(check('COUNT(parent[id])','yesno').error,/Number \/ Decimal/);
 assert.equal(check('[active]','yesno').error,'');
 assert.match(check('TRUE','number').error,/Yes\/No/);
 assert.match(check('"123"','number').error,/Text/);
 assert.equal(check('SELECT(parent[id], TRUE)','list').error,'');
});
test('formula condition fields expect boolean, while choice Valid_if also accepts lists',()=>{
 for(const field of ['show_if','required_if','editable_if']){assert.equal(check('[amount] > 0','text',field).error,'');assert.match(check('COUNT(parent[id])','text',field).error,/Yes\/No/);}
 for(const type of ['enum','enumlist','list','ref'])assert.equal(check('SELECT(parent[id], TRUE)',type,'valid_if').error,'');
 assert.match(check('COUNT(parent[id])','ref','valid_if').error,/Number \/ Decimal/);
 assert.match(check('SELECT(parent[id], TRUE)','number','valid_if').error,/Yes\/No/);
});
test('formula branches, column metadata, projections and INDEX preserve result types',()=>{
 assert.deepEqual(formulaResultTypes('INDEX(parent[image], 1)',cols,tables),['image']);
 assert.equal(check('INDEX(parent[image], 1)','image').error,'');
 assert.match(check('parent[image]','image').error,/List/);
 assert.equal(check('[parent].[image]','image').error,'');
 assert.match(check('IF([active], 1, "text")').error,/Text/);
 assert.equal(check('IF([active], 1, 2)').error,'');
 assert.deepEqual(formulaResultTypes('MIN("1", 2)',cols,tables),['number']);
});
test('date and duration functions retain semantic types; text formats are validated using actual results',()=>{
 assert.equal(check('TODAY()','date').error,'');assert.match(check('TODAY()','number').error,/Date/);
 assert.equal(check('NOW()','datetime').error,'');assert.equal(check('DURATION("01:00:00")','duration').error,'');
 assert.throws(()=>validateFormulaResult('not-a-date',{name:'date',label:'Date',type:'date'},'virtual_expr'));
 assert.doesNotThrow(()=>validateFormulaResult('2026-11-03',{name:'date',label:'Date',type:'date'},'virtual_expr'));
});
test('runtime checking handles stored YesNo values and string-encoded SELECT numbers without accepting wrong literals',()=>{
 assert.doesNotThrow(()=>validateFormulaResult(1,cols[1],'virtual_expr',['boolean']));
 assert.doesNotThrow(()=>validateFormulaResult('12',cols[0],'virtual_expr',['number']));
 assert.throws(()=>validateFormulaResult(1,cols[1],'virtual_expr',['number']),FormulaResultTypeError);
 assert.throws(()=>validateFormulaResult('12',cols[0],'virtual_expr',['text']),FormulaResultTypeError);
 assert.throws(()=>validateFormulaResult(['1'],cols[0],'virtual_expr'),/List/);
 assert.throws(()=>validateFormulaResult(5,cols[0],'editable_if'),/Yes\/No/);
});
test('dynamic settings remain unknown until tested; blanks do not claim a wrong type',()=>{
 const dynamic=check('USERSETTINGS("branch")');assert.equal(dynamic.error,'');assert.match(dynamic.actual,/ยังระบุไม่ได้/);
 assert.doesNotThrow(()=>validateFormulaResult(null,cols[0],'virtual_expr'));
 assert.throws(()=>validateFormulaResult('text',cols[0],'virtual_expr'),FormulaResultTypeError);
});

test('referenced Lists retain numeric row identity through INDEX and unary duration stays Duration',()=>{
 assert.deepEqual(formulaResultTypes('INDEX([rows],1)',[{name:'rows',label:'Rows',type:'list',ref_table:'parent'}],tables),['number']);
 assert.deepEqual(formulaResultTypes('-DURATION("01:00:00")',cols,tables),['duration']);
});

test('type-change suggestions are unambiguous, retain the formula and preserve stored-key safeguards',()=>{
 const {suggestedFormulaColumnTypes,formulaColumnTypePatch}=require('../.test-build/formula-result-type.js');
 assert.deepEqual(suggestedFormulaColumnTypes('COUNT(parent[id])',cols,tables),['number','decimal']);
 assert.deepEqual(suggestedFormulaColumnTypes('parent[image]',cols,tables),['list']);
 assert.deepEqual(suggestedFormulaColumnTypes('IF(TRUE, 1, "x")',cols,tables),[]);
 const patch=formulaColumnTypePatch({name:'key',label:'Key',type:'text',is_key:true},'number','default_expr','COUNT(parent[id])');
 assert.equal(patch.default_expr,'COUNT(parent[id])');assert.equal(patch.type,'number');assert.equal(patch.is_key,undefined);
 try{validateFormulaResult('wrong',cols[0],'virtual_expr');assert.fail('Expected mismatch');}catch(e){assert(e instanceof FormulaResultTypeError);assert.deepEqual(e.columnTypes,['text','longtext']);}
});
