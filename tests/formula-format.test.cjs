
const {test}=require('node:test'),assert=require('node:assert/strict');const {formatFormula,parseExpression,evaluateExpression}=require('../.test-build/expression');
const semantic=node=>JSON.parse(JSON.stringify(node,(key,value)=>['start','end','refStart','refEnd'].includes(key)?undefined:value));
test('formatting preserves grouping, precedence, strings, table references and nested SELECT scope',()=>{
 const formulas=[
 'INDEX(SELECT( inspection_image_category[id], NOT(IN([id],SELECT(inspection_image[category],AND([inspection_id]=[_THISROW].[inspection_id],[id]<>[_THISROW].[id]))))),1)',
 '1 - (2 - 3) * -(4 + 5) / .5e2',
 "IF( [amount] >= -1, CONCATENATE(\"comma, (brackets) [id] ภาษาไทย\", \"a\"\"b\"), 'it''s fine')",
 '[product] . [price] + SUM( products [id] )',
 'IF(TRUE, NOW(), TODAY())', 'NOT( ( [active] = FALSE ) )',
 'CONCATENATE("line\\nnext\\ttext", "a\\\\b")'
 ];
 for(const source of formulas){const formatted=formatFormula(source);assert.deepEqual(semantic(parseExpression(formatted)),semantic(parseExpression(source)));assert.equal(formatFormula(formatted),formatted);}
 const pretty=formatFormula(formulas[0]);assert.ok(pretty.includes('\n  SELECT(\n'));assert.ok(pretty.includes('[_THISROW].[inspection_id]'));assert.ok(pretty.includes('[id] <> [_THISROW].[id]'));
 assert.equal(evaluateExpression(formatFormula(formulas[1])),evaluateExpression(formulas[1]));
});
test('formatting rejects incomplete or unsupported formulas without evaluating them',()=>{
 for(const source of ['', 'SELECT(', 'IF(TRUE, 1)', 'UNKNOWN(1)', '"unclosed'])assert.throws(()=>formatFormula(source));
 assert.equal(formatFormula(' UNIQUEID ( ) '),'UNIQUEID()');
});
