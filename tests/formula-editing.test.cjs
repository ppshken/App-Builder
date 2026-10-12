const {test}=require('node:test');
const assert=require('node:assert/strict');
const {editFormula}=require('../.test-build/formula-editing');
test('Enter preserves indentation and creates an indented line between parentheses',()=>{
 assert.deepEqual(editFormula('SELECT()',7,7,'Enter'),{value:'SELECT(\n  \n)',start:10,end:10});
 assert.equal(editFormula('  [status],',11,11,'Enter').value,'  [status],\n  ');
 assert.equal(editFormula('IF(\n  AND(',10,10,'Enter').value,'IF(\n  AND(\n    ');
});
test('Tab indents selections, Shift+Tab removes indentation, and leaves other keys alone',()=>{
 const source='A\nB\nC';
 const edit=editFormula(source,0,4,'Tab');
 assert.equal(edit.value,'  A\n  B\nC');
 assert.equal(editFormula(edit.value,edit.start,edit.end,'Tab',true).value,source);
 assert.deepEqual(editFormula('  A',2,2,'Tab',true),{value:'A',start:0,end:0});
 assert.deepEqual(editFormula('A',1,1,'Tab'),{value:'A  ',start:3,end:3});
 assert.equal(editFormula('A',1,1,'Escape'),null);
});
