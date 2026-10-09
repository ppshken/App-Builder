
const {test}=require('node:test'),assert=require('node:assert/strict');const {highlightFormula}=require('../.test-build/formula-highlight');
test('formula paint preserves source exactly including incomplete text, escapes, Thai and line breaks',()=>{
 for(const source of ['', 'SELECT(', '[unfinished', '"unfinished', '"IF([id])"', '"a\\"b"', '"a""b"', '\tIF(\r\n  [id] > .5e2, "ภาษาไทย <script>", NULL\n)', 'ก'.repeat(10000)])assert.equal(highlightFormula(source).map(t=>t.text).join(''),source);
 const quoted=highlightFormula('"SELECT(table[id], TRUE)"');assert.equal(quoted.length,1);assert.equal(quoted[0].kind,'string');
 const reference=highlightFormula('SELECT(permission[id], [active] = TRUE)');assert.equal(reference.find(t=>t.text==='permission').kind,'table');assert.equal(reference.find(t=>t.text==='[id]').kind,'column');
});
