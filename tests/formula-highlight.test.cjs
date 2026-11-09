
const {test}=require('node:test'),assert=require('node:assert/strict');const {highlightFormula,formulaBracketPair}=require('../.test-build/formula-highlight');
test('formula paint preserves source exactly including incomplete text, escapes, Thai and line breaks',()=>{
 for(const source of ['', 'SELECT(', '[unfinished', '"unfinished', '"IF([id])"', '"a\\"b"', '"a""b"', '\tIF(\r\n  [id] > .5e2, "ภาษาไทย <script>", NULL\n)', 'ก'.repeat(10000)])assert.equal(highlightFormula(source).map(t=>t.text).join(''),source);
 const quoted=highlightFormula('"SELECT(table[id], TRUE)"');assert.equal(quoted.length,1);assert.equal(quoted[0].kind,'string');
 const reference=highlightFormula('SELECT(permission[id], [active] = TRUE)');assert.equal(reference.find(t=>t.text==='permission').kind,'table');assert.equal(reference.find(t=>t.text==='[id]').kind,'column');
});
test('matching brackets follow nested pairs from either end without changing source',()=>{
 const source='IF(AND([qty]>0, TRUE), SUM([values]), 0)';
 for(const [open,close]of [[source.indexOf('('),source.length-1],[source.indexOf('(',4),source.indexOf(')')],[source.indexOf('['),source.indexOf(']')]])for(const caret of [open,close]){assert.deepEqual(formulaBracketPair(source,caret),[open,close]);const tokens=highlightFormula(source,caret);assert.equal(tokens.map(t=>t.text).join(''),source);assert.equal(tokens.filter(t=>t.matched).length,2);}
 assert.deepEqual(formulaBracketPair(source,source.length),[2,source.length-1]);
});
test('matching brackets ignore escaped/doubled quoted text and tolerate incomplete formulas',()=>{
 for(const source of ['"("','"a\\"(b"',"'a''(b'",'[unfinished','SUM('])assert.equal(formulaBracketPair(source,source.indexOf('(')>=0?source.indexOf('('):0),null);
 assert.equal(formulaBracketPair('[text(with)paren]',5),null);
 assert.equal(formulaBracketPair('SUM([qty])',-1),null);
 const source='IF(\n  [qty],\n  "ไทย 😀 )",\n  SUM([qty])\n)';assert.deepEqual(formulaBracketPair(source,2),[2,source.length-1]);
});
